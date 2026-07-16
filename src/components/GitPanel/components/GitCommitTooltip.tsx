import React from "react";
import { Markdown } from "../../Markdown/Markdown.js";
import { formatRelativeTime } from "../utils/commitGraphUtils.js";
import type { CommitGraphNode, CommitFile } from "../types.js";

export interface GitCommitTooltipProps {
  hoveredCommit: CommitGraphNode;
  tooltipPosition: {
    x: number;
    y: number;
    align?: "left" | "right";
    targetLeft?: number;
    targetRight?: number;
  };
  tooltipRef: React.RefObject<HTMLDivElement>;
  currentBranch: string;
  commitFilesMap: Record<string, CommitFile[]>;
  onTooltipEnter: () => void;
  onTooltipLeave: () => void;
  onSelectCommit: (commit: CommitGraphNode) => void;
}

export function GitCommitTooltip({
  hoveredCommit,
  tooltipPosition,
  tooltipRef,
  currentBranch,
  commitFilesMap,
  onTooltipEnter,
  onTooltipLeave,
  onSelectCommit,
}: GitCommitTooltipProps) {
  return (
    <div
      ref={tooltipRef}
      className="scm-commit-tooltip"
      style={{
        position: "fixed",
        left: tooltipPosition.x,
        top: tooltipPosition.y,
        zIndex: 99999,
      }}
      onMouseEnter={onTooltipEnter}
      onMouseLeave={onTooltipLeave}
    >
      <div
        className="scm-commit-tooltip-scrollable"
        onWheel={(e) => {
          e.stopPropagation();
        }}
      >
        {/* Block 1: Author & Commit Message */}
        <div className="scm-commit-tooltip-author">
          {hoveredCommit.authorAvatar || (!hoveredCommit.author.trim().includes(" ") && hoveredCommit.author.trim()) ? (
            <img
              src={hoveredCommit.authorAvatar || `https://github.com/${hoveredCommit.author.trim()}.png?size=40`}
              alt={hoveredCommit.author}
              referrerPolicy="no-referrer"
              style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
                if (e.currentTarget.nextElementSibling) {
                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = "inline-flex";
                }
              }}
            />
          ) : null}
          <span
            style={{
              display:
                hoveredCommit.authorAvatar ||
                (!hoveredCommit.author.trim().includes(" ") && hoveredCommit.author.trim())
                  ? "none"
                  : "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="codicon codicon-account" style={{ fontSize: 16 }}></i>
          </span>
          {hoveredCommit.authorEmail ? (
            <a
              href={`mailto:${hoveredCommit.authorEmail}`}
              className="scm-commit-tooltip-author-name"
              onClick={(e) => e.stopPropagation()}
            >
              <span>{hoveredCommit.author}</span>
            </a>
          ) : (
            <span className="scm-commit-tooltip-author-name">{hoveredCommit.author}</span>
          )}
          <span className="scm-commit-tooltip-author-meta">
            <span>,</span>
            <i className="codicon codicon-history" style={{ fontSize: 13, opacity: 0.85 }}></i>
            <span>
              {formatRelativeTime(hoveredCommit.time)} (
              {new Date(hoveredCommit.time * 1000).toLocaleString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "numeric",
              })}
              )
            </span>
          </span>
        </div>

        <div className="commit-tooltip-markdown">
          <Markdown content={hoveredCommit.message.replace(/\r\n|\r|\n/g, "\n\n")} simplifiedCodeBlocks={true} />
        </div>

        {/* Block 1.5: Branches & Refs tags */}
        {(hoveredCommit.refNames.length > 0 || hoveredCommit.isHead) && (
          <div
            className="scm-commit-tooltip-branches"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
              marginTop: 10,
              marginBottom: 2,
            }}
          >
            {hoveredCommit.isHead && (
              <span
                className="scm-ref-pill head"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 8px",
                  fontSize: 11,
                  borderRadius: 10,
                  backgroundColor: "var(--vscode-badge-background, #4d4d4d)",
                  color: "var(--vscode-badge-foreground, #ffffff)",
                  border: "1px solid var(--vscode-editorHoverWidget-border, rgba(255,255,255,0.2))",
                  wordBreak: "break-all",
                }}
              >
                <i
                  className="codicon codicon-target"
                  style={{ fontSize: 12, marginRight: 4, color: "#68d391", flexShrink: 0 }}
                ></i>
                <span>{currentBranch} (HEAD)</span>
              </span>
            )}
            {hoveredCommit.refNames.map((ref) => {
              if (ref.includes(currentBranch) && hoveredCommit.isHead) return null;
              const isRemote = ref.startsWith("origin/") || ref.includes("/");
              return (
                <span
                  key={ref}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 8px",
                    fontSize: 11,
                    borderRadius: 10,
                    backgroundColor: isRemote ? "rgba(183, 148, 244, 0.15)" : "rgba(99, 179, 237, 0.15)",
                    color: isRemote ? "#d6bcfa" : "#90cdf4",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    wordBreak: "break-all",
                  }}
                >
                  <i className="codicon codicon-git-branch" style={{ fontSize: 12, marginRight: 4, flexShrink: 0 }}></i>
                  <span>{ref}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Block 2: Short stats (when files loaded) */}
        {commitFilesMap[hoveredCommit.id] &&
          (() => {
            const filesCount = commitFilesMap[hoveredCommit.id].length;
            const insertions = commitFilesMap[hoveredCommit.id].reduce((acc, f) => acc + (f.additions || 0), 0);
            const deletions = commitFilesMap[hoveredCommit.id].reduce((acc, f) => acc + (f.deletions || 0), 0);
            return (
              <>
                <hr className="scm-commit-tooltip-divider" />
                <div
                  className="scm-commit-tooltip-stats"
                  style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}
                >
                  <span>{filesCount === 1 ? "1 file changed" : `${filesCount} files changed`}</span>
                  {insertions > 0 && (
                    <span>
                      ,&nbsp;
                      <span style={{ color: "var(--vscode-scmGraph-historyItemHoverAdditionsForeground, #81B88B)" }}>
                        {insertions === 1 ? "1 insertion(+)" : `${insertions} insertions(+)`}
                      </span>
                    </span>
                  )}
                  {deletions > 0 && (
                    <span>
                      ,&nbsp;
                      <span style={{ color: "var(--vscode-scmGraph-historyItemHoverDeletionsForeground, #C74E39)" }}>
                        {deletions === 1 ? "1 deletion(-)" : `${deletions} deletions(-)`}
                      </span>
                    </span>
                  )}
                </div>
              </>
            );
          })()}

        {/* Block 3: Commands footer */}
        <hr className="scm-commit-tooltip-divider" />
        <div className="scm-commit-tooltip-commands">
          <a
            className="scm-commit-tooltip-cmd"
            title="Open Commit"
            onClick={(e) => {
              e.stopPropagation();
              onSelectCommit(hoveredCommit);
            }}
          >
            <i className="codicon codicon-git-commit"></i>
            <span>{hoveredCommit.shortId}</span>
          </a>
          <span className="scm-commit-tooltip-cmd-space">&nbsp;</span>
          <a
            className="scm-commit-tooltip-cmd"
            title="Copy Commit Hash"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(hoveredCommit.id);
            }}
          >
            <i className="codicon codicon-copy"></i>
          </a>
          <span className="scm-commit-tooltip-cmd-sep">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
          <a
            className="scm-commit-tooltip-cmd"
            title="Open on GitHub"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`https://github.com/search?q=${hoveredCommit.id}&type=commits`, "_blank");
            }}
          >
            <i className="codicon codicon-github"></i>
            <span>Open on GitHub</span>
          </a>
        </div>
      </div>
    </div>
  );
}
