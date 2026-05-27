import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import katex from "katex";
import "katex/dist/katex.min.css";
import { FileIcon, FolderIcon } from "../icons/file-icons.js";
import { getFileIcon } from "../icons/utils.js";
import { CodeBlock } from "../CodeBlock/CodeBlock.js";
import { TerminalCodeBlock } from "../TerminalCodeBlock/TerminalCodeBlock.js";

interface MarkdownProps {
  content: string;
  className?: string;
  isAssistant?: boolean;
  /** When true, fenced code blocks render as static <pre><code> instead of Monaco editors.
   * Use during streaming to avoid Monaco flickering/race conditions. */
  simplifiedCodeBlocks?: boolean;
  /** When true, file/folder references render without icons, as highlighted text */
  noFileIcons?: boolean;
}

const MathComponent = React.memo(({ value, displayMode }: { value: string; displayMode: boolean }) => {
  const html = React.useMemo(() => {
    try {
      return katex.renderToString(value, {
        displayMode,
        throwOnError: false,
      });
    } catch (e) {
      console.error("KaTeX error:", e);
      return value;
    }
  }, [value, displayMode]);

  return (
    <span className={displayMode ? "math-block" : "math-inline"} style={{ position: "relative", display: displayMode ? "block" : "inline-block" }}>
      {/* Hidden LaTeX source for copying */}
      <span
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: "0",
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: "0",
          userSelect: "all",
        }}
      >
        {displayMode ? `$$${value}$$` : `$${value}$`}
      </span>
      {/* Rendered math hidden from screen readers and non-selectable to prioritize LaTeX copy */}
      <span dangerouslySetInnerHTML={{ __html: html }} aria-hidden="true" style={{ userSelect: "none" }} />
    </span>
  );
});

