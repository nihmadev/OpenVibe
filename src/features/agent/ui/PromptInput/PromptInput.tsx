import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileMatch } from "@/features/files/model/fs";
import { useI18n } from "@/shared/i18n/useI18n";
import "./PromptInput.css";

import { fsApi } from "@/features/files/infrastructure/fsGateway";
import { getReasoningEfforts } from "@/features/providers/model/providerTemplates";
import { ArrowUpIcon, AttachPlusIcon, RefreshCwIcon, StopIcon } from "@/shared/icons/icons";
import { getFileIconUrl, getFolderIconUrl } from "@/shared/icons/utils";
import { surfaceClassName } from "@/shared/ui/kit";
import { Tooltip } from "@/shared/ui/Tooltip/Tooltip";
import { prewarmLlmConnection } from "../../infrastructure/prewarm";
import { RollbackPill } from "../RollbackPill/RollbackPill";
import { PromptDragOverlay } from "./components/DragOverlay";
import { PromptImageAttachments } from "./components/ImageAttachments";
import { MentionPopup } from "./components/MentionPopup";
import { ModelSelector } from "./components/ModelSelector";
import { ReasoningEffortSelector } from "./components/ReasoningEffortSelector";
import type { Attachment, EditorPart, FileMention, MentionState, SendPayload } from "./types";
import { fileToAttachment } from "./utils";
import {
  createTextFragment,
  getCursorPosition,
  readEditorParts,
  removeTrailingOrphanBreak,
  setCursorPosition,
  setRangeEdge,
} from "./utils/editor-dom";
import {
  canNavigateHistoryAtCursor,
  type HistoryEntry,
  navigatePromptHistory,
  prependHistoryEntry,
} from "./utils/history";
import { createMarkdownFragment } from "./utils/markdown";
import { normalizePaste, pasteMode } from "./utils/paste";
import { PROMPT_SUGGESTION_KEYS, promptPlaceholder } from "./utils/placeholder";
import { addRecentMention, getRecentMentions } from "./utils/recentMentions";

export type { Attachment, FileMention, SendPayload };

interface Props {
  disabled: boolean;
  workspace: string;
  onSubmit: (payload: SendPayload) => void;
  onStop: () => void;

  currentModel: string;
  onPickModel: (id: string, providerDbId?: string) => void;
  onOpenSettings?: (tab?: string) => void;
  initialText?: string;
  rollbackActive?: boolean;
  rollbackText?: string;
  rollbackFileCount?: number;
  rollbackFilesChanged?: { path: string; content: string | null }[];
  rollbackMessagesRemoved?: number;
  onRollbackRestore?: () => void;
  providerId?: string;
  currentEffort?: string;
  onReasoningEffortChange?: (effort: string | null) => void;
  emptyState?: boolean;
}

// ─── helpers ─────────────────────────────────────────────

const ACCEPTED_FILE_TYPES =
  "image/*,.pdf,.txt,.md,.json,.js,.ts,.jsx,.tsx,.css,.html,.py,.java,.go,.rs,.rb,.c,.cpp,.h,.hpp,.yaml,.yml,.toml,.xml,.csv";

function motion(value: number): React.CSSProperties {
  return {
    opacity: value,
    transform: `scale(${0.98 + value * 0.02})`,
    filter: `blur(${(1 - value) * 2}px)`,
    pointerEvents: value > 0.5 ? "auto" : ("none" as React.CSSProperties["pointerEvents"]),
  };
}

