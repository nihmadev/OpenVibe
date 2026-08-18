import React, { useRef } from "react";
import { PenIcon, TrashIcon } from "@/base/browser/ui/icons/iconRegistry";
import { useI18n } from "@/platform/localization/localizationService";
import "./rollbackPill.css";

interface RollbackPillProps {
  messageText: string;
  fileCount: number;
  filesChanged: { path: string; content: string | null }[];
  messagesRemoved: number;
  onRestore: () => void;
}

function ChevronIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function RollbackPill({
  messageText,
  fileCount,
  filesChanged,
  messagesRemoved,
  onRestore,
}: RollbackPillProps): React.ReactElement {
  const { t } = useI18n();
  const [expanded, setExpanded] = React.useState(false);
  const [filesOpen, setFilesOpen] = React.useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [bodyHeight, setBodyHeight] = React.useState(0);

  React.useEffect(() => {
    if (expanded && contentRef.current) {
      setBodyHeight(contentRef.current.scrollHeight);
    } else {
      setBodyHeight(0);
    }
  }, [expanded]);

  const truncated = messageText.length > 100 ? `${messageText.slice(0, 100)}…` : messageText;

  const fileLabel = t("filesChanged", { count: fileCount });
  const msgLabel = t("messagesReverted", { count: messagesRemoved });

  return (
    <div className="composer__rollback">
      <div
        className="composer__rollback-header"
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <span className="composer__rollback-info">
          {(fileCount > 0 || messagesRemoved > 0) && (
            <span className="composer__rollback-count">{fileCount > 0 ? fileLabel : msgLabel}</span>
          )}
          {!expanded && <span className="composer__rollback-preview">{truncated}</span>}
        </span>
        <span className={`composer__rollback-chevron${expanded ? " composer__rollback-chevron--open" : ""}`}>
          <ChevronIcon />
        </span>
      </div>

      <div className="composer__rollback-body" style={{ maxHeight: bodyHeight, opacity: expanded ? 1 : 0 }}>
        <div ref={contentRef}>
          {filesChanged.length > 0 && (
            <div className="composer__rollback-files">
              <div
                className="composer__rollback-files-header"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setFilesOpen(!filesOpen);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setFilesOpen(!filesOpen);
                  }
                }}
              >
                <span>{t("changedFilesTitle")}</span>
                <span
                  className={`composer__rollback-files-chevron${filesOpen ? " composer__rollback-files-chevron--open" : ""}`}
                >
                  <ChevronIcon />
                </span>
              </div>
              {filesOpen && (
                <div className="composer__rollback-files-list">
                  {filesChanged.map((f, i) => {
                    const name = f.path.split(/[\\/]/).pop() ?? f.path;
                    return (
                      <div key={i} className="composer__rollback-file-item">
                        <span className="composer__rollback-file-icon">
                          {f.content === null ? <TrashIcon /> : <PenIcon />}
                        </span>
                        <span className="composer__rollback-file-name">{name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="composer__rollback-text-row">
            <span className="composer__rollback-text">{messageText}</span>
            <button
              type="button"
              className="composer__rollback-restore-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRestore();
              }}
            >
              {t("restore")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
