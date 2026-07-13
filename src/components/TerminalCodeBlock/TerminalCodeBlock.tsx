import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { CopyIcon, TerminalIcon, RunIcon, InsertTerminalIcon } from "../icons/icons.js";
import { useTerminalActions } from "../../hooks/useTerminalActions.js";
import { useI18n } from "../../hooks/useI18n.js";
import { Tooltip } from "../Tooltip/Tooltip.js";
import "../../styles/TerminalCodeBlock.css";

interface TerminalCodeBlockProps {
  language: string;
  code: string;
}

// Campbell theme colors
const campbellTheme = {
  'code[class*="language-"]': {
    color: "#CCCCCC",
    background: "#1c1c1c",
    fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
    fontSize: "12px",
    lineHeight: "1.3",
    textAlign: "left" as const,
    whiteSpace: "pre-wrap" as const,
    wordSpacing: "normal",
    wordBreak: "normal" as const,
    wordWrap: "normal" as const,
    tabSize: 2,
  },
  'pre[class*="language-"]': {
    color: "#CCCCCC",
    background: "#1c1c1c",
    fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
    fontSize: "12px",
    lineHeight: "1.3",
    textAlign: "left" as const,
    whiteSpace: "pre-wrap" as const,
    wordSpacing: "normal",
    wordBreak: "normal" as const,
    wordWrap: "normal" as const,
    tabSize: 2,
    margin: 0,
    padding: "6px 12px 6px 16px",
    overflow: "visible" as const,
  },
  comment: { color: "#13A10E" },
  prolog: { color: "#13A10E" },
  doctype: { color: "#13A10E" },
  cdata: { color: "#13A10E" },
  punctuation: { color: "#CCCCCC" },
  property: { color: "#3A96DD" },
  tag: { color: "#C19C00" },
  boolean: { color: "#F9F1A5" },
  number: { color: "#F9F1A5" },
  constant: { color: "#F9F1A5" },
  symbol: { color: "#F9F1A5" },
  deleted: { color: "#C50F1F" },
  selector: { color: "#C19C00" },
  "attr-name": { color: "#3A96DD" },
  string: { color: "#13A10E" },
  char: { color: "#13A10E" },
  builtin: { color: "#C19C00", fontWeight: "bold" },
  inserted: { color: "#13A10E" },
  operator: { color: "#CCCCCC" },
  entity: { color: "#3B78FF" },
  url: { color: "#3B78FF" },
  variable: { color: "#3B78FF" },
  atrule: { color: "#3A96DD" },
  "attr-value": { color: "#13A10E" },
  function: { color: "#C19C00", fontWeight: "bold" },
  "class-name": { color: "#C19C00", fontWeight: "bold" },
  keyword: { color: "#881798" },
  regex: { color: "#13A10E" },
  important: { color: "#C50F1F", fontWeight: "bold" },
};

export const TerminalCodeBlock = React.memo(function TerminalCodeBlock({ language, code }: TerminalCodeBlockProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const { runCommand, insertCommand } = useTerminalActions();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayName = language === "powershell" ? "PowerShell" : t("terminal");
  const syntaxLang = language === "powershell" ? "powershell" : "bash";

  return (
    <div className="terminal-code-block">
      <div className="terminal-code-block__header">
        <div className="terminal-code-block__title">
          <TerminalIcon />
          <span className="terminal-code-block__title-text">{displayName}</span>
        </div>
        <div className="terminal-code-block__actions">
          <Tooltip text={t("copy")}>
            <button className="terminal-code-block__btn" onClick={handleCopy}>
              {copied ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--green)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <CopyIcon />
              )}
            </button>
          </Tooltip>
          <Tooltip text={t("insertTerminal")}>
            <button className="terminal-code-block__btn" onClick={() => insertCommand(code)}>
              <InsertTerminalIcon />
            </button>
          </Tooltip>
          <Tooltip text={t("runCommand")}>
            <button className="terminal-code-block__btn" onClick={() => runCommand(code)}>
              <RunIcon />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="terminal-code-block__content">
        <SyntaxHighlighter
          language={syntaxLang}
          style={campbellTheme}
          customStyle={{ margin: 0, padding: "8px 12px 8px 16px", background: "transparent" }}
        >
          {code.trim()}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});
