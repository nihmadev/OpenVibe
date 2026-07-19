import React, { useState } from "react";
import { FileIcon, FolderIcon, ChevronRightIcon } from "../Icons/index.js";
import { RenameInput } from "./RenameInput.js";
import { useI18n } from "../../hooks/useI18n.js";
import { dirnameOf } from "./utils.js";
import { compactFolderPath, compactFolderSegments } from "../../utils/paths.js";
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
    creating,
    onCommitCreate,
    onCancelCreate,
    onSelectDir,
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
      onSelectDir?.(entry.path);
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
  const [compactSelection, setCompactSelection] = useState<string | null>(null);
  const compactLabel = entry.isDir
    ? compactFolderPath(entry, (path) => states.get(path)?.children)
    : { label: entry.name, path: entry.path };
  const compactSegments = entry.isDir
    ? compactFolderSegments(entry, (path) => states.get(path)?.children).segments
    : [{ name: entry.name, path: entry.path }];
  const selectedCompactPath = compactSelection ?? compactLabel.path;
  const renderedChildren =
    entry.isDir && selectedCompactPath !== entry.path ? states.get(selectedCompactPath)?.children : nodeState?.children;

  async function selectCompactFolder(path: string): Promise<void> {
    if (path === entry.path) {
      setCompactSelection(null);
      toggleDir();
      return;
    }

    // Do not switch the rendered subtree before its children are available.
    // Doing so briefly rendered an empty subtree while list() was in flight,
    // which looked like the compact folder row was remounting/jumping.
    const known = states.get(path);
    const res = known?.children ? { ok: true as const, entries: known.children } : await window.vibe.fs.list(path);
    setStates((prev) => {
      const map = new Map(prev);
      map.set(entry.path, { ...(map.get(entry.path) ?? { open: false, loading: false }), open: true });
      const current = map.get(path) ?? { open: true, loading: false };
      map.set(
        path,
        res.ok
          ? { ...current, open: true, loading: false, children: res.entries }
          : { ...current, open: true, loading: false, error: res.error },
      );
      return map;
    });
    setCompactSelection(path);
  }

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
          </>
        ) : null}
        {isRenaming ? (
          <RenameInput
            initial={entry.name}
            kind={entry.isDir ? "dir" : "file"}
            folderOpen={isOpen}
            onCommit={(name) => onCommitRename(entry.path, name)}
            onCancel={onCancelRename}
          />
        ) : (
          <>
            {entry.isDir ? <FolderIcon open={isOpen} name={compactLabel.label} /> : <FileIcon name={entry.name} />}
            {entry.isDir && compactSegments.length > 1 ? (
              <span className="ftree__name ftree__name--dir">
                {compactSegments.map((segment, index) => (
                  <React.Fragment key={segment.path}>
                    {index > 0 ? "/" : null}
                    <span
                      className="ftree__compact-segment"
                      onClick={(e) => {
                        e.stopPropagation();
                        void selectCompactFolder(segment.path);
                      }}
                    >
                      {segment.name}
                    </span>
                  </React.Fragment>
                ))}
                /
              </span>
            ) : (
              <span className={"ftree__name" + (entry.isDir ? " ftree__name--dir" : "")}>{compactLabel.label}</span>
            )}
          </>
        )}
      </div>
      {entry.isDir && isOpen && (
        <div className={`ftree__subtree${isOpen ? " ftree__subtree--open" : ""}`}>
          <div className="ftree__subtree-content">
            <div
              className={"ftree__line" + (containsActive ? " ftree__line--active" : "")}
              style={{ left: 8 + depth * 12 + 6 }}
            />
            {/*
             * Do not render a fixed-height loading placeholder here. For an
             * empty directory it would briefly add two rows, then disappear
             * when the listing resolves, making the whole tree jump. The
             * expanded row and guide remain stable while the request is in
             * flight, and children are inserted only once they are available.
             */}
            {creating?.dir === entry.path && onCommitCreate ? (
              <div className="ftree__row" style={{ paddingLeft: 8 + (depth + 1) * 12 }}>
                <span className="ftree__chev">
                  {creating.kind === "dir" ? <ChevronRightIcon open={false} /> : null}
                </span>
                <RenameInput
                  initial=""
                  kind={creating.kind}
                  onCommit={onCommitCreate}
                  onCancel={onCancelCreate ?? (() => undefined)}
                />
              </div>
            ) : null}
            {renderedChildren?.map((child, idx, arr) => (
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
                creating={creating}
                onCommitCreate={onCommitCreate}
                onCancelCreate={onCancelCreate}
                onSelectDir={onSelectDir}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
