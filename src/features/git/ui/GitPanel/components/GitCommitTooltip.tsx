import type React from "react";
import { Markdown } from "@/features/agent/ui/Markdown/Markdown";
import { writeClipboard } from "@/infrastructure/clipboard";
import { useI18n } from "@/shared/i18n/useI18n";
import type { CommitFile, CommitGraphNode } from "../../../model/git";
import { formatRelativeTime } from "../utils/commitGraphUtils";

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
  const { t } = useI18n();
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
              <span className="scm-ref-pill scm-ref-pill--head">
                <i className="codicon codicon-target scm-ref-icon"></i>
                <span>{currentBranch} (HEAD)</span>
              </span>
            )}
            {hoveredCommit.refNames.map((ref) => {
              if (ref.includes(currentBranch) && hoveredCommit.isHead) return null;
              const isRemote = ref.startsWith("origin/") || ref.includes("/");
              return (
                <span key={ref} className={`scm-ref-pill ${isRemote ? "scm-ref-pill--remote" : "scm-ref-pill--local"}`}>
                  <i className="codicon codicon-git-branch scm-ref-icon"></i>
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
                  <span>{t("commitFileChanged", { count: filesCount })}</span>
                  {insertions > 0 && (
                    <span>
                      ,&nbsp;
                      <span style={{ color: "var(--green)" }}>{t("commitInsertion", { count: insertions })}</span>
                    </span>
                  )}
                  {deletions > 0 && (
                    <span>
                      ,&nbsp;
                      <span style={{ color: "var(--red)" }}>{t("commitDeletion", { count: deletions })}</span>
                    </span>
                  )}
                </div>
              </>
            );
          })()}

        {/* Block 3: Commands footer */}
        <hr className="scm-commit-tooltip-divider" />
        <div className="scm-commit-tooltip-commands">
          <button
            type="button"
            className="scm-commit-tooltip-cmd"
            title={t("openCommit")}
            onClick={(e) => {
              e.stopPropagation();
              onSelectCommit(hoveredCommit);
            }}
          >
            <i className="codicon codicon-git-commit"></i>
            <span>{hoveredCommit.shortId}</span>
          </button>
          <span className="scm-commit-tooltip-cmd-space">&nbsp;</span>
          <button
            type="button"
            className="scm-commit-tooltip-cmd"
            title={t("copyCommitHash")}
            onClick={(e) => {
              e.stopPropagation();
              writeClipboard(hoveredCommit.id);
            }}
          >
            <i className="codicon codicon-copy"></i>
          </button>
          <span className="scm-commit-tooltip-cmd-sep">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
          <button
            type="button"
            className="scm-commit-tooltip-cmd"
            title={t("openOnGitHub")}
            onClick={(e) => {
              e.stopPropagation();
              window.open(`https://github.com/search?q=${hoveredCommit.id}&type=commits`, "_blank");
            }}
          >
            <i className="codicon codicon-github"></i>
            <span>{t("openOnGitHub")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
