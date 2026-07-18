import React, { useEffect, useState } from "react";
import "./FileTree.css";
import type { FsEntry } from "../../types.js";
import { ContextMenu, type MenuItem } from "../ContextMenu/ContextMenu.js";
import { Tooltip } from "../Tooltip/Tooltip.js";
import { useI18n } from "../../hooks/useI18n.js";
import {
  FileIcon,
  FolderIcon,
  ChevronRightIcon,
  CollapseAllIcon,
  NewFileIcon,
  NewFolderIcon,
  RefreshIcon,
} from "../Icons/index.js";
import { FileNode } from "./FileNode";
import { RenameInput } from "./RenameInput";
import { basename, dirnameOf } from "./utils.js";
import type { NodeState, CtxState, RootProps } from "./types.js";

export function FileTree({ cwd, onOpenFile, activeFile, revealPath }: RootProps): React.ReactElement {
  const { t } = useI18n();
  const [root, setRoot] = useState<FsEntry[] | null>(null);
  const [error] = useState<string | null>(null);
  const [states, setStates] = useState<Map<string, NodeState>>(new Map());
  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [cutPath, setCutPath] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ dir: string; kind: "file" | "dir" } | null>(null);

  // Dirs whose children need to be re-fetched (after rename/delete inside them)
  async function refreshDir(dir: string): Promise<void> {
    if (dir === cwd) {
      const res = await window.vibe.fs.list(cwd);
      if (res.ok) setRoot(res.entries);
      return;
    }
    const cur = states.get(dir);
    if (!cur) return; // Not an open/known directory, skip

    const res = await window.vibe.fs.list(dir);
    if (!res.ok) return;
    setStates((prev) => {
      const map = new Map(prev);
      const latest = map.get(dir);
      if (!latest) return prev;
      map.set(dir, {
        open: latest.open,
        loading: false,
        children: res.entries,
      });
      return map;
    });
  }

  /** Refresh root + all currently-open directories. */
  async function refreshAll(): Promise<void> {
    const res = await window.vibe.fs.list(cwd);
    if (res.ok) setRoot(res.entries);
    // Refresh all open subdirectories
    const openDirs = [...states.entries()].filter(([, s]) => s.open && s.children).map(([dir]) => dir);
    for (const dir of openDirs) {
      const r = await window.vibe.fs.list(dir);
      if (!r.ok) continue;
      setStates((prev) => {
        const map = new Map(prev);
        const cur = map.get(dir);
        map.set(dir, {
          open: cur?.open ?? true,
          loading: false,
          children: r.entries,
        });
        return map;
      });
    }
  }

  // Initial load + reload when cwd changes
  useEffect(() => {
    setRoot(null);
    setStates(new Map());
    window.vibe.fs.list(cwd).then((res) => {
      if (res.ok) setRoot(res.entries);
      else setRoot([]);
    });
  }, [cwd]);

  // Auto-refresh when agent creates/edits/deletes files
  const refreshAllRef = React.useRef(refreshAll);
  const refreshDirRef = React.useRef(refreshDir);
  React.useEffect(() => {
    refreshAllRef.current = refreshAll;
    refreshDirRef.current = refreshDir;
  });

  useEffect(() => {
    const off = window.vibe.onFsChanged((paths?: string[]) => {
      if (!paths || paths.length === 0) {
        refreshAllRef.current();
        return;
      }
      // Get unique parent directories
      const parents = new Set<string>();
      for (const p of paths) {
        const dir = dirnameOf(p);
        parents.add(dir);
      }
      for (const p of parents) {
        refreshDirRef.current(p);
      }
    });
    return off;
  }, []);

  // Reveal a path in the tree by expanding all parent directories
  useEffect(() => {
    if (!revealPath || !cwd) return;
    const cwdN = cwd.replace(/\\/g, "/").toLowerCase();
    const rpN = revealPath.replace(/\\/g, "/").toLowerCase();
    if (!rpN.startsWith(cwdN)) return;
    const rel = rpN.slice(cwdN.length).replace(/^\/+/, "");
    const parts = rel.split("/");
    parts.pop();
    if (parts.length === 0) return;
    let base = cwd.replace(/\\/g, "/");
    const dirs: string[] = [];
    for (const p of parts) {
      base = base + "/" + p;
      dirs.push(base.replace(/\//g, "\\"));
    }
    (async () => {
      const results = await Promise.all(dirs.map((d) => window.vibe.fs.list(d)));
      setStates((prev) => {
        const map = new Map(prev);
        for (let i = 0; i < dirs.length; i++) {
          const res = results[i];
          if (!res.ok) continue;
          map.set(dirs[i], { open: true, loading: false, children: res.entries });
        }
        return map;
      });
    })();
  }, [revealPath, cwd]);

  async function collapseAll(): Promise<void> {
    setStates(new Map());
  }

  function promptCreate(dir: string, kind: "file" | "dir"): void {
    setCreating({ dir, kind });
    // Ensure dir is expanded so we see the input
    if (dir !== cwd) {
      const cur = states.get(dir);
      if (!cur || !cur.open) {
        // Expand logic
        window.vibe.fs.list(dir).then((res) => {
          if (!res.ok) return;
          setStates((prev) => {
            const map = new Map(prev);
            map.set(dir, { open: true, loading: false, children: res.entries });
            return map;
          });
        });
      }
    }
  }

  async function commitCreate(name: string): Promise<void> {
    if (!creating) return;
    const { dir, kind } = creating;
    setCreating(null);
    if (!name.trim()) return;

    let res;
    if (kind === "file") res = await window.vibe.fs.createFile(dir, name);
    else res = await window.vibe.fs.createDir(dir, name);

    if (!res.ok) {
      alert(t("createFailed", { error: res.error }));
    } else {
      refreshDir(dir);
    }
  }

  async function commitRename(path: string, newName: string): Promise<void> {
    setRenaming(null);
    if (!newName.trim()) return;
    const parent = dirnameOf(path);
    const newPath = `${parent}/${newName}`;
    if (newPath === path) return;

    const res = await window.vibe.fs.rename(path, newPath);
    if (!res.ok) {
      alert(t("renameFailed", { error: res.error }));
    } else {
      refreshDir(parent);
    }
  }

  function buildMenuItems(c: CtxState): MenuItem[] {
    const items: MenuItem[] = [];
    const entry = c.entry;
    const p = entry ? entry.path : c.parent!;

    if (entry?.isDir || !entry) {
      items.push({
        label: t("newFile"),
        icon: <NewFileIcon />,
        onClick: () => promptCreate(p, "file"),
      });
      items.push({
        label: t("newFolder"),
        icon: <NewFolderIcon />,
        onClick: () => promptCreate(p, "dir"),
      });
    }

    if (entry) {
      items.push({
        label: t("rename"),
        onClick: () => setRenaming(p),
      });
      items.push({
        label: t("cut"),
        onClick: () => setCutPath(p),
      });
      if (cutPath) {
        items.push({
          label: t("paste"),
          onClick: async () => {
            const res = await window.vibe.fs.rename(cutPath, `${p}/${basename(cutPath)}`);
            if (!res.ok) alert(res.error);
            else {
              setCutPath(null);
              refreshDir(p);
              refreshDir(dirnameOf(cutPath));
            }
          },
        });
      }
      items.push({
        label: t("delete"),
        danger: true,
        onClick: async () => {
          if (confirm(t("deleteConfirm", { name: entry.name }))) {
            const res = await window.vibe.fs.delete(p);
            if (!res.ok) alert(res.error);
            else refreshDir(dirnameOf(p));
          }
        },
      });
    } else if (cutPath) {
      items.push({
        label: t("paste"),
        onClick: async () => {
          const res = await window.vibe.fs.rename(cutPath, `${p}/${basename(cutPath)}`);
          if (!res.ok) alert(res.error);
          else {
            setCutPath(null);
            refreshDir(p);
            refreshDir(dirnameOf(cutPath));
          }
        },
      });
    }

    return items;
  }

  return (
    <div className="ftree">
      <div className="ftree__header">
        <Tooltip text={cwd}>
          <span className="ftree__root">{basename(cwd)}</span>
        </Tooltip>
        <div className="ftree__actions">
          <Tooltip text={t("newFileTooltip")}>
            <button className="ftree__action" onClick={() => promptCreate(cwd, "file")}>
              <NewFileIcon />
            </button>
          </Tooltip>
          <Tooltip text={t("newFolderTooltip")}>
            <button className="ftree__action" onClick={() => promptCreate(cwd, "dir")}>
              <NewFolderIcon />
            </button>
          </Tooltip>
          <Tooltip text={t("refreshTooltip")}>
            <button className="ftree__action" onClick={refreshAll}>
              <RefreshIcon />
            </button>
          </Tooltip>
          <Tooltip text={t("collapseAllTooltip")}>
            <button className="ftree__action" onClick={collapseAll}>
              <CollapseAllIcon />
            </button>
          </Tooltip>
        </div>
      </div>
      <div
        className="ftree__body"
        onContextMenu={(e) => {
          e.preventDefault();
          if (e.target === e.currentTarget) {
            setCtx({ x: e.clientX, y: e.clientY, entry: null, parent: cwd });
          }
        }}
      >
        {error ? <div className="ftree__error">{error}</div> : null}
        {root === null && !error ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div className="skeleton-item skeleton-circle skeleton-shimmer" style={{ width: 12, height: 12 }} />
              <div className="skeleton-item skeleton-line skeleton-shimmer" style={{ width: "60%", height: 12 }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 12 }}>
              <div className="skeleton-item skeleton-circle skeleton-shimmer" style={{ width: 12, height: 12 }} />
              <div className="skeleton-item skeleton-line skeleton-shimmer" style={{ width: "70%", height: 12 }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 12 }}>
              <div className="skeleton-item skeleton-circle skeleton-shimmer" style={{ width: 12, height: 12 }} />
              <div className="skeleton-item skeleton-line skeleton-shimmer" style={{ width: "50%", height: 12 }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div className="skeleton-item skeleton-circle skeleton-shimmer" style={{ width: 12, height: 12 }} />
              <div className="skeleton-item skeleton-line skeleton-shimmer" style={{ width: "55%", height: 12 }} />
            </div>
          </div>
        ) : null}
        {creating && creating.dir === cwd ? (
          <div className="ftree__row" style={{ paddingLeft: 8 }}>
            <span className="ftree__chev">{creating.kind === "dir" ? <ChevronRightIcon open={false} /> : null}</span>
            {creating.kind === "dir" ? <FolderIcon open={false} /> : <FileIcon />}
            <RenameInput initial="" onCommit={commitCreate} onCancel={() => setCreating(null)} />
          </div>
        ) : null}
        {root?.map((e) => (
          <FileNode
            key={e.path}
            entry={e}
            depth={0}
            parent={cwd}
            states={states}
            setStates={setStates}
            onOpenFile={onOpenFile}
            activeFile={activeFile}
            renamingPath={renaming}
            onCommitRename={commitRename}
            onCancelRename={() => setRenaming(null)}
            onContext={setCtx}
            cutPath={cutPath}
            refreshAll={refreshAll}
          />
        ))}
      </div>
      {ctx ? <ContextMenu x={ctx.x} y={ctx.y} items={buildMenuItems(ctx)} onClose={() => setCtx(null)} /> : null}
    </div>
  );
}
