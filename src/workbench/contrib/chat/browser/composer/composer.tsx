import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/platform/localization/localizationService";
import type { ContentPart } from "@/workbench/common/conversation";
import type { FileMatch } from "@/workbench/services/files/common/files";
import "./composer.css";

import { ArrowUpIcon, RefreshCwIcon, StopIcon } from "@/base/browser/ui/icons/iconRegistry";
import { Tooltip } from "@/base/browser/ui/tooltip/tooltip";
import { getReasoningEfforts } from "@/workbench/services/aiProviders/browser/providerTemplates";
import { prewarmLlmConnection } from "../../../../services/agent/tauri/agentPrewarmService";
import type { ComposerProps, EditorPart, FileMention } from "../../common/chat";
import { RollbackPill } from "../rollbackPill/rollbackPill";
import { ComposerFooter } from "./components/composerFooter";
import { PromptDragOverlay } from "./components/dragOverlay";
import { PromptImageAttachments } from "./components/imageAttachments";
import { PromptImageViewer } from "./components/imageViewer";
import { MentionPopup } from "./components/mentionPopup";
import { useAttachments } from "./hooks/useAttachments";
import { useMentionSearch } from "./hooks/useMentionSearch";
import { usePromptEditor } from "./hooks/usePromptEditor";
import { usePromptHistory } from "./hooks/usePromptHistory";
import { motion, useSpring } from "./hooks/useSpring";
import {
  normalizeFullEditorSelection,
  removeTrailingOrphanBreak,
  selectEditorText,
  setCursorPosition,
} from "./utils/editorDom";
import { canNavigateHistoryAtCursor } from "./utils/history";
import { normalizePaste, pasteMode } from "./utils/paste";
import { PROMPT_SUGGESTION_KEYS, promptPlaceholder } from "./utils/placeholder";
import { addRecentMention } from "./utils/recentMentions";

const ACCEPTED_FILE_TYPES =
  "image/*,.pdf,.txt,.md,.json,.js,.ts,.jsx,.tsx,.css,.html,.py,.java,.go,.rs,.rb,.c,.cpp,.h,.hpp,.yaml,.yml,.toml,.xml,.csv";

