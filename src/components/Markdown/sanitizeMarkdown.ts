/**
 * Utility for sanitizing and repairing markdown content before processing and rendering.
 * Protects against unclosed code blocks, odd/stray backticks (from token drops or partial streaming),
 * unclosed math formulas, and unbalanced tags.
 */

const FENCED_OPEN_RE = /^[ \t]*```([\w-]*)[ \t]*$/;
const FENCED_CLOSE_RE = /^[ \t]*```[ \t]*$/;

/**
 * Sanitizes markdown string to ensure AST parity and prevent rendering corruption.
 * @param content Raw markdown string from LLM or history
 * @param isStreaming Whether this message is actively streaming (in which case incomplete spans are closed dynamically at EOF)
 */
export function sanitizeMarkdown(content: string, isStreaming = false): string {
  if (!content) return "";

  const lines = content.split("\n");
  const resultLines: string[] = [];
  let inFencedBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const isLastLine = i === lines.length - 1;

    // Check fenced code block boundaries
    if (!inFencedBlock) {
      const openMatch = line.match(FENCED_OPEN_RE);
      // Also check if line starts with ``` even if there's trailing text on same line during odd outputs
      if (openMatch || (line.trim().startsWith("```") && line.trim().length >= 3)) {
        if (openMatch) {
          inFencedBlock = true;
          resultLines.push(line);
          continue;
        } else if (line.trim().startsWith("```")) {
          // If ``` is on a line with other things (e.g. ```ts const x = 1; ``` or just ```ts const x = 1;)
          const backtickCount = (line.match(/```/g) || []).length;
          if (backtickCount % 2 === 1) {
            inFencedBlock = true;
          }
          resultLines.push(line);
          continue;
        }
      }
    } else {
      // We are inside a fenced code block
      if (FENCED_CLOSE_RE.test(line) || line.trim() === "```") {
        inFencedBlock = false;
        resultLines.push(line);
        continue;
      }
      resultLines.push(line);
      continue;
    }

    // We are outside fenced code blocks: sanitize inline backticks and unclosed tags on this line
    const sanitizedLine = sanitizeLineParity(line, isStreaming && isLastLine);
    resultLines.push(sanitizedLine);
  }

  // If we ended while still inside a fenced code block
  if (inFencedBlock) {
    resultLines.push("```");
  }

  let finalContent = resultLines.join("\n");

  // Balance unclosed <file> or <folder> tags across the whole text if needed
  finalContent = balanceTags(finalContent, "file");
  finalContent = balanceTags(finalContent, "folder");

  return finalContent;
}

/**
 * Sanitizes single/double backtick parity on a line outside fenced code blocks.
 */
function sanitizeLineParity(line: string, isActiveStreamingLine: boolean): string {
  if (!line || !line.includes("`")) return line;

  // Smart recovery for unclosed **`word or *`word dropped by LLM before space/punctuation/EOL
  // E.g., `**\`search_codebase кодовой базе` -> `**\`search_codebase\`** кодовой базе`
  line = line.replace(/(\*\*`|\*`)([\w\-./+]+)(?=\s|[^\w\-./+`*]|$)/g, (match, prefix, word, offset, fullStr) => {
    const afterSpan = fullStr.slice(offset + prefix.length + word.length);
    if (!afterSpan.startsWith("`")) {
      const closing = prefix.startsWith("**") ? "`**" : "`*";
      return `${prefix}${word}${closing}`;
    }
    return match;
  });

  // Find all non-escaped backtick sequences on the line
  const matches: { index: number; text: string }[] = [];
  const re = /(?<!\\)(`+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    matches.push({ index: m.index, text: m[1] ?? "`" });
  }

  if (matches.length === 0) return line;

  // If even number of backtick spans, e.g. (`COLORS`) or `foo` and `bar`, parity is balanced!
  if (matches.length % 2 === 0) {
    return line;
  }

  // Odd number of backtick spans!
  // Case 1: Actively streaming the very last line (`isStreaming && isLastLine`) -> auto-close at end of line
  if (isActiveStreamingLine) {
    const lastMatch = matches[matches.length - 1]!;
    return line + lastMatch.text;
  }

  // Case 2: Past line or finished message where token drop or truncation left an unpaired backtick.
  // To prevent the unpaired backtick from swallowing the rest of the line (or document) into inline code,
  // we escape the unpaired backtick using &#96; or \`.
  // If matches.length === 1 (e.g. `путь к `chтного`), the only backtick is unpaired.
  // If matches.length >= 3 (e.g. `Алгоритм `pick_color`: простая хеш = h * 31 + byte` — ...`),
  // matches[0] and [1] pair up (`pick_color`), leaving matches[matches.length - 1] unpaired!
  const unpairedIndex = matches[matches.length - 1]!.index;
  const unpairedLen = matches[matches.length - 1]!.text.length;

  const before = line.slice(0, unpairedIndex);
  const after = line.slice(unpairedIndex + unpairedLen);
  const escapedBackticks = "&#96;".repeat(unpairedLen);

  return before + escapedBackticks + after;
}

/**
 * Balances unclosed custom XML/HTML tags like <file> and <folder>
 */
function balanceTags(text: string, tagName: string): string {
  const openRe = new RegExp(`<${tagName}>`, "g");
  const closeRe = new RegExp(`</${tagName}>`, "g");
  const openCount = (text.match(openRe) || []).length;
  const closeCount = (text.match(closeRe) || []).length;

  if (openCount > closeCount) {
    return text + `</${tagName}>`.repeat(openCount - closeCount);
  }
  return text;
}
