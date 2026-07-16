import React from "react";
import { LANG_KEYWORDS } from "./searchLanguages.js";

// Re-export getLanguageFromFilename and LANG_KEYWORDS for backwards compatibility
export { getLanguageFromFilename, LANG_KEYWORDS } from "./searchLanguages.js";

// ── LRU cache for syntax highlighting ──

export class LRU<K, V> {
  private max: number;
  private map = new Map<K, V>();
  constructor(max: number) {
    this.max = max;
  }
  get(key: K): V | undefined {
    const val = this.map.get(key);
    if (val !== undefined) {
      this.map.delete(key);
      this.map.set(key, val);
    }
    return val;
  }
  set(key: K, val: V) {
    this.map.delete(key);
    this.map.set(key, val);
    if (this.map.size > this.max) {
      const first = this.map.keys().next().value;
      if (first !== undefined) this.map.delete(first);
    }
  }
}

// ── Syntax highlighting & tokenization ──

export interface Token {
  text: string;
  className: string;
}

export function tokenizeLine(line: string, lang: string): Token[] {
  const tokens: Token[] = [];
  const keywords = LANG_KEYWORDS[lang] ?? [];
  let i = 0;
  while (i < line.length) {
    const strMatch = line.slice(i).match(/^'[^']*'|^"[^"]*"|^`[^`]*`/);
    if (strMatch) {
      tokens.push({ text: strMatch[0], className: "sc-token-string" });
      i += strMatch[0].length;
      continue;
    }
    if (line[i] === "/" && (line[i + 1] === "/" || line[i + 1] === "*")) {
      tokens.push({ text: line.slice(i), className: "sc-token-comment" });
      break;
    }
    const numMatch = line.slice(i).match(/^\d+(\.\d+)?/);
    if (numMatch) {
      tokens.push({ text: numMatch[0], className: "sc-token-number" });
      i += numMatch[0].length;
      continue;
    }
    const wordMatch = line.slice(i).match(/^[a-zA-Z_$][\w$]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      if (keywords.includes(word)) {
        tokens.push({ text: word, className: "sc-token-keyword" });
      } else {
        tokens.push({ text: word, className: "sc-token-identifier" });
      }
      i += word.length;
      continue;
    }
    if (/\s/.test(line[i])) {
      let ws = "";
      while (i < line.length && /\s/.test(line[i])) {
        ws += line[i];
        i++;
      }
      tokens.push({ text: ws, className: "sc-token-ws" });
      continue;
    }
    tokens.push({ text: line[i], className: "sc-token-punctuation" });
    i++;
  }
  return tokens;
}

export function syntaxHighlightLine(line: string, lang: string, query: string, matchCase: boolean): React.ReactNode[] {
  const tokens = tokenizeLine(line, lang);
  let key = 0;
  if (!query) {
    return tokens.map((token) => React.createElement("span", { key: key++, className: token.className }, token.text));
  }
  const result: React.ReactNode[] = [];
  const q = matchCase ? query : query.toLowerCase();
  for (const token of tokens) {
    const txt = matchCase ? token.text : token.text.toLowerCase();
    let lastIdx = 0;
    let idx = txt.indexOf(q, 0);
    if (idx < 0) {
      result.push(React.createElement("span", { key: key++, className: token.className }, token.text));
      continue;
    }
    const parts: React.ReactNode[] = [];
    while (idx >= 0) {
      if (idx > lastIdx) {
        parts.push(
          React.createElement(
            "span",
            { key: `t${lastIdx}`, className: token.className },
            token.text.slice(lastIdx, idx),
          ),
        );
      }
      parts.push(
        React.createElement(
          "mark",
          { key: `m${idx}`, className: "sc-match-highlight" },
          token.text.slice(idx, idx + query.length),
        ),
      );
      lastIdx = idx + query.length;
      idx = txt.indexOf(q, lastIdx);
    }
    if (lastIdx < token.text.length) {
      parts.push(
        React.createElement("span", { key: `t${lastIdx}`, className: token.className }, token.text.slice(lastIdx)),
      );
    }
    result.push(React.createElement("span", { key: key++ }, parts));
  }
  return result;
}

const highlightCache = new LRU<string, React.ReactNode[]>(5000);

export function getCachedHighlight(line: string, lang: string, query: string, matchCase: boolean): React.ReactNode[] {
  const key = `${line}\x00${lang}\x00${query}\x00${matchCase}`;
  const cached = highlightCache.get(key);
  if (cached) return cached;
  const result = syntaxHighlightLine(line, lang, query, matchCase);
  highlightCache.set(key, result);
  return result;
}