function useSpring(target: number, deps: React.DependencyList) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    const start = value;
    const diff = target - start;
    if (Math.abs(diff) < 0.01) {
      setValue(target);
      return;
    }
    const duration = 200;
    const startTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setValue(start + diff * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // biome-ignore lint/correctness/useExhaustiveDependencies: deps forwarded from caller
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

export function PromptInput({
  disabled,
  workspace,
  onSubmit,
  onStop,
  currentModel,
  onPickModel,
  onOpenSettings,
  initialText,
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
}: Props): React.ReactElement {
  const { t } = useI18n();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
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

  const [markdownEnabled, setMarkdownEnabled] = useState<boolean>(
    () => localStorage.getItem("openvibe_prompt_markdown") !== "false",
  );
  const [showGhostSyntax, setShowGhostSyntax] = useState<boolean>(
    () => localStorage.getItem("openvibe_prompt_markdown_ghost") === "true",
  );

  useEffect(() => {
    const handleSettingsChange = () => {
      setMarkdownEnabled(localStorage.getItem("openvibe_prompt_markdown") !== "false");
      setShowGhostSyntax(localStorage.getItem("openvibe_prompt_markdown_ghost") === "true");
    };
    window.addEventListener("vibe:settings-changed", handleSettingsChange);
    window.addEventListener("storage", handleSettingsChange);
    return () => {
      window.removeEventListener("vibe:settings-changed", handleSettingsChange);
      window.removeEventListener("storage", handleSettingsChange);
    };
  }, []);

  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedText, setSavedText] = useState<string | null>(null);

  const [mentionState, setMentionState] = useState<MentionState>({
    active: false,
    start: 0,
    query: "",
    selected: 0,
    matches: [],
    loading: false,
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

  // ─── DOM helpers ────────────────────────────────────────

  const parseEditor = useCallback((): EditorPart[] => {
    const el = editorRef.current;
    if (!el) return [{ type: "text", content: "" }];
    return readEditorParts(el);
  }, []);

  const editorText = useCallback(
    (): string =>
      parseEditor()
        .map((part) => part.content)
        .join("")
        .replace(/\u200B/g, ""),
    [parseEditor],
  );

  const getCursor = useCallback((): number => {
    const el = editorRef.current;
    return el ? getCursorPosition(el) : 0;
  }, []);

  const scrollCursorIntoView = useCallback(() => {
    const container = scrollRef.current;
    const el = editorRef.current;
    if (!container || !el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) return;
    const cursor = getCursor();
    if (cursor >= editorText().length) {
      container.scrollTop = container.scrollHeight;
      return;
    }
    const rect = range.getClientRects().item(0) ?? range.getBoundingClientRect();
    if (!rect.height) return;
    const cr = container.getBoundingClientRect();
    const top = rect.top - cr.top + container.scrollTop;
    const bottom = rect.bottom - cr.top + container.scrollTop;
    const pad = 12;
    if (top < container.scrollTop + pad) {
      container.scrollTop = Math.max(0, top - pad);
      return;
    }
    if (bottom > container.scrollTop + container.clientHeight - 56)
      container.scrollTop = bottom - container.clientHeight + 56;
  }, [getCursor, editorText]);

  const queueScroll = useCallback(
    (count = 2) => {
      requestAnimationFrame(() => {
        scrollCursorIntoView();
        if (count > 1) queueScroll(count - 1);
      });
    },
    [scrollCursorIntoView],
  );

  // ─── editor rendering ──────────────────────────────────

  const createPill = useCallback(
    (path: string, display: string, isDir?: boolean): HTMLElement => {
      const pill = document.createElement("span");
      pill.className = "prompt-input__file-pill";
      pill.setAttribute("data-type", "file");
      pill.setAttribute("data-path", path);
      if (isDir) {
        pill.setAttribute("data-is-dir", "true");
      }
      pill.setAttribute("contenteditable", "false");
      pill.style.userSelect = "text";
      pill.style.cursor = "default";

      const img = document.createElement("img");
      img.className = "prompt-input__file-pill-icon";
      const isFolder =
        isDir ||
        display.endsWith("/") ||
        display.endsWith("\\") ||
        (path ? path.endsWith("/") || path.endsWith("\\") : false);
      img.src = isFolder ? getFolderIconUrl(display) : getFileIconUrl(display);
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.draggable = false;
      img.style.flexShrink = "0";

      const textSpan = document.createElement("span");
      textSpan.textContent = display.replace(/^@/, "");

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "prompt-input__file-pill-remove";
      removeButton.setAttribute("data-action", "prompt-mention-remove");
      removeButton.setAttribute("contenteditable", "false");
      removeButton.setAttribute("aria-label", t("remove"));
      removeButton.title = t("remove");

      pill.appendChild(img);
      pill.appendChild(textSpan);
      pill.appendChild(removeButton);
      return pill;
    },
    [t],
  );

  const renderEditor = useCallback(
    (parts: EditorPart[]) => {
      const el = editorRef.current;
      if (!el) return;
      el.innerHTML = "";
      for (const part of parts) {
        if (part.type === "text") {
          if (markdownEnabled) {
            el.appendChild(createMarkdownFragment(part.content, { showSyntaxMarkers: showGhostSyntax }));
          } else {
            el.appendChild(createTextFragment(part.content));
          }
          continue;
        }
        if (part.type === "file") {
          const pill = createPill(part.path ?? part.content, part.content, part.isDir);
          el.appendChild(pill);
        }
      }
      const last = el.lastChild;
      if (last?.nodeType === Node.ELEMENT_NODE && (last as HTMLElement).tagName === "BR")
        el.appendChild(document.createTextNode("\u200B"));
    },
    [createPill, markdownEnabled, showGhostSyntax],
  );

  const setEditorText = useCallback(
    (text: string) => {
      const el = editorRef.current;
      if (el) {
        el.innerHTML = "";
        if (markdownEnabled) {
          el.appendChild(createMarkdownFragment(text, { showSyntaxMarkers: showGhostSyntax }));
        } else {
          el.appendChild(createTextFragment(text));
        }
      }
    },
    [markdownEnabled, showGhostSyntax],
  );

  const clearEditor = useCallback(() => {
    const el = editorRef.current;
    if (el) el.innerHTML = "";
  }, []);

  const focusEditorEnd = useCallback(() => {
    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  }, []);

  // ─── attachments ────────────────────────────────────────

  const addAttachment = useCallback((a: Attachment) => {
    setAttachments((prev) => (a.path && prev.some((p) => p.path === a.path) ? prev : [...prev, a]));
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const att = await fileToAttachment(file);
        if (att) addAttachment(att);
      }
    },
    [addAttachment],
  );

  // ─── @mentions ──────────────────────────────────────────

  const closeMention = useCallback(
    () => setMentionState((m) => (m.active ? { ...m, active: false, matches: [] } : m)),
    [],
  );
  const setMentionSelected = useCallback((index: number) => setMentionState((s) => ({ ...s, selected: index })), []);

  const onAtInput = useCallback(
    (query: string) => {
      setMentionState((prev) => ({ ...prev, active: true, selected: 0, loading: true }));
      if (!query.trim()) {
        const recents = getRecentMentions();
        if (recents.length > 0) {
          setMentionState((prev) => (!prev.active ? prev : { ...prev, matches: recents, loading: false }));
          return;
        }
      }
      fsApi.findAll(workspace, query, 30).then((res) => {
        setMentionState((prev) =>
          !prev.active
            ? prev
            : !res.ok
              ? { ...prev, matches: [], loading: false }
              : { ...prev, matches: res.matches, loading: false },
        );
      });
    },
    [workspace],
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
      setHistoryIndex(-1);
      setSavedText(null);
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
    setHistoryIndex(-1);
    queueScroll();
  }, [
    mode,
    attachments.length,
    dirty,
    composing,
    editorText,
    getCursor,
    onAtInput,
    parseEditor,
    renderEditor,
    closeMention,
    queueScroll,
    clearEditor,
  ]);

  const handleMentionRemove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest('[data-action="prompt-mention-remove"]');
      if (!(button instanceof HTMLElement)) return;
      const pill = button.closest('[data-type="file"]');
      if (!(pill instanceof HTMLElement)) return;

      event.preventDefault();
      const range = document.createRange();
      const selection = window.getSelection();
      const next = pill.nextSibling;
      pill.remove();
      const cursorNode = next?.parentNode ? next : editorRef.current;
      if (cursorNode && selection) {
        if (cursorNode === next) {
          range.setStartBefore(next);
          range.collapse(true);
        } else {
          range.selectNodeContents(cursorNode);
          range.collapse(true);
        }
        selection.removeAllRanges();
        selection.addRange(range);
      }
      handleEditorInput();
    },
    [handleEditorInput],
  );

  const addPartAtCursor = useCallback(
    (part: EditorPart) => {
      const el = editorRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel) return;
      if (sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
        el.focus();
        const end = document.createRange();
        end.selectNodeContents(el);
        end.collapse(false);
        sel.removeAllRanges();
        sel.addRange(end);
      }
      if (sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!el.contains(range.startContainer)) return;
      if (part.type === "file") {
        const cursor = getCursor();
        const text = editorText();
        const beforeCursor = text.slice(0, cursor);
        const atMatch = beforeCursor.match(/@(\S*)$/);
        const pill = createPill(part.path ?? part.content, part.content, (part as any).isDir);
        const gap = document.createTextNode(" ");
        if (atMatch) {
          const start = atMatch.index ?? cursor - atMatch[0].length;
          setRangeEdge(el, range, "start", start);
          setRangeEdge(el, range, "end", cursor);
        }
        range.deleteContents();
        range.insertNode(gap);
        range.insertNode(pill);
        range.setStartAfter(gap);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      if (part.type === "text") {
        const fragment = createTextFragment(part.content);
        const last = fragment.lastChild;
        range.deleteContents();
        range.insertNode(fragment);
        if (last) {
          if (last.nodeType === Node.TEXT_NODE) {
            const t = last.textContent ?? "";
            if (t === "\u200B") range.setStart(last, 0);
            if (t !== "\u200B") range.setStart(last, t.length);
          }
          if (last.nodeType !== Node.TEXT_NODE) {
            const isBreak = last.nodeType === Node.ELEMENT_NODE && (last as HTMLElement).tagName === "BR";
            const next = last.nextSibling;
            const emptyText = next?.nodeType === Node.TEXT_NODE && (next.textContent ?? "") === "";
            if (isBreak && (!next || emptyText)) {
              const ph = next && emptyText ? next : document.createTextNode("\u200B");
              if (!next) last.parentNode?.insertBefore(ph, null);
              ph.textContent = "\u200B";
              range.setStart(ph, 0);
            } else range.setStartAfter(last);
          }
        }
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      handleEditorInput();
    },
    [getCursor, editorText, createPill, handleEditorInput],
  );

  // ─── apply mention ──────────────────────────────────────

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

    const parts: import("@/features/chats/model/chat").ContentPart[] = [];
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

    setHistoryEntries((prev) => prependHistoryEntry(prev, text, attachments));
    clearEditor();
    setAttachments([]);
    setDirty(false);
    setHistoryIndex(-1);
    setSavedText(null);
    setMode("normal");
    setPopover(null);
    onSubmit({
      parts,
      display: displayText,
      attachments: attachments.slice(),
      mentions: mentions.length > 0 ? mentions : undefined,
    });
  }, [disabled, editorText, parseEditor, attachments, clearEditor, onSubmit, onStop]);

  // ─── history navigation ─────────────────────────────────

  const navigateHistory = useCallback(
    (direction: "up" | "down"): boolean => {
      const text = editorText();
      const result = navigatePromptHistory({
        direction,
        entries: historyEntries,
        historyIndex,
        currentText: text,
        savedText,
      });
      if (!result.handled) return false;
      setHistoryIndex(result.historyIndex);
      setSavedText(result.savedText);
      const el = editorRef.current;
      if (!el) return true;
      if (result.entry.text) setEditorText(result.entry.text);
      else clearEditor();
      requestAnimationFrame(() => setCursorPosition(el, result.cursor === "end" ? result.entry.text.length : 0));
      setDirty(true);
      return true;
    },
    [historyEntries, historyIndex, savedText, editorText, setEditorText, clearEditor],
  );

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
            const len = Math.max(mentionState.matches.length, 1);
            if (event.key === "ArrowDown" || (ctrl && event.key === "n"))
              setMentionState((s) => ({ ...s, selected: (s.selected + 1) % len }));
            else if (event.key === "ArrowUp" || (ctrl && event.key === "p"))
              setMentionState((s) => ({ ...s, selected: (s.selected - 1 + len) % len }));
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
        if (navigateHistory(dir)) event.preventDefault();
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
  }, [disabled]);

  useEffect(() => {
    if (initialText !== undefined) {
      setEditorText(initialText);
      setDirty(true);
      focusEditorEnd();
    }
  }, [initialText, setEditorText, focusEditorEnd]);

  // ─── derived state ──────────────────────────────────────

  const imageAttachments = useMemo(
    () => attachments.filter((a): a is Attachment & { kind: "image" } => a.kind === "image"),
    [attachments],
  );

  const placeholderVisible = !dirty && !editorText().length;
  const stopping = disabled;

  const tipText = stopping ? t("stop") : mode === "shell" ? t("runCommand") : t("sendMessage");

  const inset = 44;
  const space = `${inset}px`;

  return (
    <div className="prompt-input-container">
      {/* Popovers positioned above the form */}
      <MentionPopup mention={mentionState} onSelect={applyMention} onHover={setMentionSelected} />

      {/* ── DockShellForm ── */}
      <form
        data-dock-surface="shell"
        className={surfaceClassName("composer", `prompt-input${dragOver ? " prompt-input--drag" : ""}`)}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <PromptDragOverlay type={dragOver ? "image" : null} label={t("dropFilesAttach")} />

        {previewAttachment?.dataUrl && (
          <div
            className="prompt-input__image-viewer"
            role="dialog"
            aria-modal="true"
            aria-label={previewAttachment.name}
            onClick={() => setPreviewAttachment(null)}
          >
            <div className="prompt-input__image-viewer-content" onClick={(e) => e.stopPropagation()}>
              <img src={previewAttachment.dataUrl} alt={previewAttachment.name} />
              <button
                type="button"
                className="prompt-input__image-viewer-close"
                onClick={() => setPreviewAttachment(null)}
                aria-label={t("close")}
              >
                <span aria-hidden="true">&#215;</span>
              </button>
            </div>
          </div>
        )}

        {imageAttachments.length > 0 && (
          <PromptImageAttachments
            attachments={imageAttachments}
            onOpen={setPreviewAttachment}
            onRemove={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
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

        {/* Editor + bottom bar */}
        <div
          className="prompt-input__editor-area"
          onMouseDown={(e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.closest('[data-action="prompt-attach"], [data-action="prompt-submit"]')) return;
            editorRef.current?.focus();
          }}
        >
          {/* Scroll container */}
          <div className="prompt-input__scroll" ref={scrollRef} style={{ scrollPaddingBottom: space }}>
            {/* contenteditable */}
            <div
              data-component="prompt-input"
              ref={editorRef}
              role="textbox"
              aria-multiline="true"
              aria-label={placeholder as string}
              contentEditable
              spellCheck={mode === "normal"}
              autoCapitalize={mode === "normal" ? "sentences" : "off"}
              autoCorrect={mode === "normal" ? "on" : "off"}
              inputMode="text"
              className={`prompt-input__editor${mode === "shell" ? " prompt-input__editor--shell" : ""}`}
              onInput={handleEditorInput}
              onPaste={handlePaste}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onMouseDown={handleMentionRemove}
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
              style={{ paddingBottom: space }}
            />
            {/* Placeholder overlay */}
            {placeholderVisible && (
              <div
                data-component="session-composer-text"
                className={`prompt-input__placeholder${mode === "shell" ? " prompt-input__placeholder--shell" : ""}`}
                aria-hidden="true"
                style={{ paddingBottom: space }}
              >
                <span
                  key={`${emptyState}-${mode}-${promptSuggestionIndex}-${disabled}`}
                  className="prompt-input__placeholder-text"
                >
                  {placeholder}
                </span>
              </div>
            )}
          </div>

          {/* Bottom gradient fade (matching OpenCode's linear-gradient) */}
          <div
            aria-hidden="true"
            className="prompt-input__gradient"
            style={{
              height: space,
              background: "linear-gradient(to top, var(--surface-raised) calc(100% - 20px), transparent)",
            }}
          />

          {/* Submit button (bottom-right, matching OpenCode v1 layout) */}
          <div className="prompt-input__submit-area">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES}
              style={{ display: "none" }}
              onChange={handleFileInputChange}
            />
            <div className="prompt-input__submit-buttons">
              <Tooltip text={tipText}>
                <button
                  type="submit"
                  data-action="prompt-submit"
                  className={`prompt-input__submit-btn${stopping ? " prompt-input__submit-btn--stop" : ""}`}
                  disabled={!stopping && !editorText().trim() && attachments.length === 0}
                  aria-label={tipText}
                >
                  {stopping ? <StopIcon /> : mode === "shell" ? <RefreshCwIcon /> : <ArrowUpIcon />}
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Bottom-left controls: attach + model selector / shell indicator */}
          <div className="prompt-input__attach-area">
            <div className="prompt-input__bottom-left">
              <div className="prompt-input__bottom-controls" style={control}>
                <Tooltip text={t("attachFiles")}>
                  <button
                    type="button"
                    data-action="prompt-attach"
                    className="prompt-input__attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={mode !== "normal"}
                    aria-label={t("attachFiles")}
                  >
                    <AttachPlusIcon />
                  </button>
                </Tooltip>
                <ModelSelector
                  currentModel={currentModel}
                  onPickModel={onPickModel}
                  onOpenSettings={onOpenSettings ?? (() => {})}
                />
                {onReasoningEffortChange && hasReasoningEffort && (
                  <ReasoningEffortSelector
                    currentEffort={currentEffort}
                    onChange={onReasoningEffortChange}
                    effortOptions={reasoningEffortOptions}
                  />
                )}
              </div>
              {/* Shell mode indicator */}
              <div className="prompt-input__bottom-shell" style={shell}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
                <span>{t("shell")}</span>
                <button type="button" className="prompt-input__shell-cancel" onClick={() => setMode("normal")}>
                  {t("cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
