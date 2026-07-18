import React from "react";
import { FileIcon, FolderIcon } from "../Icons/file-icons.js";
import { getFileIcon } from "../Icons/utils.js";

interface FileTreeViewerProps {
  content: string;
}

function TreeGuide({ type }: { type: "I" | "T" | "L" | "empty" }) {
  const color = "var(--line-strong)";
  return (
    <div style={{ width: "20px", position: "relative", flexShrink: 0 }}>
      {type === "I" && (
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "1px", background: color }} />
      )}
      {type === "T" && (
        <>
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "1px", background: color }} />
          <div style={{ position: "absolute", left: "50%", right: 0, top: "50%", height: "1px", background: color }} />
        </>
      )}
      {type === "L" && (
        <>
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: "50%", width: "1px", background: color }} />
          <div style={{ position: "absolute", left: "50%", right: 0, top: "50%", height: "1px", background: color }} />
        </>
      )}
    </div>
  );
}

export function FileTreeViewer({ content }: FileTreeViewerProps): React.ReactElement {
  const lines = content.split("\n");
  const regex = /^([│\s├└─]*)([^#\n]+?)(?:\s+(#.*))?$/;

  const nodes = lines
    .map((line, idx) => {
      if (!line.trim()) return null;
      const match = line.match(regex);
      if (!match) return null;

      const prefix = match[1];
      const name = match[2].trim();
      const comment = match[3];
      const isFolder = name.endsWith("/");
      const depth = Math.floor(prefix.length / 4);

      const segments: ("I" | "T" | "L" | "empty")[] = [];
      for (let i = 0; i < depth; i++) {
        const chunk = prefix.slice(i * 4, i * 4 + 4);
        if (chunk.includes("├")) segments.push("T");
        else if (chunk.includes("└")) segments.push("L");
        else if (chunk.includes("│")) segments.push("I");
        else segments.push("empty");
      }

      const cleanName = isFolder ? name.slice(0, -1) : name;

      return (
        <div
          key={idx}
          style={{
            display: "flex",
            alignItems: "stretch",
            height: "26px",
            fontFamily: "var(--font-code, monospace)",
            fontSize: "13px",
            color: "var(--fg)",
          }}
        >
          {segments.map((type, i) => (
            <TreeGuide key={i} type={type} />
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", paddingLeft: "4px" }}>
            {isFolder ? (
              <FolderIcon open={true} name={cleanName} />
            ) : getFileIcon(cleanName) ? (
              <FileIcon name={cleanName} />
            ) : (
              <span className="inline-file">{cleanName}</span>
            )}
            <span>{cleanName}</span>
            {comment && (
              <span
                style={{
                  color: "var(--fg-dim)",
                  marginLeft: "8px",
                  fontStyle: "italic",
                  fontSize: "11px",
                  opacity: 0.7,
                  whiteSpace: "nowrap",
                }}
              >
                {comment}
              </span>
            )}
          </div>
        </div>
      );
    })
    .filter(Boolean);

  return (
    <div className="code-block" style={{ marginBottom: "16px", background: "transparent" }}>
      <div style={{ padding: "12px", overflowX: "auto" }}>{nodes}</div>
    </div>
  );
}
