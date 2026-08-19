import type * as monaco from "monaco-editor";
import { useCallback, useEffect, useRef, useState } from "react";
import { streamInlineEdit } from "../../../../services/agent/tauri/inlineVibeService";
import type { EditorRefs, InlineSession, SetContent } from "./editorState";
import { useInlineGhostText } from "./useInlineGhostText";

export function useInlineVibe(path: string, refs: EditorRefs, setContent: SetContent) {
  const zoneIdRef = useRef<string | null>(null);
  const zoneDescriptorRef = useRef<monaco.editor.IViewZone | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const sessionRef = useRef<InlineSession | null>(null);
  const loadingRef = useRef(false);
  const lastTriggerTimeRef = useRef(0);
  const [zoneNode, setZoneNode] = useState<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasDiff, setHasDiff] = useState(false);
  const { clearGhostText, updateGhostTextRef } = useInlineGhostText(refs, zoneNode, sessionRef);

  const cleanup = useCallback(() => {
    const editor = refs.editor.current;
    if (!editor) return;
    if (zoneIdRef.current !== null) {
      editor.changeViewZones((accessor) => accessor.removeZone(zoneIdRef.current!));
      zoneIdRef.current = null;
    }
    zoneDescriptorRef.current = null;
    setZoneNode(null);
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    loadingRef.current = false;
    sessionRef.current = null;
    setHasDiff(false);
    setLoading(false);
    setContent(editor.getValue());
    setTimeout(() => updateGhostTextRef.current(), 10);
  }, [refs, setContent, updateGhostTextRef]);

  const accept = useCallback(() => cleanup(), [cleanup]);
  const reject = useCallback(() => {
    const editor = refs.editor.current;
    const m = refs.monaco.current;
    const session = sessionRef.current;
    if (!editor || !m || !session) return cleanup();
    editor.executeEdits("inline-vibe-reject", [
      {
        range: new m.Range(
          session.startLine,
          1,
          session.endLine,
          editor.getModel()?.getLineMaxColumn(session.endLine) ?? 1,
        ),
        text: session.originalText,
        forceMoveMarkers: true,
      },
    ]);
    cleanup();
  }, [cleanup, refs]);

  const navigate = useCallback(
    (direction: "next" | "prev") => {
      const editor = refs.editor.current;
      const session = sessionRef.current;
      if (!editor || !session) return;
      const lineNumber = direction === "next" ? session.endLine : session.startLine;
      editor.revealLineInCenter(lineNumber);
      editor.setPosition({ lineNumber, column: 1 });
      editor.focus();
    },
    [refs],
  );

  const updateStream = useCallback(
    (generatedText: string) => {
      const editor = refs.editor.current;
      const m = refs.monaco.current;
      const session = sessionRef.current;
      if (!editor || !m || !session) return;
      let cleanedText = generatedText.trim();
      if (cleanedText.startsWith("```")) {
        const lines = cleanedText.split("\n");
        if (lines[0].startsWith("```")) lines.shift();
        if (lines.at(-1)?.startsWith("```")) lines.pop();
        cleanedText = lines.join("\n");
      }

      const newEndLine = session.startLine + cleanedText.split("\n").length - 1;
      editor.executeEdits("inline-vibe", [
        {
          range: new m.Range(
            session.startLine,
            1,
            session.endLine,
            editor.getModel()?.getLineMaxColumn(session.endLine) ?? 1,
          ),
          text: cleanedText,
          forceMoveMarkers: true,
        },
      ]);
      session.endLine = newEndLine;
      decorationsRef.current = editor.deltaDecorations(
        decorationsRef.current,
        Array.from({ length: session.endLine - session.startLine + 1 }, (_, index) => ({
          range: new m.Range(session.startLine + index, 1, session.startLine + index, 1),
          options: {
            isWholeLine: true,
            className: "inline-diff-added",
            linesDecorationsClassName: "inline-diff-added-gutter",
          },
        })),
      );

      const node = zoneNode || document.createElement("div");
      if (!zoneNode) {
        node.className = "inline-vibe-zone-container";
        setZoneNode(node);
      }
      setHasDiff(true);
      const current = zoneDescriptorRef.current;
      if (zoneIdRef.current === null || !current || current.afterLineNumber !== newEndLine) {
        const descriptor: monaco.editor.IViewZone = {
          afterLineNumber: newEndLine,
          heightInPx:
            current?.heightInPx ||
            Math.max(40, (node.querySelector(".inline-vibe-portal-root") as HTMLElement)?.scrollHeight + 16 || 76),
          domNode: node,
        };
        editor.changeViewZones((accessor) => {
          if (zoneIdRef.current !== null) accessor.removeZone(zoneIdRef.current);
          zoneIdRef.current = accessor.addZone(descriptor);
        });
        zoneDescriptorRef.current = descriptor;
        editor.revealLineInCenterIfOutsideViewport(newEndLine);
      }
    },
    [refs, zoneNode],
  );

  const sendPrompt = useCallback(
    async (promptText: string) => {
      const editor = refs.editor.current;
      const m = refs.monaco.current;
      const session = sessionRef.current;
      if (!editor || !m || !session) return;
      if (hasDiff) {
        const range = new m.Range(
          session.startLine,
          1,
          session.endLine,
          editor.getModel()?.getLineMaxColumn(session.endLine) ?? 1,
        );
        session.originalText = editor.getModel()?.getValueInRange(range) ?? "";
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
        setHasDiff(false);
      }
      loadingRef.current = true;
      setLoading(true);
      await streamInlineEdit({
        path,
        promptText,
        originalText: session.originalText,
        onUpdate: updateStream,
        onLoadingChange: (value) => {
          loadingRef.current = value;
          setLoading(value);
        },
        onComplete: () => setContent(refs.editor.current?.getValue() ?? null),
        onError: (message) => {
          alert(message);
          cleanup();
        },
      });
    },
    [cleanup, hasDiff, path, refs, setContent, updateStream],
  );

  const trigger = useCallback(() => {
    const now = Date.now();
    if (now - lastTriggerTimeRef.current < 300) return;
    lastTriggerTimeRef.current = now;
    const editor = refs.editor.current;
    const m = refs.monaco.current;
    if (!editor || !m) return;
    const textarea = zoneNode?.querySelector("textarea");
    if (textarea && document.body.contains(textarea) && document.activeElement !== textarea) {
      textarea.focus();
      return;
    }
    cleanup();

    let selection = editor.getSelection();
    const position = editor.getPosition();
    if ((!selection || selection.isEmpty()) && position) {
      selection = new m.Selection(
        position.lineNumber,
        1,
        position.lineNumber,
        editor.getModel()?.getLineMaxColumn(position.lineNumber) ?? 1,
      );
      editor.setSelection(selection);
    }
    if (!selection) return;
    sessionRef.current = {
      startLine: selection.startLineNumber,
      endLine: selection.endLineNumber,
      originalText: editor.getModel()?.getValueInRange(selection) ?? "",
      selection: new m.Selection(
        selection.startLineNumber,
        selection.startColumn,
        selection.endLineNumber,
        selection.endColumn,
      ),
    };

    const node = document.createElement("div");
    node.className = "inline-vibe-zone-container";
    const descriptor: monaco.editor.IViewZone = {
      afterLineNumber: selection.endLineNumber,
      heightInPx: 42,
      domNode: node,
    };
    editor.changeViewZones((accessor) => {
      zoneIdRef.current = accessor.addZone(descriptor);
    });
    zoneDescriptorRef.current = descriptor;
    setZoneNode(node);
    setHasDiff(false);
    clearGhostText();
    editor.revealLineInCenterIfOutsideViewport(selection.endLineNumber);
    setTimeout(() => editor.setScrollTop(editor.getScrollTop() + 80), 50);
  }, [cleanup, clearGhostText, refs, zoneNode]);

  useEffect(() => {
    if (!zoneNode || zoneIdRef.current === null) return;
    const editor = refs.editor.current;
    if (!editor) return;
    const observer = new ResizeObserver(() => {
      const portal = zoneNode.querySelector(".inline-vibe-portal-root") as HTMLElement;
      const descriptor = zoneDescriptorRef.current;
      if (!portal || !descriptor) return;
      const height = Math.max(40, portal.scrollHeight + 16);
      if (descriptor.heightInPx !== height) {
        descriptor.heightInPx = height;
        editor.changeViewZones((accessor) => zoneIdRef.current && accessor.layoutZone(zoneIdRef.current));
      }
    });
    observer.observe(zoneNode);
    const portal = zoneNode.querySelector(".inline-vibe-portal-root");
    if (portal) observer.observe(portal);
    return () => observer.disconnect();
  }, [refs, zoneNode]);

  return {
    zoneNode,
    loading,
    loadingRef,
    hasDiff,
    sessionRef,
    trigger,
    accept,
    reject,
    navigate,
    sendPrompt,
    cleanup,
    updateGhostTextRef,
  };
}
