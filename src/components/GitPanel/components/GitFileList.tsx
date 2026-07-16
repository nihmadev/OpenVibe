import React from "react";
import { FileIcon, FolderIcon } from "../../Icons/index.js";
import { getStatusLetter } from "../utils/commitGraphUtils.js";
import type { FileStatus, CommitFile } from "../types.js";

export interface FileRowProps {
  file: FileStatus;
  isStaged: boolean;
  onOpenFile?: (path: string) => void;
  onStageFile: (filePath: string, e?: React.MouseEvent) => void;
  onUnstageFile: (filePath: string, e?: React.MouseEvent) => void;
  onRevertFile: (filePath: string, e?: React.MouseEvent) => void;
}

export function FileRow({ file, isStaged, onOpenFile, onStageFile, onUnstageFile, onRevertFile }: FileRowProps) {
  const fileName = file.path.split(/[\\/]/).pop() || file.path;
  const dirPath =
    file.path.includes("/") || file.path.includes("\\")
      ? file.path.substring(0, file.path.length - fileName.length - 1)
      : "";
  const statusChar = getStatusLetter(file);

  return (
    <div className="monaco-list-row" onClick={() => onOpenFile?.(file.path)}>
      <div className="resource" style={{ width: "100%", display: "flex", alignItems: "center", height: "100%" }}>
        <div className="name" style={{ display: "flex", alignItems: "center", flex: 1, overflow: "hidden" }}>
          <div className="monaco-icon-label">
            <span style={{ display: "flex", alignItems: "center", marginRight: 6 }}>
              <FileIcon name={fileName} />
            </span>
            <div className="monaco-icon-name-container">{fileName}</div>
            {dirPath && <div className="monaco-icon-description-container">{dirPath}</div>}
            <div className="actions" style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              {isStaged ? (
                <div className="action-label" title="Unstage Changes" onClick={(e) => onUnstageFile(file.path, e)}>
                  <i className="codicon codicon-remove"></i>
                </div>
              ) : (
                <>
                  <div className="action-label" title="Discard Changes" onClick={(e) => onRevertFile(file.path, e)}>
                    <i className="codicon codicon-discard"></i>
                  </div>
                  <div className="action-label" title="Stage Changes" onClick={(e) => onStageFile(file.path, e)}>
                    <i className="codicon codicon-add"></i>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="decoration-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span
            className={`scm-status-tag ${statusChar}`}
            style={{
              color: `var(--vscode-gitDecoration-${statusChar === "M" ? "modified" : statusChar === "A" ? "added" : statusChar === "D" ? "deleted" : "untracked"}ResourceForeground)`,
            }}
          >
            {statusChar}
          </span>
        </div>
      </div>
    </div>
  );
}

export interface TreeFolderProps {
  folderName: string;
  folderData: any;
  isStaged: boolean;
  depth?: number;
  expandedFolders: Record<string, boolean>;
  onToggleFolder: (folderPath: string) => void;
  onOpenFile?: (path: string) => void;
  onStageFile: (filePath: string, e?: React.MouseEvent) => void;
  onUnstageFile: (filePath: string, e?: React.MouseEvent) => void;
  onRevertFile: (filePath: string, e?: React.MouseEvent) => void;
}

export function TreeFolder({
  folderName,
  folderData,
  isStaged,
  depth = 0,
  expandedFolders,
  onToggleFolder,
  onOpenFile,
  onStageFile,
  onUnstageFile,
  onRevertFile,
}: TreeFolderProps) {
  const isExpanded = expandedFolders[folderData.path] !== false; // expanded by default
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        className="monaco-list-row"
        style={{ paddingLeft: `${depth * 14}px` }}
        onClick={() => onToggleFolder(folderData.path)}
      >
        <div className="resource" style={{ width: "100%", display: "flex", alignItems: "center", height: "100%" }}>
          <div className="name" style={{ display: "flex", alignItems: "center", flex: 1, overflow: "hidden" }}>
            <div className="monaco-icon-label">
              <i
                className={`icon codicon codicon-chevron-${isExpanded ? "down" : "right"}`}
                style={{ marginRight: 4 }}
              ></i>
              <span style={{ display: "flex", alignItems: "center", marginRight: 6 }}>
                <FolderIcon open={isExpanded} name={folderName} />
              </span>
              <div className="monaco-icon-name-container" style={{ fontWeight: 500 }}>
                {folderName}
              </div>
            </div>
          </div>
        </div>
      </div>
      {isExpanded && (
        <div
          className="ftree__subtree-content"
          style={{ position: "relative", display: "flex", flexDirection: "column" }}
        >
          <div className="ftree__line" style={{ left: `${depth * 14 + 6}px` }} />
          {Object.keys(folderData.folders).map((subName) => (
            <TreeFolder
              key={"folder-" + folderData.folders[subName].path}
              folderName={subName}
              folderData={folderData.folders[subName]}
              isStaged={isStaged}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onOpenFile={onOpenFile}
              onStageFile={onStageFile}
              onUnstageFile={onUnstageFile}
              onRevertFile={onRevertFile}
            />
          ))}
          {folderData.files.map((file: FileStatus) => (
            <div key={"tree-file-" + file.path} style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
              <FileRow
                file={file}
                isStaged={isStaged}
                onOpenFile={onOpenFile}
                onStageFile={onStageFile}
                onUnstageFile={onUnstageFile}
                onRevertFile={onRevertFile}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export interface CommitFileRowProps {
  file: CommitFile;
  onOpenFile?: (path: string) => void;
}

export function CommitFileRow({ file, onOpenFile }: CommitFileRowProps) {
  const fileName = file.path.split(/[\\/]/).pop() || file.path;
  const dirPath =
    file.path.includes("/") || file.path.includes("\\")
      ? file.path.substring(0, file.path.length - fileName.length - 1)
      : "";
  const statusChar = file.status;
  return (
    <div className="monaco-list-row" onClick={() => onOpenFile?.(file.path)}>
      <div className="resource" style={{ width: "100%", display: "flex", alignItems: "center", height: "100%" }}>
        <div className="name" style={{ display: "flex", alignItems: "center", flex: 1, overflow: "hidden" }}>
          <div className="monaco-icon-label">
            <span style={{ display: "flex", alignItems: "center", marginRight: 6 }}>
              <FileIcon name={fileName} />
            </span>
            <div className="monaco-icon-name-container">{fileName}</div>
            {dirPath && <div className="monaco-icon-description-container">{dirPath}</div>}
          </div>
        </div>
        <div className="decoration-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span
            className={`scm-status-tag ${statusChar}`}
            style={{
              color: `var(--vscode-gitDecoration-${statusChar === "M" ? "modified" : statusChar === "A" ? "added" : statusChar === "D" ? "deleted" : "untracked"}ResourceForeground)`,
            }}
          >
            {statusChar}
          </span>
        </div>
      </div>
    </div>
  );
}

export interface CommitTreeFolderProps {
  folderName: string;
  folderData: any;
  depth?: number;
  expandedCommitFolders: Set<string>;
  onToggleCommitFolder: (path: string, e: React.MouseEvent) => void;
  onOpenFile?: (path: string) => void;
}

export function CommitTreeFolder({
  folderName,
  folderData,
  depth = 0,
  expandedCommitFolders,
  onToggleCommitFolder,
  onOpenFile,
}: CommitTreeFolderProps) {
  const isExpanded = expandedCommitFolders.has(folderData.path) === false; // Expanded by default
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        className="monaco-list-row"
        style={{ paddingLeft: `${depth * 14}px` }}
        onClick={(e) => onToggleCommitFolder(folderData.path, e)}
      >
        <div className="resource" style={{ width: "100%", display: "flex", alignItems: "center", height: "100%" }}>
          <div className="name" style={{ display: "flex", alignItems: "center", flex: 1, overflow: "hidden" }}>
            <div className="monaco-icon-label">
              <i
                className={`icon codicon codicon-chevron-${isExpanded ? "down" : "right"}`}
                style={{ marginRight: 4 }}
              ></i>
              <span style={{ display: "flex", alignItems: "center", marginRight: 6 }}>
                <FolderIcon open={isExpanded} name={folderName} />
              </span>
              <div className="monaco-icon-name-container" style={{ fontWeight: 500 }}>
                {folderName}
              </div>
            </div>
          </div>
        </div>
      </div>
      {isExpanded && (
        <div
          className="ftree__subtree-content"
          style={{ position: "relative", display: "flex", flexDirection: "column" }}
        >
          <div className="ftree__line" style={{ left: `${depth * 14 + 6}px` }} />
          {Object.keys(folderData.folders).map((subName) => (
            <CommitTreeFolder
              key={"commit-folder-" + folderData.folders[subName].path}
              folderName={subName}
              folderData={folderData.folders[subName]}
              depth={depth + 1}
              expandedCommitFolders={expandedCommitFolders}
              onToggleCommitFolder={onToggleCommitFolder}
              onOpenFile={onOpenFile}
            />
          ))}
          {folderData.files.map((file: CommitFile) => (
            <div key={"commit-tree-file-" + file.path} style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
              <CommitFileRow file={file} onOpenFile={onOpenFile} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
