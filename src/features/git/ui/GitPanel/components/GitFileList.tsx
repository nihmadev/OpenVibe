import type React from "react";
import { useI18n } from "@/shared/i18n/useI18n";
import { FileIcon, FolderIcon } from "@/shared/icons";
import type { CommitFile, FileStatus } from "../../../model/git";
import { getStatusLetter } from "../utils/commitGraphUtils";

export interface FileRowProps {
  file: FileStatus;
  isStaged: boolean;
  onOpenFile?: (path: string) => void;
  onStageFile: (filePath: string, e?: React.MouseEvent) => void;
  onUnstageFile: (filePath: string, e?: React.MouseEvent) => void;
  onRevertFile: (filePath: string, e?: React.MouseEvent) => void;
}

export function FileRow({ file, isStaged, onOpenFile, onStageFile, onUnstageFile, onRevertFile }: FileRowProps) {
  // Use the backend-provided isDir flag; fall back to path-suffix heuristic
  const isDirectory = file.isDir || file.path.endsWith("/") || file.path.endsWith("\\");
  const normalizedPath = isDirectory ? file.path.replace(/[\\/]+$/, "") : file.path;
  const fileName = normalizedPath.split(/[\\/]/).pop() || normalizedPath;
  const dirPath =
    normalizedPath.includes("/") || normalizedPath.includes("\\")
      ? normalizedPath.substring(0, normalizedPath.length - fileName.length - 1)
      : "";
  const statusChar = getStatusLetter(file);
  const { t } = useI18n();

  return (
    <div className="scm-list-row" onClick={() => onOpenFile?.(file.path)}>
      <div className="resource scm-resource-row">
        <div className="name scm-resource-name">
          <div className="scm-icon-label">
            <span className="scm-file-icon">
              {isDirectory ? <FolderIcon open={false} name={fileName} /> : <FileIcon name={fileName} />}
            </span>
            <div className="scm-icon-name">{fileName}</div>
            {dirPath && <div className="scm-icon-description">{dirPath}</div>}
            <div className="actions scm-file-actions">
              {isStaged ? (
                <div className="action-label" title={t("unstageChanges")} onClick={(e) => onUnstageFile(file.path, e)}>
                  <i className="codicon codicon-remove"></i>
                </div>
              ) : (
                <>
                  <div className="action-label" title={t("discardChanges")} onClick={(e) => onRevertFile(file.path, e)}>
                    <i className="codicon codicon-discard"></i>
                  </div>
                  <div className="action-label" title={t("stageChanges")} onClick={(e) => onStageFile(file.path, e)}>
                    <i className="codicon codicon-add"></i>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="decoration-icon">
          <span className={`scm-status-tag scm-status-tag--${statusChar.toLowerCase()}`}>{statusChar}</span>
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
    <div className="scm-tree-folder">
      <div
        className="scm-list-row"
        style={{ paddingLeft: `${depth * 14}px` }}
        onClick={() => onToggleFolder(folderData.path)}
      >
        <div className="resource scm-resource-row">
          <div className="name scm-resource-name">
            <div className="scm-icon-label">
              <i className={`icon codicon codicon-chevron-${isExpanded ? "down" : "right"} scm-tree-chevron`}></i>
              <span className="scm-file-icon">
                <FolderIcon open={isExpanded} name={folderName} />
              </span>
              <div className="scm-icon-name scm-icon-name--folder">{folderName}</div>
            </div>
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="ftree__subtree-content">
          <div className="ftree__line" style={{ left: `${depth * 14 + 6}px` }} />
          {Object.keys(folderData.folders).map((subName) => (
            <TreeFolder
              key={`folder-${folderData.folders[subName].path}`}
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
            <div key={`tree-file-${file.path}`} style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
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
  // Paths ending with '/' are directory entries (e.g. submodules)
  const isDirectory = file.path.endsWith("/") || file.path.endsWith("\\");
  const normalizedPath = isDirectory ? file.path.slice(0, -1) : file.path;
  const fileName = normalizedPath.split(/[\\/]/).pop() || normalizedPath;
  const dirPath =
    normalizedPath.includes("/") || normalizedPath.includes("\\")
      ? normalizedPath.substring(0, normalizedPath.length - fileName.length - 1)
      : "";
  const statusChar = file.status;
  return (
    <div className="scm-list-row" onClick={() => onOpenFile?.(file.path)}>
      <div className="resource scm-resource-row">
        <div className="name scm-resource-name">
          <div className="scm-icon-label">
            <span className="scm-file-icon">
              {isDirectory ? <FolderIcon open={false} name={fileName} /> : <FileIcon name={fileName} />}
            </span>
            <div className="scm-icon-name">{fileName}</div>
            {dirPath && <div className="scm-icon-description">{dirPath}</div>}
          </div>
        </div>
        <div className="decoration-icon">
          <span className={`scm-status-tag scm-status-tag--${statusChar.toLowerCase()}`}>{statusChar}</span>
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
    <div className="scm-tree-folder">
      <div
        className="scm-list-row"
        style={{ paddingLeft: `${depth * 14}px` }}
        onClick={(e) => onToggleCommitFolder(folderData.path, e)}
      >
        <div className="resource scm-resource-row">
          <div className="name scm-resource-name">
            <div className="scm-icon-label">
              <i className={`icon codicon codicon-chevron-${isExpanded ? "down" : "right"} scm-tree-chevron`}></i>
              <span className="scm-file-icon">
                <FolderIcon open={isExpanded} name={folderName} />
              </span>
              <div className="scm-icon-name scm-icon-name--folder">{folderName}</div>
            </div>
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="ftree__subtree-content">
          <div className="ftree__line" style={{ left: `${depth * 14 + 6}px` }} />
          {Object.keys(folderData.folders).map((subName) => (
            <CommitTreeFolder
              key={`commit-folder-${folderData.folders[subName].path}`}
              folderName={subName}
              folderData={folderData.folders[subName]}
              depth={depth + 1}
              expandedCommitFolders={expandedCommitFolders}
              onToggleCommitFolder={onToggleCommitFolder}
              onOpenFile={onOpenFile}
            />
          ))}
          {folderData.files.map((file: CommitFile) => (
            <div key={`commit-tree-file-${file.path}`} style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
              <CommitFileRow file={file} onOpenFile={onOpenFile} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