export function Composer({
  disabled,
  workspace,
  onSubmit,
  onStop,
  currentModel,
  onPickModel,
  onOpenSettings,
  initialText,
  initialTextRevision,
  rollbackActive,
  rollbackText,
  rollbackFileCount,
  rollbackFilesChanged,
  rollbackMessagesRemoved,
  onRollbackRestore,
  providerId,
  currentEffort,
  onReasoningEffortChange,
  emptyState = false,
}: ComposerProps): React.ReactElement {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [dragOver, setDragOver] = useState(false);
  const [focused, setFocused] = useState(false);
  const [mode, setMode] = useState<"normal" | "shell">("normal");
  const [composing, setComposing] = useState(false);
  const [popover, setPopover] = useState<"at" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [promptSuggestionIndex, setPromptSuggestionIndex] = useState(0);

  useEffect(() => {
    if (!emptyState || disabled || mode !== "normal" || dirty || focused) return;
    const timer = window.setInterval(() => {
      setPromptSuggestionIndex((index) => (index + 1) % PROMPT_SUGGESTION_KEYS.length);
    }, 3600);
    return () => window.clearInterval(timer);
  }, [disabled, mode, dirty, focused, emptyState]);

  const {
    attachments,
    clearAttachments,
    handleFiles,
    imageAttachments,
    previewAttachment,
    removeAttachment,
    setPreviewAttachment,
  } = useAttachments();

  const { mentionState, onAtInput, closeMention, setMentionSelected, moveSelected } = useMentionSearch(workspace);

  const {
    editorRef,
    scrollRef,
    parseEditor,
    editorText,
    getCursor,
    queueScroll,
    renderEditor,
    setEditorText,
    clearEditor,
    focusEditorEnd,
    addPartAtCursor,
    handleMentionRemove,
  } = usePromptEditor({ t, onInput: () => handleEditorInput() });

  const {
    historyIndex,
    commit,
    reset: resetHistory,
    navigate: navigateHistory,
  } = usePromptHistory({
    editorRef,
    editorText,
    setEditorText,
    clearEditor,
  });

  // Spring animation for normal ↔ shell mode transition
  const buttonsSpring = useSpring(mode === "normal" ? 1 : 0, [mode]);
  const buttons = useMemo(() => motion(buttonsSpring), [buttonsSpring]);
  const shell = useMemo(() => motion(1 - buttonsSpring), [buttonsSpring]);
  const control = useMemo(() => ({ height: "28px", ...buttons }) satisfies React.CSSProperties, [buttons]);

  const reasoningEffortOptions = useMemo(() => {
    const pid = providerId ?? "";
    const efforts = getReasoningEfforts(pid, currentModel);
    if (!efforts) return [];
    return [
      { value: "", labelKey: "reasoningEffortNone" },
      ...efforts.map((e) => ({ value: e, labelKey: `reasoningEffort${e.charAt(0).toUpperCase()}${e.slice(1)}` })),
    ];
  }, [providerId, currentModel]);

  const hasReasoningEffort = reasoningEffortOptions.length > 0;

  const placeholder = useMemo(
    () =>
      promptPlaceholder(
        {
          mode,
          disabled,
          suggest: true,
          example: mode === "shell" ? "git status" : "help me refactor",
          t,
        },
        emptyState && mode === "normal"
          ? t(PROMPT_SUGGESTION_KEYS[promptSuggestionIndex] ?? PROMPT_SUGGESTION_KEYS[0])
          : undefined,
      ),
    [emptyState, mode, disabled, promptSuggestionIndex, t],
  );

  // ─── input handling ─────────────────────────────────────

  const handleEditorInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    // Typing is the strongest "a request is coming" signal — make sure the
    // TCP+TLS connection to the provider is warm (throttled internally).
    prewarmLlmConnection();
    removeTrailingOrphanBreak(el);
    const text = editorText();
    if (!text && attachments.length === 0) {
      clearEditor();
      closeMention();
      setPopover(null);
      resetHistory();
      if (dirty) setDirty(false);
      queueScroll();
      return;
    }
    setDirty(true);

    if (!composing) {
      const cursor = getCursor();
      const parts = parseEditor();
      renderEditor(parts);
      setCursorPosition(el, cursor);
    }

    if (mode === "normal") {
      const cursor = getCursor();
      const atMatch = text.slice(0, cursor).match(/@(\S*)$/);
      if (atMatch) {
        onAtInput(atMatch[1]!);
        setPopover("at");
      } else {
        closeMention();
        setPopover(null);
      }
    } else setPopover(null);
    resetHistory();
    queueScroll();
  }, [
    mode,
    attachments.length,
    dirty,
    composing,
    editorRef,
    editorText,
    getCursor,
    onAtInput,
    parseEditor,
    renderEditor,
    closeMention,
    queueScroll,
    clearEditor,
    resetHistory,
  ]);

  const applyMention = useCallback(
    (match: FileMatch) => {
      closeMention();
      addRecentMention(match);
      addPartAtCursor({ type: "file", content: `@${match.rel}`, path: match.path, isDir: match.isDir } as any);
    },
    [closeMention, addPartAtCursor],
  );

  // ─── submit ─────────────────────────────────────────────

  const submit = useCallback(() => {
    if (disabled) {
      onStop();
      return;
    }
    const text = editorText().trim();
    if (!text && attachments.length === 0) return;

    // Build the display text with @-prefixes for file mentions so pills can
    // be detected from the persisted text on reload.
    const editorParts = parseEditor();
    const displayText = editorParts
      .map((p) => (p.type === "file" ? `@${p.content.replace(/^@/, "")}` : p.content))
      .join("")
      .replace(/\u200B/g, "")
      .trim();

    const parts: ContentPart[] = [];
    if (displayText) parts.push({ type: "text", text: displayText });
    for (const a of attachments) {
      if (a.kind === "image" && a.dataUrl) parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
    }

    // Extract file mentions from editor parts so they can be rendered as pills
    // in the chat history (provides isDir info for proper icon selection).
    const mentions: FileMention[] = editorParts
      .filter((p): p is EditorPart & { type: "file"; path: string } => p.type === "file" && !!p.path)
      .map((p) => ({
        display: p.content.replace(/^@/, ""),
        path: p.path,
        isDir: p.isDir,
      }));

    commit(text, attachments);
    clearEditor();
    clearAttachments();
    setDirty(false);
    resetHistory();
    setMode("normal");
    setPopover(null);
    onSubmit({
      parts,
      display: displayText,
      attachments: attachments.slice(),
      mentions: mentions.length > 0 ? mentions : undefined,
    });
  }, [
    disabled,
    editorText,
    parseEditor,
    attachments,
    clearEditor,
    clearAttachments,
    resetHistory,
    commit,
    onSubmit,
    onStop,
  ]);

  const selectPopoverActive = useCallback(() => {
    if (popover === "at") {
      const m = mentionState.matches[mentionState.selected];
      if (m) applyMention(m);
    }
  }, [popover, mentionState, applyMention]);

  // ─── key handling ───────────────────────────────────────

  const isImeComposing = useCallback(
    (event: KeyboardEvent) => event.isComposing || composing || event.keyCode === 229,
    [composing],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectEditorText(event.currentTarget);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "u") {
        event.preventDefault();
        if (mode !== "normal") return;
        fileInputRef.current?.click();
        return;
      }
      if (event.key === "Escape") {
        if (popover) {
          setPopover(null);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (mode === "shell") {
          setMode("normal");
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        return;
      }
      if (event.key === "!" && mode === "normal" && getCursor() === 0) {
        setMode("shell");
        setPopover(null);
        event.preventDefault();
        return;
      }
      if (mode === "shell" && event.key === "Backspace" && getCursor() === 0 && editorText().length === 0) {
        setMode("normal");
        event.preventDefault();
        return;
      }
      if (event.key === "Enter" && event.shiftKey) {
        addPartAtCursor({ type: "text", content: "\n" });
        event.preventDefault();
        return;
      }
      if (event.key === "Enter" && isImeComposing(event.nativeEvent)) return;
      const ctrl = event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
      if (popover) {
        if (event.key === "Tab") {
          selectPopoverActive();
          event.preventDefault();
          return;
        }
        const nav = event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Enter";
        const ctrlNav = ctrl && (event.key === "n" || event.key === "p");
        if (nav || ctrlNav) {
          event.preventDefault();
          if (popover === "at") {
            if (event.key === "ArrowDown" || (ctrl && event.key === "n")) moveSelected(1);
            else if (event.key === "ArrowUp" || (ctrl && event.key === "p")) moveSelected(-1);
            else if (event.key === "Enter") {
              const m = mentionState.matches[mentionState.selected];
              if (m) applyMention(m);
            }
          }
          return;
        }
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const cursor = getCursor();
        const text = editorText();
        const dir = event.key === "ArrowUp" ? "up" : "down";
        if (!canNavigateHistoryAtCursor(dir, text, cursor, historyIndex >= 0)) return;
        if (navigateHistory(dir)) {
          setDirty(true);
          event.preventDefault();
        }
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (event.repeat) return;
        submit();
      }
    },
    [
      mode,
      popover,
      getCursor,
      editorText,
      addPartAtCursor,
      navigateHistory,
      submit,
      mentionState,
      historyIndex,
      isImeComposing,
      selectPopoverActive,
      applyMention,
      moveSelected,
    ],
  );

  // ─── paste ──────────────────────────────────────────────

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const cd = event.clipboardData;
      if (!cd) return;
      const files = Array.from(cd.items).flatMap((item) => {
        if (item.kind !== "file") return [];
        const f = item.getAsFile();
        return f ? [f] : [];
      });
      if (files.length > 0) {
        await handleFiles(files);
        return;
      }
      const plainText = cd.getData("text/plain") ?? "";
      if (!plainText) return;
      const text = normalizePaste(plainText);
      const put = () => addPartAtCursor({ type: "text", content: text });
      if (pasteMode(text) === "manual") {
        put();
        return;
      }
      const inserted = typeof document.execCommand === "function" && document.execCommand("insertText", false, text);
      if (inserted) return;
      put();
    },
    [handleFiles, addPartAtCursor],
  );

  // ─── composition ────────────────────────────────────────

  const handleCompositionStart = useCallback(() => setComposing(true), []);
  const handleCompositionEnd = useCallback(() => {
    setComposing(false);
    requestAnimationFrame(() => {
      if (composing) return;
      handleEditorInput();
    });
  }, [handleEditorInput, composing]);

  // ─── drag & drop ────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dt = e.dataTransfer;
      if (!dt) return;
      const vibePath = dt.getData("application/x-vibe-path");
      if (vibePath) {
        let rel = vibePath;
        if (vibePath.startsWith(workspace)) rel = vibePath.slice(workspace.length).replace(/^[\\/]/, "");
        addPartAtCursor({ type: "file", content: `@${rel}`, path: vibePath });
        return;
      }
      if (dt.files && dt.files.length > 0) await handleFiles(dt.files);
    },
    [workspace, addPartAtCursor, handleFiles],
  );

  // ─── file input ─────────────────────────────────────────

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.currentTarget.files;
      if (list) handleFiles(Array.from(list));
      e.currentTarget.value = "";
    },
    [handleFiles],
  );

  // ─── effects ────────────────────────────────────────────

  const prevRollbackActive = useRef(rollbackActive);
  useEffect(() => {
    if (prevRollbackActive.current && !rollbackActive) {
      clearEditor();
      setDirty(false);
    }
    prevRollbackActive.current = rollbackActive;
  }, [rollbackActive, clearEditor]);

  useEffect(() => {
    if (!disabled) editorRef.current?.focus();
  }, [disabled, editorRef]);

  // initialTextRevision intentionally reapplies identical starter text.
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision is an explicit replay signal
  useEffect(() => {
    if (initialText !== undefined) {
      setEditorText(initialText);
      setDirty(true);
      focusEditorEnd();
    }
  }, [initialText, initialTextRevision, setEditorText, focusEditorEnd]);

  // ─── derived state ──────────────────────────────────────

  const placeholderVisible = !dirty && !editorText().length;
  const stopping = disabled;

  const tipText = stopping ? t("stop") : mode === "shell" ? t("runCommand") : t("sendMessage");

  return (
    <div className="composer-container">
      {/* Popovers positioned above the form */}
      <MentionPopup mention={mentionState} onSelect={applyMention} onHover={setMentionSelected} />

      {/* ── DockShellForm ── */}
      <form
        data-composer-layout="multiline"
        data-composer-empty-state={emptyState || undefined}
        data-composer-surface-variant="default"
        data-composer-drag-active={dragOver || undefined}
        className={`composer${dragOver ? " composer--drag" : ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <PromptDragOverlay type={dragOver ? "image" : null} label={t("dropFilesAttach")} />

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          className="composer__file-input"
          onChange={handleFileInputChange}
        />

        {previewAttachment && (
          <PromptImageViewer attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
        )}

        {imageAttachments.length > 0 && (
          <PromptImageAttachments
            attachments={imageAttachments}
            onOpen={setPreviewAttachment}
            onRemove={removeAttachment}
            removeLabel={t("remove")}
          />
        )}

        {/* ── Rollback section ── */}
        {rollbackActive && onRollbackRestore && (
          <RollbackPill
            messageText={rollbackText ?? ""}
            fileCount={rollbackFileCount ?? 0}
            filesChanged={rollbackFilesChanged ?? []}
            messagesRemoved={rollbackMessagesRemoved ?? 0}
            onRestore={onRollbackRestore}
          />
        )}

        {/* Editor + adaptive footer */}
        <div
          className="composer__editor-area"
          onMouseDown={(e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.closest("button, input, select, textarea, a, [role=menuitem]")) return;
            editorRef.current?.focus();
          }}
        >
          {/* Scroll container */}
          <div className="composer__scroll" ref={scrollRef}>
            {/* contenteditable */}
            <div
              data-component="composer-input"
              ref={editorRef}
              role="textbox"
              aria-multiline="true"
              aria-label={placeholder as string}
              contentEditable
              spellCheck={mode === "normal"}
              autoCapitalize={mode === "normal" ? "sentences" : "off"}
              autoCorrect={mode === "normal" ? "on" : "off"}
              inputMode="text"
              className={`composer__editor${mode === "shell" ? " composer__editor--shell" : ""}`}
              onInput={handleEditorInput}
              onPaste={handlePaste}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onMouseDown={handleMentionRemove}
              onSelect={(event) => normalizeFullEditorSelection(event.currentTarget)}
              onFocus={() => {
                setFocused(true);
                prewarmLlmConnection();
              }}
              onBlur={() => {
                setFocused(false);
                closeMention();
                setPopover(null);
                setComposing(false);
              }}
              onKeyDown={handleKeyDown}
            />
            {/* Placeholder overlay */}
            {placeholderVisible && (
              <div
                data-component="session-composer-text"
                className={`composer__placeholder${mode === "shell" ? " composer__placeholder--shell" : ""}`}
                aria-hidden="true"
              >
                <span
                  key={`${emptyState}-${mode}-${promptSuggestionIndex}-${disabled}`}
                  className="composer__placeholder-text"
                >
                  {placeholder}
                </span>
              </div>
            )}
          </div>

          <ComposerFooter
            controlStyle={control}
            shellStyle={shell}
            onAttachClick={() => fileInputRef.current?.click()}
            attachDisabled={mode !== "normal"}
            currentModel={currentModel}
            onPickModel={onPickModel}
            onOpenSettings={onOpenSettings ?? (() => {})}
            showReasoningEffort={Boolean(onReasoningEffortChange) && hasReasoningEffort}
            currentEffort={currentEffort}
            onReasoningEffortChange={onReasoningEffortChange ?? (() => {})}
            effortOptions={reasoningEffortOptions}
            onOptionsOpen={() => {
              closeMention();
              setPopover(null);
            }}
            onExitShell={() => setMode("normal")}
            primaryAction={
              <Tooltip text={tipText}>
                <button
                  type="submit"
                  data-action="composer-submit"
                  className={`composer__primary-action${stopping ? " composer__primary-action--stop" : ""}`}
                  disabled={!stopping && !editorText().trim() && attachments.length === 0}
                  aria-label={tipText}
                >
                  {stopping ? <StopIcon /> : mode === "shell" ? <RefreshCwIcon /> : <ArrowUpIcon />}
                </button>
              </Tooltip>
            }
          />
        </div>
      </form>
    </div>
  );
}
