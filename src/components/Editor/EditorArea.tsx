import React, { useCallback, useRef } from "react";
import { Editor } from "./Editor.js";
import { ImageViewer, isImageFile } from "../ImageViewer/ImageViewer.js";
import { VideoViewer, isVideoFile } from "../ImageViewer/VideoViewer.js";
import { FileIcon, FolderIcon } from "../Icons/index.js";
import { useI18n } from "../../hooks/useI18n.js";
import { basename } from "../../utils/paths.js";
import "./EditorArea.css";

interface EditorAreaProps {
  openFiles: string[];
  activeFile: string | null;
  dirtyFiles: Set<string>;
  onActivate: (path: string) => void;
  onClose: (path: string) => void;
  onDirtyChange: (path: string, dirty: boolean) => void;
  /** Root folder of the project, used to make breadcrumb relative */
  cwd: string;
  /** Line number to scroll to when opening from search */
  gotoLine?: number;
  /** Column number to position cursor when opening from search */
  gotoColumn?: number;
  /** Match length to select when opening from search */
  gotoMatchLength?: number;
}

export function EditorArea({
  openFiles,
  activeFile,
  dirtyFiles,
  onActivate,
  onClose,
  onDirtyChange,
  cwd,
  gotoLine,
  gotoColumn,
  gotoMatchLength,
}: EditorAreaProps): React.ReactElement {
  const { t } = useI18n();
  const breadcrumbRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const onWheel = useCallback((e: React.WheelEvent, ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current) return;
    e.preventDefault();
    ref.current.scrollLeft += e.deltaY || e.deltaX;
  }, []);

  const onTabsWheel = useCallback((e: React.WheelEvent) => onWheel(e, tabsRef), [onWheel]);
  const onBreadcrumbWheel = useCallback((e: React.WheelEvent) => onWheel(e, breadcrumbRef), [onWheel]);

  const handleClose = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.stopPropagation();
      onClose(path);
    },
    [onClose],
  );

  // Build relative breadcrumb segments for the active file
  const breadcrumb = React.useMemo(() => {
    if (!activeFile) return [];
    const cwdNorm = cwd.replace(/\\/g, "/");
    const fileNorm = activeFile.replace(/\\/g, "/");
    const rel = fileNorm.startsWith(cwdNorm + "/") ? fileNorm.slice(cwdNorm.length + 1) : fileNorm;
    return rel.split("/").filter(Boolean);
  }, [activeFile, cwd]);

  if (openFiles.length === 0) {
    return (
      <div className="editor-area editor-area--empty">
        <span className="editor-area__empty-hint">{t("openFileFromTree")}</span>
      </div>
    );
  }

  return (
    <div className="editor-area">
      {/* ── Tab bar ── */}
      <div ref={tabsRef} className="editor-area__tabs" role="tablist" onWheel={onTabsWheel}>
        {openFiles.map((path) => {
          const active = path === activeFile;
          const dirty = dirtyFiles.has(path);
          return (
            <div
              key={path}
              className={"editor-area__tab" + (active ? " editor-area__tab--active" : "")}
              role="tab"
              aria-selected={active}
              title={path}
              onClick={() => onActivate(path)}
            >
              <span className="editor-area__tab-icon">
                <FileIcon name={basename(path)} />
              </span>
              <span className="editor-area__tab-name">{basename(path)}</span>
              {/* dirty dot — replaces close button when dirty */}
              {dirty ? (
                <span
                  className="editor-area__tab-dirty"
                  title={t("unsavedChanges")}
                  onClick={(e) => handleClose(e, path)}
                />
              ) : (
                <button
                  className="editor-area__tab-close"
                  aria-label={t("closeFile", { name: basename(path) })}
                  onClick={(e) => handleClose(e, path)}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Breadcrumb bar — between tabs and editor body ── */}
      {breadcrumb.length > 1 && (
        <div
          ref={breadcrumbRef}
          className="editor-area__breadcrumb"
          aria-label={t("filePath")}
          onWheel={onBreadcrumbWheel}
        >
          {breadcrumb.map((seg, i) => {
            const isLast = i === breadcrumb.length - 1;
            return (
              <React.Fragment key={i}>
                {i > 0 && (
                  <span className="editor-area__breadcrumb-sep" aria-hidden="true">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                )}
                <span className={"editor-area__breadcrumb-seg" + (isLast ? " editor-area__breadcrumb-seg--file" : "")}>
                  <span className="editor-area__breadcrumb-icon">
                    {isLast ? <FileIcon name={seg} /> : <FolderIcon open={false} name={seg} />}
                  </span>
                  {seg}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* ── Editor / Viewer body ── */}
      <div className="editor-area__body">
        {activeFile ? (
          isImageFile(activeFile) ? (
            <ImageViewer key={activeFile} path={activeFile} />
          ) : isVideoFile(activeFile) ? (
            <VideoViewer key={activeFile} path={activeFile} />
          ) : (
            <Editor
              key={activeFile}
              path={activeFile}
              cwd={cwd}
              onDirtyChange={(dirty) => onDirtyChange(activeFile, dirty)}
              gotoLine={gotoLine}
              gotoColumn={gotoColumn}
              gotoMatchLength={gotoMatchLength}
            />
          )
        ) : (
          <div className="editor-area__empty-hint">{t("selectFileToEdit")}</div>
        )}
      </div>
    </div>
  );
}
