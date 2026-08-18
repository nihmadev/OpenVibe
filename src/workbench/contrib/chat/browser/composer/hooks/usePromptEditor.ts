import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getFileIconUrl, getFolderIconUrl } from "@/base/browser/ui/icons/iconResolver";
import type { EditorPart } from "../../../common/chat";
import { createTextFragment, getCursorPosition, readEditorParts, setRangeEdge } from "../utils/editorDom";
import { createMarkdownFragment } from "../utils/markdown";

interface PromptEditorOptions {
  /** Translator used for pill remove-button labels. */
  t: (key: string) => string;
  /** Invoked after DOM mutations (pill insert/remove) so the host can re-run input handling. */
  onInput: () => void;
}

/**
 * Owns the contenteditable prompt editor: DOM rendering (text, markdown,
 * file pills), cursor/scroll management and pill insertion at the cursor.
 */
export function usePromptEditor({ t, onInput }: PromptEditorOptions) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const onInputRef = useRef(onInput);
  useEffect(() => {
    onInputRef.current = onInput;
  });

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

  // ─── reading ────────────────────────────────────────────

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

  // ─── scrolling ──────────────────────────────────────────

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

  // ─── rendering ──────────────────────────────────────────

  const createPill = useCallback(
    (path: string, display: string, isDir?: boolean): HTMLElement => {
      const pill = document.createElement("span");
      pill.className = "inline-file-mention composer__file-pill";
      pill.setAttribute("data-type", "file");
      pill.setAttribute("data-path", path);
      pill.setAttribute("data-display", display.replace(/^@/, ""));
      if (isDir) {
        pill.setAttribute("data-is-dir", "true");
      }
      pill.setAttribute("contenteditable", "false");
      pill.style.userSelect = "text";
      pill.style.cursor = "default";

      const img = document.createElement("img");
      img.className = "inline-file-mention__icon";
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
      removeButton.className = "composer__file-pill-remove";
      removeButton.setAttribute("data-action", "composer-mention-remove");
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

      // Live markdown rendering rebuilds the surrounding text after every
      // input event. Reuse atomic mention nodes so their already-decoded
      // file/folder images remain mounted instead of flashing on each key.
      const mentionKey = (path: string | undefined, display: string, isDir?: boolean) =>
        `${path ?? ""}\u0000${display.replace(/^@/, "")}\u0000${isDir === true}`;
      const existingMentions = new Map<string, HTMLElement[]>();
      for (const mention of Array.from(el.querySelectorAll<HTMLElement>('[data-type="file"]'))) {
        const key = mentionKey(
          mention.dataset.path,
          mention.dataset.display ?? mention.textContent ?? "",
          mention.dataset.isDir === "true",
        );
        const entries = existingMentions.get(key);
        if (entries) entries.push(mention);
        else existingMentions.set(key, [mention]);
      }

      el.replaceChildren();
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
          const key = mentionKey(part.path, part.content, part.isDir);
          const pill =
            existingMentions.get(key)?.shift() ?? createPill(part.path ?? part.content, part.content, part.isDir);
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

  // ─── mutations ──────────────────────────────────────────

  const handleMentionRemove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest('[data-action="composer-mention-remove"]');
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
    onInputRef.current();
  }, []);

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
      onInputRef.current();
    },
    [getCursor, editorText, createPill],
  );

  return {
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
  };
}

export type PromptEditor = ReturnType<typeof usePromptEditor>;
