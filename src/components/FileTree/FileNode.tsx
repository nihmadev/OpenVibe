import React, { useState } from "react";
import { FileIcon, FolderIcon, ChevronRightIcon } from "../icons/index.js";
import { RenameInput } from "./RenameInput.js";
import { useI18n } from "../../hooks/useI18n.js";
import { dirnameOf } from "./utils.js";
import type { NodeProps } from "./types.js";

export function FileNode(props: NodeProps): React.ReactElement {
  const { t } = useI18n();
  const {
    entry,
    depth,
    parent,
    onOpenFile,
    activeFile,
    renamingPath,
    onCommitRename,
    onCancelRename,
    onContext,
    cutPath,
    states,
    setStates,
    refreshAll,
    isLast,
    guides,
  } = props;

  const nodeState = states.get(entry.path);
  const isOpen = nodeState?.open ?? false;

  function toggleDir(): void {
    if (!entry.isDir) return;
    const cur = states.get(entry.path);
    if (cur?.open) {
      setStates((prev) => {
        const map = new Map(prev);
        map.set(entry.path, { ...cur, open: false });
        return map;
      });
    } else {
      setStates((prev) => {
        const map = new Map(prev);
        map.set(entry.path, { open: true, loading: true });
        return map;
      });
      window.vibe.fs.list(entry.path).then((res) => {
        setStates((prev) => {
          const map = new Map(prev);
          if (res.ok) {
            map.set(entry.path, { open: true, loading: false, children: res.entries });
          } else {
            map.set(entry.path, { open: true, loading: false, error: res.error });
          }
          return map;
        });
      });
    }
  }

  function onChevronClick(e: React.MouseEvent): void {
    e.stopPropagation();
    toggleDir();
  }

  function onClick(): void {
    if (entry.isDir) {
      toggleDir();
      return;
    }
    onOpenFile(entry.path);
  }

  function onContextMenu(e: React.MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    onContext({ x: e.clientX, y: e.clientY, entry, parent });
  }

  const isActive = !entry.isDir && entry.path === activeFile;
  const containsActive =
    entry.isDir &&
    activeFile !== null &&
    dirnameOf(activeFile).replace(/[\\/]/g, "/") === entry.path.replace(/[\\/]/g, "/");
  const isCut = entry.path === cutPath;
  const isRenaming = entry.path === renamingPath;
  const [dropOver, setDropOver] = useState(false);

  function onDragStart(e: React.DragEvent<HTMLDivElement>): void {
    e.dataTransfer.setData("text/plain", entry.path);
    e.dataTransfer.setData("application/x-vibe-path", entry.path);
    e.dataTransfer.setData("application/x-vibe-name", entry.name);
    e.dataTransfer.effectAllowed = "copyMove";
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>): void {
    if (!entry.isDir) return;
    if (!e.dataTransfer.types.includes("application/x-vibe-path")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropOver(true);
  }

  function onDragLeave(): void {
    setDropOver(false);
  }

  async function onDrop(e: React.DragEvent<HTMLDivElement>): Promise<void> {
    setDropOver(false);
    if (!entry.isDir) return;
    const srcPath = e.dataTransfer.getData("application/x-vibe-path");
    if (!srcPath || srcPath === entry.path) return;
    e.preventDefault();
    const srcName = srcPath.split(/[\\/]/).pop() ?? srcPath;
    const sep = srcPath.includes("\\") ? "\\" : "/";
    const destPath = entry.path + sep + srcName;
    if (srcPath === destPath) return;
    const res = await window.vibe.fs.rename(srcPath, destPath);
    if (res.ok) {
      await refreshAll();
    }
  }

  return (
    <>
      <div
        className={
          "ftree__row" +
          (isActive ? " ftree__row--active" : "") +
          (isCut ? " ftree__row--cut" : "") +
          (dropOver ? " ftree__row--drop" : "")
        }
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={onClick}
        onContextMenu={onContextMenu}
        draggable={!isRenaming}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {guides?.map((show, i) => (
          <span key={i} className={`ftree__guide${show ? "" : " ftree__guide--blank"}`} />
        ))}
        {depth > 0 && <span className={`ftree__branch${isLast ? " ftree__branch--last" : ""}`} />}
        {entry.isDir ? (
          <>
            <span className="ftree__chev" onClick={onChevronClick}>
              <ChevronRightIcon open={isOpen} />
            </span>
            <FolderIcon open={isOpen} name={entry.name} />
          </>
        ) : (
          <FileIcon name={entry.name} />
        )}
        {isRenaming ? (
          <RenameInput
            initial={entry.name}
            onCommit={(name) => onCommitRename(entry.path, name)}
            onCancel={onCancelRename}
          />
        ) : (
          <span className={"ftree__name" + (entry.isDir ? " ftree__name--dir" : "")}>{entry.name}</span>
        )}
      </div>
      {entry.isDir && isOpen && (
        <div className={`ftree__subtree${isOpen ? " ftree__subtree--open" : ""}`}>
          <div className="ftree__subtree-content">
            <div
              className={"ftree__line" + (containsActive ? " ftree__line--active" : "")}
              style={{ left: 8 + depth * 12 + 6 }}
            />
            {nodeState?.loading && (
              <div className="ftree__loading" style={{ paddingLeft: 8 + (depth + 1) * 12 }}>
                {t("loading")}
              </div>
            )}
            {nodeState?.children?.map((child, idx, arr) => (
              <FileNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                parent={entry.path}
                states={states}
                setStates={setStates}
                onOpenFile={onOpenFile}
                activeFile={activeFile}
                renamingPath={renamingPath}
                onCommitRename={onCommitRename}
                onCancelRename={onCancelRename}
                onContext={onContext}
                cutPath={cutPath}
                refreshAll={refreshAll}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
