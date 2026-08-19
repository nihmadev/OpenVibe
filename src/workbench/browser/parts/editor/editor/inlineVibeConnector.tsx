import type * as monaco from "monaco-editor";
import { useEffect, useState } from "react";

interface Props {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  monacoInstance: typeof monaco | null;
  session: { endLine: number } | null;
  zoneNode: HTMLDivElement | null;
  loading: boolean;
}

interface Coordinates {
  startX: number;
  startY: number;
  boxX: number;
  boxY: number;
}

export function InlineVibeConnector({ editor, monacoInstance, session, zoneNode, loading }: Props) {
  const [coords, setCoords] = useState<Coordinates | null>(null);

  useEffect(() => {
    if (!editor || !monacoInstance || !session || !zoneNode) {
      setCoords(null);
      return;
    }

    let animationFrame: number | null = null;
    const update = () => {
      const editorDomNode = editor.getDomNode();
      const target =
        (zoneNode.querySelector(".inline-vibe-action-pill") as HTMLElement) ||
        (zoneNode.querySelector(".inline-vibe-input-wrapper") as HTMLElement);
      if (!editorDomNode || !target) {
        setCoords(null);
        return;
      }

      const editorRect = editorDomNode.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (targetRect.width === 0 || targetRect.height === 0) {
        setCoords(null);
        return;
      }

      const boxX = targetRect.left - editorRect.left;
      const boxY = targetRect.top - editorRect.top + Math.min(17, targetRect.height / 2);
      const lineNumber = String(session.endLine);
      const digit = Array.from(editorDomNode.querySelectorAll(".line-numbers")).find(
        (element) => element.textContent?.trim() === lineNumber,
      );
      let startX: number;
      let startY: number;

      if (digit) {
        const digitRect = digit.getBoundingClientRect();
        startX = digitRect.left - editorRect.left + digitRect.width / 2;
        try {
          const range = document.createRange();
          range.selectNodeContents(digit);
          const textRect = range.getBoundingClientRect();
          if (textRect.width > 0 && textRect.width < digitRect.width * 0.9) {
            startX = textRect.left - editorRect.left + textRect.width / 2;
          } else {
            startX = digitRect.right - editorRect.left - 5 - (lineNumber.length * 8) / 2;
          }
        } catch {
          startX = digitRect.right - editorRect.left - 5 - (lineNumber.length * 8) / 2;
        }
        startY = digitRect.bottom - editorRect.top;
      } else {
        const layout = editor.getLayoutInfo();
        startX = layout.lineNumbersLeft + layout.lineNumbersWidth - 5 - (lineNumber.length * 8) / 2;
        const position = editor.getScrolledVisiblePosition({ lineNumber: session.endLine, column: 1 });
        const lineHeight = editor.getOption(monacoInstance.editor.EditorOption.lineHeight);
        startY = position
          ? position.top + position.height
          : editor.getTopForLineNumber(session.endLine) - editor.getScrollTop() + lineHeight;
      }

      setCoords((previous) => {
        if (
          previous &&
          Math.abs(previous.startX - startX) < 0.5 &&
          Math.abs(previous.startY - startY) < 0.5 &&
          Math.abs(previous.boxX - boxX) < 0.5 &&
          Math.abs(previous.boxY - boxY) < 0.5
        ) {
          return previous;
        }
        return { startX, startY, boxX, boxY };
      });
    };

    update();
    const scrollDisposable = editor.onDidScrollChange(update);
    const layoutDisposable = editor.onDidLayoutChange(update);
    const contentDisposable = editor.onDidChangeModelContent(update);
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(zoneNode);
    for (const selector of [".inline-vibe-portal-root", "textarea"]) {
      const element = zoneNode.querySelector(selector);
      if (element) resizeObserver.observe(element);
    }

    let frameCount = 0;
    const loop = () => {
      update();
      if (frameCount++ < 30) animationFrame = requestAnimationFrame(loop);
    };
    animationFrame = requestAnimationFrame(loop);

    return () => {
      scrollDisposable.dispose();
      layoutDisposable.dispose();
      contentDisposable.dispose();
      resizeObserver.disconnect();
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    };
  }, [editor, monacoInstance, session, zoneNode]);

  if (!coords) return null;
  const dropDistance = Math.max(10, coords.boxY - coords.startY);
  const controlY = coords.startY + dropDistance * 0.82;
  const turnRadius = Math.min(24, Math.max(12, (coords.boxX - coords.startX) * 0.35));
  const path = `M ${coords.startX} ${coords.startY} C ${coords.startX} ${controlY}, ${coords.boxX - turnRadius} ${coords.boxY}, ${coords.boxX} ${coords.boxY}`;

  return (
    <svg className="inline-vibe-connector-svg">
      <path d={path} className={`inline-vibe-connector-path ${loading ? "inline-vibe-connector-path--loading" : ""}`} />
    </svg>
  );
}