export const Markdown = React.memo(function Markdown({ content, className, isAssistant, simplifiedCodeBlocks, noFileIcons }: MarkdownProps) {
  // Pre-process content to convert \( \) to $ $ and \[ \] to $$ $$
  // also handle potential missing backslashes if it looks like math blocks
  const processedContent = React.useMemo(() => {
    if (!content) return "";
    let text = content
      .replace(/\\\((.*?)\\\)/g, "$$ $1 $$")
      .replace(/\\\[([\s\S]*?)\\\]/g, "$$ $1 $$")
      // Handle the case where the model might output [ ] instead of \[ \] for math blocks
      .replace(/(^|\n)\[\s*([\s\S]*?\\frac[\s\S]*?)\s*\](\n|$)/g, "$1$$$$ $2 $$$$$3");

    // Split into code-block segments and non-code segments.
    // Even indices = outside code, odd indices = inside code (fenced or inline).
    const codeParts = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g);

    const fileExtensions = "tsx|ts|jsx|js|py|css|scss|html|json|md|mdx|yaml|yml|sh|dockerfile|env|toml|sql|png|jpg|jpeg|svg|ico|pdf|doc|docx|rb|go|rs|c|cpp|h|hpp|java|kt|lua|php|xml|txt|lock|exe|bin|patch|diff";

    const isFileRef = (line: string): boolean => {
      const t = line.trim();
      if (!t) return false;
      if (new RegExp(`\\.(?:${fileExtensions})$`).test(t)) return true;
      if (/^\.[\w\-.]+$/.test(t)) return true;
      if (/^(LICENSE|COPYING|Dockerfile|Procfile|Makefile|README)$/i.test(t)) return true;
      if (/^[\w\-.]+(?:\/)$/.test(t)) return true;
      if (/^[\w\-.][\w\-./]*[\w\-.]+$/.test(t) && t.includes("/") && t.split("/").every(s => /^[\w\-.]+$/.test(s))) return true;
      return false;
    };

    const processedParts = codeParts.map((part, i) => {
      if (i % 2 === 1) {
        // Check if this is a fenced code block without language that looks like a file listing
        const fenceMatch = part.match(/^```\n?([\s\S]*?)```$/);
        if (fenceMatch) {
          const inner = fenceMatch[1].trimEnd();
          const lines = inner.split("\n").map(l => l.trim()).filter(Boolean);
          if (lines.length > 0 && lines.every(isFileRef)) {
            return lines.map(line => {
              if (line.endsWith("/")) return `[${line}](#folder)`;
              return `[${line}](#file)`;
            }).join("\n") + "\n";
          }
        }
        return part;
      }

      if (!isAssistant) {
        // Logic for User: ONLY mentions starting with @
        const userFileRegex = new RegExp(`@([\\w\\-./]+\\.(?:${fileExtensions}))`, "g");
        part = part.replace(userFileRegex, "[@$1](#file)");
        const userFolderRegex = /@((?:Folder:)?[\w\-./]+\/|(?:Folder:)?[\w\-./]+(?=\s+folder|Folder|$))/g;
        part = part.replace(userFolderRegex, "[@$1](#folder)");
        return part;
      }

      // Logic for Assistant: Standalone files/folders or explicitly labeled
      // 1. Files at the start of a line or after a bullet point: "- App.tsx" or "App.tsx"
      const lineStartFileRegex = new RegExp(`(^|\\n)([\\t ]*(?:[-*+]|[0-9]+\\.)?[\\t ]*)([\\w\\-./]+\\.(?:${fileExtensions}))(?=\\b|\\s|$)`, "g");
      part = part.replace(lineStartFileRegex, "$1$2[$3](#file)");

      // 2. Dotfiles at the start of a line or after a bullet: ".gitignore", ".env"
      const lineStartDotfileRegex = /(^|\n)([\t ]*(?:[-*+]|[0-9]+\.)?[\t ]*)(\.[\w\-.]+)(?!\/)(?=\b|\s|$)/g;
      part = part.replace(lineStartDotfileRegex, "$1$2[$3](#file)");

      // 3. Extensionless well-known files at start of line: "LICENSE", "Dockerfile", etc.
      const extlessFileRegex = /(^|\n)([\t ]*(?:[-*+]|[0-9]+\.)?[\t ]*)(LICENSE|COPYING|Dockerfile|Procfile)(?=\b|\s|$)/gi;
      part = part.replace(extlessFileRegex, "$1$2[$3](#file)");

      // 4. Explicitly labeled folders: "Folder: path" (at the start of a line or after a bullet)
      const explicitFolderRegex = new RegExp(`(^|\\n)([\\t ]*(?:[-*+]|[0-9]+\\.)?[\\t ]*(?:Folder|folder):\\s*)([\\w\\-./]+)(?=\\b|\\s|$)`, "g");
      part = part.replace(explicitFolderRegex, "$1$2[$3](#folder)");

      // 5. Standalone paths ending with /: "renderer/components/" (at the start of a line or after a bullet)
      const standaloneFolderRegex = new RegExp(`(^|\\n)([\\t ]*(?:[-*+]|[0-9]+\\.)?[\\t ]*)([\\w\\-.]+\\/)(?=\\b|\\s|$)`, "g");
      part = part.replace(standaloneFolderRegex, "$1$2[$3](#folder)");

      return part;
    });

    return processedParts.join("");
  }, [content, isAssistant]);

  return (
    <div className={"markdown-body " + (className || "")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[]}
        components={({
          math({ value, children }: any) {
            return <MathComponent value={value || (Array.isArray(children) ? children[0] : children)} displayMode={true} />;
          },
          inlineMath({ value, children }: any) {
            return <MathComponent value={value || (Array.isArray(children) ? children[0] : children)} displayMode={false} />;
          },
          a({ node, children, href, ...props }: any) {
            if (href === "#file") {
              const rawName = String(children);
              const name = rawName.startsWith("@") ? rawName.slice(1) : rawName;
              const icon = getFileIcon(name);
              if (icon) {
                if (noFileIcons) {
                  return <span className="inline-file" style={{ color: "var(--fg)" }}>{children}</span>;
                }
                return (
                  <span
                    className="inline-file"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      verticalAlign: "middle",
                      color: "inherit",
                    }}
                  >
                    <FileIcon name={name} />
                    {children}
                  </span>
                );
              }
              return noFileIcons ? <span style={{ color: "var(--fg)" }}>{children}</span> : <span>{children}</span>;
            }
            if (href === "#folder") {
              const rawName = String(children);
              const name = rawName.startsWith("@") ? rawName.slice(1) : rawName;
              const folderName = name.replace(/^Folder:/, "").replace(/\/$/, "");
              if (noFileIcons) {
                return <span className="inline-folder" style={{ color: "var(--fg)" }}>{children}</span>;
              }
              return (
                <span
                  className="inline-folder"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    verticalAlign: "middle",
                    color: "inherit",
                  }}
                >
                  <FolderIcon open={false} name={folderName} />
                  {children}
                </span>
              );
            }
            return (
              <a href={href} {...props}>
                {children}
              </a>
            );
          },
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const content = String(children).replace(/\n$/, "");
            const isInline = !match && !content.includes("\n");
            const lang = match ? match[1] : "";

            if (lang === "math") {
              return <MathComponent value={content} displayMode={true} />;
            }

            if (isInline && isAssistant) {
              const fileIcon = getFileIcon(content);
              const isFolder = content.endsWith("/");
              const isPath = content.includes("/") || content.includes("\\");
              // Skip file icon for API endpoints, URLs, and template placeholders
              const isApiOrUrl = /[{}]/.test(content) || /^https?:\/\//.test(content) || /^(POST|GET|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s/.test(content);
              if ((fileIcon || isFolder || isPath) && !isApiOrUrl) {
                if (noFileIcons) {
                  return <span style={{ color: "var(--fg)" }}>{children}</span>;
                }
                const folderName = isFolder || (!fileIcon && isPath)
                  ? content.replace(/[\\/]$/, "").split(/[\\/]/).pop() || ""
                  : "";
                return (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      verticalAlign: "middle",
                      color: "inherit",
                    }}
                  >
                    {isFolder || (!fileIcon && isPath) ? (
                      <FolderIcon open={false} name={folderName} />
                    ) : (
                      <FileIcon name={content} />
                    )}
                    {children}
                  </span>
                );
              }
            }

            if (!isInline && simplifiedCodeBlocks) {
              const displayLang = lang || "code";
              return (
                <div className="code-block">
                  <div className="code-block__header">
                    <span className="code-block__header-left">
                      <FileIcon name={displayLang} />
                      <span className="code-block__lang">{displayLang}</span>
                    </span>
                  </div>
                  <div className="code-block__body">
                    <pre className="code-block__pre">
                      <code className="code-block__code">{content}</code>
                    </pre>
                  </div>
                </div>
              );
            }

            const shellLangs = ["powershell", "shell", "bash", "zsh", "ps1", "pwsh", "cmd", "bat"];
            if (!isInline && match && shellLangs.includes(match[1])) {
              const lines = content.split("\n");
              const hasCommand = lines.some(line => {
                const trimmed = line.trim();
                return trimmed !== "" && !trimmed.startsWith("#") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
              });

              if (hasCommand) {
                return <TerminalCodeBlock language={match[1]} code={content} />;
              }
            }

            return !isInline ? (
              <CodeBlock language={match ? match[1] : ""} code={content} />
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        } as any)}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});
