import React, { useEffect, useState } from "react";
import "./fileTree.css";
import { ContextMenu, type MenuItem } from "@/base/browser/ui/contextMenu/contextMenu";
import {
  ChevronRightIcon,
  CloseIcon,
  CollapseAllIcon,
  FileIcon,
  NewFileIcon,
  NewFolderIcon,
  RefreshIcon,
  SearchIcon,
} from "@/base/browser/ui/icons/iconRegistry";
import { Tooltip } from "@/base/browser/ui/tooltip/tooltip";
import { useI18n } from "@/platform/localization/localizationService";
import { fileService, onFsChanged } from "@/workbench/services/files/tauri/fileService";
import type { FileMatch, FsEntry } from "../../../../services/files/common/files";
import type { ExplorerViewProps } from "../../common/explorer";
import { FileNode } from "./fileNode";
import { basename, dirnameOf } from "./fileTreePaths";
import type { CtxState, NodeState } from "./fileTreeState";
import { RenameInput } from "./renameInput";

export function ExplorerView({ cwd, onOpenFile, activeFile, revealPath }: ExplorerViewProps): React.ReactElement {
  const { t } = useI18n();
  const [root, setRoot] = useState<FsEntry[] | null>(null);
  const [displayedCwd, setDisplayedCwd] = useState(cwd);
  const [isSwitchingRoot, setIsSwitchingRoot] = useState(false);
  const [error] = useState<string | null>(null);
  const [states, setStates] = useState<Map<string, NodeState>>(new Map());
  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [cutPath, setCutPath] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ dir: string; kind: "file" | "dir" } | null>(null);
  const [selectedDir, setSelectedDir] = useState(cwd);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<FileMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const activeCwdRef = React.useRef(cwd);
  const displayedCwdRef = React.useRef(cwd);
  const rootLoadSequenceRef = React.useRef(0);
  const hasLoadedRootRef = React.useRef(false);

  activeCwdRef.current = cwd;

  useEffect(() => {
    const query = searchQuery.trim();
    let cancelled = false;

    if (!query) {
      setSearchMatches(null);
      setSearching(false);
      setSearchError(null);
      return;
    }

    setSearching(true);
    setSearchError(null);
    const timeout = window.setTimeout(() => {
      void fileService.find(cwd, query, 200).then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setSearchMatches(result.matches);
        } else {
          setSearchMatches([]);
          setSearchError(result.error);
        }
        setSearching(false);
      });
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [cwd, searchQuery]);

  // Dirs whose children need to be re-fetched (after rename/delete inside them)
  async function refreshDir(dir: string): Promise<void> {
    if (dir === cwd) {
      const requestedCwd = cwd;
      const res = await fileService.list(requestedCwd);
      if (res.ok && activeCwdRef.current === requestedCwd) setRoot(res.entries);
      return;
    }
    const cur = states.get(dir);
    if (!cur) return; // Not an open/known directory, skip

    const res = await fileService.list(dir);
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
    const requestedCwd = cwd;
    const res = await fileService.list(requestedCwd);
    if (res.ok && activeCwdRef.current === requestedCwd) setRoot(res.entries);
    // Refresh all open subdirectories
    const openDirs = [...states.entries()].filter(([, s]) => s.open && s.children).map(([dir]) => dir);
    for (const dir of openDirs) {
      const r = await fileService.list(dir);
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

  // Keep the previous tree mounted while the next project is fetched. Once it
  // has faded out, replace it atomically and fade the new tree in. Clearing the
  // root here used to produce an old tree -> skeleton -> new tree flash.
  useEffect(() => {
    const sequence = ++rootLoadSequenceRef.current;
    const shouldAnimate = hasLoadedRootRef.current && displayedCwdRef.current !== cwd;
    const reduceMotion =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (shouldAnimate) {
      setIsSwitchingRoot(true);
      setCtx(null);
      setRenaming(null);
      setCreating(null);
    }

    const loadRoot = async (): Promise<void> => {
      const [res] = await Promise.all([
        fileService.list(cwd),
        shouldAnimate && !reduceMotion
          ? new Promise<void>((resolve) => window.setTimeout(resolve, 120))
          : Promise.resolve(),
      ]);
      if (rootLoadSequenceRef.current !== sequence) return;

      setRoot(res.ok ? res.entries : []);
      setStates(new Map());
      setSelectedDir(cwd);
      setCutPath(null);
      setSearchQuery("");
      setDisplayedCwd(cwd);
      displayedCwdRef.current = cwd;
      hasLoadedRootRef.current = true;
      if (bodyRef.current) bodyRef.current.scrollTop = 0;

      if (!shouldAnimate || reduceMotion) {
        setIsSwitchingRoot(false);
        return;
      }

      // Two frames guarantee that the hidden replacement is painted before
      // the class is removed, so the incoming tree actually transitions.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (rootLoadSequenceRef.current === sequence) setIsSwitchingRoot(false);
        });
      });
    };

    void loadRoot();
  }, [cwd]);

  // Auto-refresh when agent creates/edits/deletes files
  const refreshAllRef = React.useRef(refreshAll);
  const refreshDirRef = React.useRef(refreshDir);
  React.useEffect(() => {
    refreshAllRef.current = refreshAll;
    refreshDirRef.current = refreshDir;
  });

  useEffect(() => {
    const off = onFsChanged((paths?: string[]) => {
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
      base = `${base}/${p}`;
      dirs.push(base.replace(/\//g, "\\"));
    }
    (async () => {
      const results = await Promise.all(dirs.map((d) => fileService.list(d)));
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
      if (!cur?.open) {
        // Expand logic
        fileService.list(dir).then((res) => {
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

    const parts = name
      .trim()
      .split(/[\\/]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0) return;

    // The native API creates one child at a time. Walk the path and reuse
    // existing directories so inputs such as `i18n/new/v2` work naturally.
    let targetDir = dir;
    let res: { ok: true; path: string } | { ok: false; error: string } = { ok: true, path: targetDir };
    const directoryParts = kind === "dir" ? parts : parts.slice(0, -1);
    for (const part of directoryParts) {
      const listed = await fileService.list(targetDir);
      const existing = listed.ok ? listed.entries.find((entry) => entry.isDir && entry.name === part) : undefined;
      if (existing) {
        targetDir = existing.path;
        continue;
      }
      res = await fileService.createDir(targetDir, part);
      if (!res.ok) break;
      targetDir = res.path;
    }
    if (res.ok && kind === "file") {
      res = await fileService.createFile(targetDir, parts[parts.length - 1]!);
    }

    if (!res.ok) {
      alert(t("createFailed", { error: res.error }));
    } else {
      await refreshAll();
    }
  }

  async function commitRename(path: string, newName: string): Promise<void> {
    setRenaming(null);
    if (!newName.trim()) return;
    const parent = dirnameOf(path);
    const newPath = `${parent}/${newName}`;
    if (newPath === path) return;

    const res = await fileService.rename(path, newPath);
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
            const res = await fileService.rename(cutPath, `${p}/${basename(cutPath)}`);
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
            const res = await fileService.delete(p);
            if (!res.ok) alert(res.error);
            else refreshDir(dirnameOf(p));
          }
        },
      });
    } else if (cutPath) {
      items.push({
        label: t("paste"),
        onClick: async () => {
          const res = await fileService.rename(cutPath, `${p}/${basename(cutPath)}`);
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
    <div className={`ftree${isSwitchingRoot ? " ftree--switching-root" : ""}`}>
      <div className="ftree__header">
        <Tooltip text={displayedCwd}>
          <span className="ftree__root">{basename(displayedCwd)}</span>
        </Tooltip>
        <div className="ftree__actions">
          <Tooltip text={t("newFileTooltip")}>
            <button className="z-icon-button z-icon-button--compact" onClick={() => promptCreate(selectedDir, "file")}>
              <NewFileIcon />
            </button>
          </Tooltip>
          <Tooltip text={t("newFolderTooltip")}>
            <button className="z-icon-button z-icon-button--compact" onClick={() => promptCreate(selectedDir, "dir")}>
              <NewFolderIcon />
            </button>
          </Tooltip>
          <Tooltip text={t("refreshTooltip")}>
            <button className="z-icon-button z-icon-button--compact" onClick={refreshAll}>
              <RefreshIcon />
            </button>
          </Tooltip>
          <Tooltip text={t("collapseAllTooltip")}>
            <button className="z-icon-button z-icon-button--compact" onClick={collapseAll}>
              <CollapseAllIcon />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="ftree__search-toolbar">
        <div className="ftree__search-control">
          <span className="ftree__search-icon" aria-hidden="true">
            <SearchIcon size={14} />
          </span>
          <input
            className="ftree__search-input"
            type="search"
            value={searchQuery}
            placeholder={t("searchFilesPlaceholder")}
            aria-label={t("searchFilesPlaceholder")}
            spellCheck={false}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setSearchQuery("");
                event.currentTarget.blur();
              }
            }}
          />
          {searchQuery ? (
            <button
              type="button"
              className="ftree__search-clear"
              aria-label={t("clearFilter")}
              onClick={() => setSearchQuery("")}
            >
              <CloseIcon size={11} />
            </button>
          ) : null}
        </div>
      </div>
      <div
        ref={bodyRef}
        className="ftree__body"
        onContextMenu={(e) => {
          e.preventDefault();
          if (e.target === e.currentTarget) {
            setCtx({ x: e.clientX, y: e.clientY, entry: null, parent: displayedCwd });
          }
        }}
      >
        {searchQuery.trim() ? (
          <div className="ftree__search-results" role="listbox" aria-label={t("searchFilesPlaceholder")}>
            {searching ? (
              <div className="ftree__search-status">{t("searchingFiles")}</div>
            ) : searchError ? (
              <div className="ftree__error">{t("searchFilesFailed", { error: searchError })}</div>
            ) : searchMatches && searchMatches.length > 0 ? (
              searchMatches.map((match) => (
                <button
                  key={match.path}
                  type="button"
                  role="option"
                  aria-selected={match.path === activeFile}
                  className={`ftree__search-result${match.path === activeFile ? " ftree__search-result--active" : ""}`}
                  title={match.path}
                  onClick={() => onOpenFile(match.path)}
                >
                  <span className="ftree__search-result-icon" aria-hidden="true">
                    <FileIcon name={match.name} />
                  </span>
                  <span className="ftree__search-result-copy">
                    <span className="ftree__search-result-name">{match.name}</span>
                    <span className="ftree__search-result-path">{match.rel}</span>
                  </span>
                </button>
              ))
            ) : (
              <div className="ftree__search-status">{t("noMatchingFiles")}</div>
            )}
          </div>
        ) : (
          <>
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
            {creating && creating.dir === displayedCwd ? (
              <div className="ftree__row" style={{ paddingLeft: 8 }}>
                <span className="ftree__chev">
                  {creating.kind === "dir" ? <ChevronRightIcon open={false} /> : null}
                </span>
                <RenameInput
                  initial=""
                  kind={creating.kind}
                  onCommit={commitCreate}
                  onCancel={() => setCreating(null)}
                />
              </div>
            ) : null}
            {root?.map((e) => (
              <FileNode
                key={e.path}
                entry={e}
                depth={0}
                parent={displayedCwd}
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
                creating={creating}
                onCommitCreate={commitCreate}
                onCancelCreate={() => setCreating(null)}
                onSelectDir={setSelectedDir}
              />
            ))}
          </>
        )}
      </div>
      {ctx ? <ContextMenu x={ctx.x} y={ctx.y} items={buildMenuItems(ctx)} onClose={() => setCtx(null)} /> : null}
    </div>
  );
}
