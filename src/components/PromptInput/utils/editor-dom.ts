import type { EditorPart } from "../types.js";

const MAX_BREAKS = 200;

export function readEditorParts(root: HTMLElement): EditorPart[] {
  const parts: EditorPart[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) {
      parts.push({ type: "text", content: buffer });
      buffer = "";
    }
  };
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      buffer += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    if (element.dataset.type === "file") {
      flush();
      parts.push({
        type: "file",
        content: element.textContent ?? "",
        path: element.dataset.path,
        isDir: element.dataset.isDir === "true",
      });
      return;
    }
    if (element.tagName === "BR") {
      buffer += "\n";
      return;
    }

    const hasSyntax = element.querySelector(".prompt-input__md-syntax") !== null;
    const cl = element.classList;

    const prefix = !hasSyntax
      ? cl.contains("prompt-input__md-bold")
        ? "**"
        : cl.contains("prompt-input__md-italic")
          ? "*"
          : cl.contains("prompt-input__md-code")
            ? "`"
            : cl.contains("prompt-input__md-strike")
              ? "~~"
              : ""
      : "";

    const suffix = !hasSyntax
      ? cl.contains("prompt-input__md-bold")
        ? "**"
        : cl.contains("prompt-input__md-italic")
          ? "*"
          : cl.contains("prompt-input__md-code")
            ? "`"
            : cl.contains("prompt-input__md-strike")
              ? "~~"
              : cl.contains("prompt-input__md-link") && element.dataset.url
                ? `](${element.dataset.url})`
                : ""
      : "";

    if (!hasSyntax && cl.contains("prompt-input__md-link")) {
      buffer += "[";
    } else {
      buffer += prefix;
    }

    for (const child of Array.from(element.childNodes)) walk(child);
    buffer += suffix;
  };

  Array.from(root.childNodes).forEach((child, index, children) => {
    const isBlock = child.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes((child as HTMLElement).tagName);
    walk(child);
    if (isBlock && index < children.length - 1) buffer += "\n";
  });
  flush();

  const hasFileParts = parts.some((p) => p.type === "file");
  const textChars = parts.map((p) => p.content).join("").replace(/[\u200B\r\n\s]/g, "");
  if (!hasFileParts && textChars === "") {
    return [{ type: "text", content: "" }];
  }

  if (parts.length === 0) parts.push({ type: "text", content: "" });
  return parts;
}

export function createTextFragment(content: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let breaks = 0;
  for (const char of content) {
    if (char !== "\n") continue;
    breaks += 1;
    if (breaks > MAX_BREAKS) {
      const tail = content.endsWith("\n");
      const text = tail ? content.slice(0, -1) : content;
      if (text) fragment.appendChild(document.createTextNode(text));
      if (tail) fragment.appendChild(document.createElement("br"));
      return fragment;
    }
  }

  const segments = content.split("\n");
  segments.forEach((segment, index) => {
    if (segment) {
      fragment.appendChild(document.createTextNode(segment));
    }
    if (index < segments.length - 1) {
      fragment.appendChild(document.createElement("br"));
    }
  });
  return fragment;
}

export function getNodeLength(node: Node): number {
  if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === "BR") return 1;
  return (node.textContent ?? "").replace(/\u200B/g, "").length;
}

export function getTextLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/\u200B/g, "").length;
  if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === "BR") return 1;
  let length = 0;
  for (const child of Array.from(node.childNodes)) {
    length += getTextLength(child);
  }
  return length;
}

export function getCursorPosition(parent: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  if (!parent.contains(range.startContainer)) return 0;
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(parent);
  preCaretRange.setEnd(range.startContainer, range.startOffset);
  return getTextLength(preCaretRange.cloneContents());
}

export function getLeafNodes(parent: Node): Node[] {
  const leaves: Node[] = [];
  const walk = (node: Node) => {
    const isPill =
      node.nodeType === Node.ELEMENT_NODE &&
      ((node as HTMLElement).dataset.type === "file" || (node as HTMLElement).dataset.type === "agent");
    const isBreak = node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === "BR";
    if (node.nodeType === Node.TEXT_NODE || isPill || isBreak) {
      leaves.push(node);
      return;
    }
    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }
  };
  walk(parent);
  return leaves;
}

export function setCursorPosition(parent: HTMLElement, position: number) {
  let remaining = position;
  const leaves = getLeafNodes(parent);

  for (const node of leaves) {
    const length = getNodeLength(node);
    const isText = node.nodeType === Node.TEXT_NODE;
    const isPill =
      node.nodeType === Node.ELEMENT_NODE &&
      ((node as HTMLElement).dataset.type === "file" || (node as HTMLElement).dataset.type === "agent");
    const isBreak = node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === "BR";

    if (isText && remaining <= length) {
      const range = document.createRange();
      const selection = window.getSelection();
      range.setStart(node, remaining);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }

    if ((isPill || isBreak) && remaining <= length) {
      const range = document.createRange();
      const selection = window.getSelection();
      if (remaining === 0) {
        range.setStartBefore(node);
      }
      if (remaining > 0 && isPill) {
        range.setStartAfter(node);
      }
      if (remaining > 0 && isBreak) {
        const next = node.nextSibling;
        if (next && next.nodeType === Node.TEXT_NODE) {
          range.setStart(next, 0);
        }
        if (!next || next.nodeType !== Node.TEXT_NODE) {
          range.setStartAfter(node);
        }
      }
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }

    remaining -= length;
  }

  const fallbackRange = document.createRange();
  const fallbackSelection = window.getSelection();
  const last = leaves[leaves.length - 1];
  if (last && last.nodeType === Node.TEXT_NODE) {
    const len = last.textContent ? last.textContent.length : 0;
    fallbackRange.setStart(last, len);
  } else if (last) {
    fallbackRange.setStartAfter(last);
  } else {
    fallbackRange.selectNodeContents(parent);
  }
  fallbackRange.collapse(false);
  fallbackSelection?.removeAllRanges();
  fallbackSelection?.addRange(fallbackRange);
}

export function setRangeEdge(parent: HTMLElement, range: Range, edge: "start" | "end", offset: number) {
  let remaining = offset;
  const leaves = getLeafNodes(parent);

  for (const node of leaves) {
    const length = getNodeLength(node);
    const isText = node.nodeType === Node.TEXT_NODE;
    const isPill =
      node.nodeType === Node.ELEMENT_NODE &&
      ((node as HTMLElement).dataset.type === "file" || (node as HTMLElement).dataset.type === "agent");
    const isBreak = node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === "BR";

    if (isText && remaining <= length) {
      if (edge === "start") range.setStart(node, remaining);
      if (edge === "end") range.setEnd(node, remaining);
      return;
    }

    if ((isPill || isBreak) && remaining <= length) {
      if (edge === "start" && remaining === 0) range.setStartBefore(node);
      if (edge === "start" && remaining > 0) range.setStartAfter(node);
      if (edge === "end" && remaining === 0) range.setEndBefore(node);
      if (edge === "end" && remaining > 0) range.setEndAfter(node);
      return;
    }

    remaining -= length;
  }
}
