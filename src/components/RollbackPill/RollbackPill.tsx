import React, { useRef } from "react";
import "../../styles/RollbackPill.css";

interface RollbackPillProps {
  messageText: string;
  fileCount: number;
  filesChanged: { path: string; content: string | null }[];
  messagesRemoved: number;
  onRestore: () => void;
}

export function RollbackPill({
  messageText,
  fileCount,
  filesChanged,
  messagesRemoved,
  onRestore,
}: RollbackPillProps): React.ReactElement {
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
  }, [expanded, filesOpen]);

  const truncated =
    messageText.length > 100 ? messageText.slice(0, 100) + "…" : messageText;

  const fileLabel =
    fileCount === 1
      ? "1 файл изменён"
      : fileCount >= 2 && fileCount <= 4
        ? `${fileCount} файла изменено`
        : `${fileCount} файлов изменено`;

  const msgLabel =
    messagesRemoved === 1
      ? "1 сообщ. возвращено"
      : `${messagesRemoved} сообщ. возвращено`;

  return (
    <div className="prompt-input__rollback">
      <div
        className="prompt-input__rollback-header"
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
        <span className="prompt-input__rollback-info">
          {(fileCount > 0 || messagesRemoved > 0) && (
            <span className="prompt-input__rollback-count">{fileCount > 0 ? fileLabel : msgLabel}</span>
          )}
          {!expanded && <span className="prompt-input__rollback-preview">{truncated}</span>}
        </span>
        <span className={`prompt-input__rollback-chevron${expanded ? " prompt-input__rollback-chevron--open" : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </div>

      <div
        className="prompt-input__rollback-body"
        style={{ maxHeight: bodyHeight, opacity: expanded ? 1 : 0 }}
      >
        <div ref={contentRef}>
          {filesChanged.length > 0 && (
            <div className="prompt-input__rollback-files">
              <div
                className="prompt-input__rollback-files-header"
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setFilesOpen(!filesOpen); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setFilesOpen(!filesOpen);
                  }
                }}
              >
                <span>Изменённые файлы</span>
                <span className={`prompt-input__rollback-files-chevron${filesOpen ? " prompt-input__rollback-files-chevron--open" : ""}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </span>
              </div>
              {filesOpen && (
                <div className="prompt-input__rollback-files-list">
                  {filesChanged.map((f, i) => {
                    const name = f.path.split(/[\\/]/).pop() ?? f.path;
                    return (
                      <div key={i} className="prompt-input__rollback-file-item">
                        <span className="prompt-input__rollback-file-icon">{f.content === null ? "🗑" : "📝"}</span>
                        <span className="prompt-input__rollback-file-name">{name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="prompt-input__rollback-text-row">
            <span className="prompt-input__rollback-text">{messageText}</span>
            <button className="prompt-input__rollback-restore-btn" onClick={onRestore}>
              Восстановить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
