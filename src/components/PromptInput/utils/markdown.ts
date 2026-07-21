/**
 * Markdown rendering utility for PromptInput.
 * Renders rich Markdown syntax in the contenteditable prompt input.
 * Headings # and ## are kept at standard font size (14px) so the input box layout remains clean.
 */

const MAX_BREAKS = 200;

export interface MarkdownOptions {
  showSyntaxMarkers?: boolean;
}

function createSyntaxSpan(text: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "prompt-input__md-syntax";
  span.textContent = text;
  return span;
}

function parseInlineMarkdown(text: string, target: Node, options?: MarkdownOptions) {
  if (!text) return;
  const showSyntax = options?.showSyntaxMarkers ?? false;

  const INLINE_RE =
    /(`[^`\n]+`)|(\*\*[^*]+\*\*|__[^_]+__)|((?:\b|_)\*[^*]+\*|\b_[^_]+_)|(~~[^~]+~~|~[^~]+~)|(\[[^\]]+\]\([^)]+\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      target.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const [fullMatch, code, bold, italic, strike, link] = match;

    if (code) {
      const content = code.slice(1, -1);
      const codeEl = document.createElement("code");
      codeEl.className = "prompt-input__md-code";
      if (showSyntax) codeEl.appendChild(createSyntaxSpan("`"));
      codeEl.appendChild(document.createTextNode(content));
      if (showSyntax) codeEl.appendChild(createSyntaxSpan("`"));
      target.appendChild(codeEl);
    } else if (bold) {
      const sym = bold.startsWith("**") ? "**" : "__";
      const content = bold.slice(sym.length, -sym.length);
      const span = document.createElement("span");
      span.className = "prompt-input__md-bold";
      if (showSyntax) span.appendChild(createSyntaxSpan(sym));
      parseInlineMarkdown(content, span, options);
      if (showSyntax) span.appendChild(createSyntaxSpan(sym));
      target.appendChild(span);
    } else if (italic) {
      const sym = italic.startsWith("*") ? "*" : "_";
      const content = italic.slice(sym.length, -sym.length);
      const span = document.createElement("span");
      span.className = "prompt-input__md-italic";
      if (showSyntax) span.appendChild(createSyntaxSpan(sym));
      parseInlineMarkdown(content, span, options);
      if (showSyntax) span.appendChild(createSyntaxSpan(sym));
      target.appendChild(span);
    } else if (strike) {
      const sym = strike.startsWith("~~") ? "~~" : "~";
      const content = strike.slice(sym.length, -sym.length);
      const span = document.createElement("span");
      span.className = "prompt-input__md-strike";
      if (showSyntax) span.appendChild(createSyntaxSpan(sym));
      parseInlineMarkdown(content, span, options);
      if (showSyntax) span.appendChild(createSyntaxSpan(sym));
      target.appendChild(span);
    } else if (link) {
      const linkMatch = fullMatch.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const linkText = linkMatch[1] ?? "";
        const linkUrl = linkMatch[2] ?? "";
        const span = document.createElement("span");
        span.className = "prompt-input__md-link";
        span.setAttribute("data-url", linkUrl);
        if (showSyntax) span.appendChild(createSyntaxSpan("["));
        parseInlineMarkdown(linkText, span, options);
        if (showSyntax) span.appendChild(createSyntaxSpan(`](${linkUrl})`));
        target.appendChild(span);
      } else {
        target.appendChild(document.createTextNode(fullMatch));
      }
    } else {
      target.appendChild(document.createTextNode(fullMatch));
    }

    lastIndex = INLINE_RE.lastIndex;
  }

  if (lastIndex < text.length) {
    target.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

export function createMarkdownFragment(content: string, options?: MarkdownOptions): DocumentFragment {
  const fragment = document.createDocumentFragment();
  if (!content) return fragment;

  const showSyntax = options?.showSyntaxMarkers ?? false;

  let breaks = 0;
  for (const char of content) {
    if (char === "\n") breaks++;
  }

  if (breaks > MAX_BREAKS) {
    const segments = content.split("\n");
    segments.forEach((segment, index) => {
      if (segment) fragment.appendChild(document.createTextNode(segment));
      if (index < segments.length - 1) fragment.appendChild(document.createElement("br"));
    });
    return fragment;
  }

  const lines = content.split("\n");
  let inCodeBlock = false;
  let codeBlockEl: HTMLSpanElement | null = null;

  lines.forEach((line, index) => {
    const codeBlockMatch = line.match(/^```(\w*)$/);

    if (codeBlockMatch) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockEl = document.createElement("span");
        codeBlockEl.className = "prompt-input__md-codeblock";
        const lang = codeBlockMatch[1] ?? "";
        if (showSyntax) codeBlockEl.appendChild(createSyntaxSpan("```" + lang));
        if (index < lines.length - 1) codeBlockEl.appendChild(document.createElement("br"));
      } else {
        inCodeBlock = false;
        if (codeBlockEl) {
          if (showSyntax) codeBlockEl.appendChild(createSyntaxSpan("```"));
          fragment.appendChild(codeBlockEl);
          codeBlockEl = null;
        }
        if (index < lines.length - 1) fragment.appendChild(document.createElement("br"));
      }
      return;
    }

    if (inCodeBlock && codeBlockEl) {
      codeBlockEl.appendChild(document.createTextNode(line));
      if (index < lines.length - 1) codeBlockEl.appendChild(document.createElement("br"));
      return;
    }

    // Heading check
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const hashes = headingMatch[1]!;
      const titleText = headingMatch[2]!;
      const level = hashes.length;

      const span = document.createElement("span");
      if (level <= 2) {
        span.className = "prompt-input__md-h-plain";
      } else {
        span.className = `prompt-input__md-h${level}`;
      }

      if (showSyntax) span.appendChild(createSyntaxSpan(hashes + " "));
      parseInlineMarkdown(titleText, span, options);
      fragment.appendChild(span);

      if (index < lines.length - 1) fragment.appendChild(document.createElement("br"));
      return;
    }

    // Blockquote check
    const blockquoteMatch = line.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      const quoteText = blockquoteMatch[1]!;
      const span = document.createElement("span");
      span.className = "prompt-input__md-blockquote";
      if (showSyntax) span.appendChild(createSyntaxSpan("> "));
      parseInlineMarkdown(quoteText, span, options);
      fragment.appendChild(span);

      if (index < lines.length - 1) fragment.appendChild(document.createElement("br"));
      return;
    }

    // Horizontal rule check
    if (/^(?:---|\*\*\*|___)\s*$/.test(line)) {
      const span = document.createElement("span");
      span.className = "prompt-input__md-hr";
      if (showSyntax) span.appendChild(createSyntaxSpan(line));
      fragment.appendChild(span);

      if (index < lines.length - 1) fragment.appendChild(document.createElement("br"));
      return;
    }

    // List item check
    const listMatch = line.match(/^([-*+]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const bullet = listMatch[1]!;
      const itemText = listMatch[2]!;
      const span = document.createElement("span");
      span.className = "prompt-input__md-list-item";
      span.setAttribute("data-bullet", bullet + " ");
      if (showSyntax) span.appendChild(createSyntaxSpan(bullet + " "));
      parseInlineMarkdown(itemText, span, options);
      fragment.appendChild(span);

      if (index < lines.length - 1) fragment.appendChild(document.createElement("br"));
      return;
    }

    // Paragraph line
    if (line) {
      const span = document.createElement("span");
      parseInlineMarkdown(line, span, options);
      fragment.appendChild(span);
    }

    if (index < lines.length - 1) {
      fragment.appendChild(document.createElement("br"));
    }
  });

  if (inCodeBlock && codeBlockEl) {
    fragment.appendChild(codeBlockEl);
  }

  return fragment;
}
