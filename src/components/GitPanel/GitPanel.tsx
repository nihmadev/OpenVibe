import React, { useState, useEffect, useCallback, useMemo } from "react";
import { vibe } from "../../tauri-bridge.js";
import { useI18n } from "../../hooks/useI18n.js";
import "@vscode/codicons/dist/codicon.css";
import "./scm.css";
import "./GitPanel.css";
import type { GitPanelProps, FileStatus, BranchInfo, CommitGraphNode, CommitInfo, CommitFile } from "./types.js";
import {
  computeSwimlanes,
  GraphRow,
  buildTree,
  buildCommitTree,
  SWIMLANE_WIDTH,
  GRAPH_LEFT_PADDING,
} from "./utils/commitGraphUtils.js";
import { FileRow, TreeFolder, CommitFileRow, CommitTreeFolder } from "./components/GitFileList.js";
import { GitCommitTooltip } from "./components/GitCommitTooltip.js";
import { GitBranchModal } from "./components/GitBranchModal.js";

export function GitPanel({ cwd, onOpenFile, onClose }: GitPanelProps) {
  const { t } = useI18n();

  const handleOpenFile = useCallback(
    (path: string) => {
      if (!onOpenFile) return;
      if (path.startsWith("git-diff:")) {
        onOpenFile(path);
        return;
      }
      if (path.startsWith(cwd)) {
        onOpenFile(path);
      } else {
        const isWin = cwd.includes("\\");
        const sep = cwd.endsWith("/") || cwd.endsWith("\\") ? "" : isWin ? "\\" : "/";
        onOpenFile(cwd + sep + path);
      }
    },
    [cwd, onOpenFile],
  );

  const getAbsPath = useCallback(
    (relPath: string) => {
      if (relPath.startsWith(cwd)) return relPath;
      const isWin = cwd.includes("\\");
      const sep = cwd.endsWith("/") || cwd.endsWith("\\") ? "" : isWin ? "\\" : "/";
      return cwd + sep + relPath;
    },
    [cwd],
  );

  const openStagedFile = useCallback(
    (path: string) => {
      handleOpenFile(`git-diff:?type=staged&path=${encodeURIComponent(getAbsPath(path))}`);
    },
    [handleOpenFile, getAbsPath],
  );

  const openWorkingFile = useCallback(
    (path: string) => {
      handleOpenFile(`git-diff:?type=working&path=${encodeURIComponent(getAbsPath(path))}`);
    },
    [handleOpenFile, getAbsPath],
  );

  const openCommitFile = useCallback(
    (hash: string, path: string) => {
      handleOpenFile(`git-diff:?type=commit&hash=${hash}&path=${encodeURIComponent(getAbsPath(path))}`);
    },
    [handleOpenFile, getAbsPath],
  );

  const [files, setFiles] = useState<FileStatus[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>("main");
  const [graphNodes, setGraphNodes] = useState<CommitGraphNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);

  const [hoveredCommit, setHoveredCommit] = useState<CommitGraphNode | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
    align?: "left" | "right";
    targetLeft?: number;
    targetRight?: number;
  }>({ x: 0, y: 0 });
  const hideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTooltipHoveredRef = React.useRef(false);
  const tooltipRef = React.useRef<HTMLDivElement>(null);

  const [commitFilesMap, setCommitFilesMap] = useState<Record<string, CommitFile[]>>({});
  const [loadingCommitFiles, setLoadingCommitFiles] = useState<Record<string, boolean>>({});
  const [expandedCommitFolders, setExpandedCommitFolders] = useState<Set<string>>(new Set());

  // Section expand states
  const [expanded, setExpanded] = useState({
    repos: true,
    scm: true,
    graph: true,
    staged: true,
    changes: true,
  });

  // Folder collapse states for tree view
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Modals & Context Menus
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  React.useLayoutEffect(() => {
    if (hoveredCommit && tooltipRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const margin = 8;

      // Horizontal positioning based on actual measured width so short commits are positioned right next to the panel
      let left = tooltipPosition.x;
      if (tooltipPosition.align === "left" && tooltipPosition.targetLeft !== undefined) {
        left = tooltipPosition.targetLeft - tooltipRect.width - 6;
      } else if (tooltipPosition.align === "right" && tooltipPosition.targetRight !== undefined) {
        left = tooltipPosition.targetRight + 6;
        if (left + tooltipRect.width > windowWidth - margin && tooltipPosition.targetLeft !== undefined) {
          left = tooltipPosition.targetLeft - tooltipRect.width - 6;
        }
      }
      if (left < margin) {
        left = margin;
      }
      if (left + tooltipRect.width > windowWidth - margin) {
        left = Math.max(margin, windowWidth - tooltipRect.width - margin);
      }
      tooltipRef.current.style.left = `${left}px`;

      // Vertical positioning
      let top = tooltipPosition.y - tooltipRect.height / 2;

      if (top + tooltipRect.height > windowHeight - margin) {
        top = windowHeight - tooltipRect.height - margin;
      }
      if (top < margin) {
        top = margin;
      }

      tooltipRef.current.style.top = `${top}px`;
    }
  }, [hoveredCommit, tooltipPosition, hoveredCommit ? commitFilesMap[hoveredCommit.id] : undefined]);

  const toggleSection = (section: keyof typeof expanded) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  const handleCommitHover = (commit: CommitGraphNode, e: React.MouseEvent) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const estimatedWidth = 400;
    const windowWidth = window.innerWidth;

    // Smart positioning: check if there's space on the right, otherwise open on the left right next to the panel
    const align: "left" | "right" = rect.right + 6 + estimatedWidth > windowWidth ? "left" : "right";
    const x = align === "right" ? rect.right + 6 : Math.max(8, rect.left - estimatedWidth - 6);

    setTooltipPosition({
      x,
      y: rect.top + rect.height / 2,
      align,
      targetLeft: rect.left,
      targetRight: rect.right,
    });

    setHoveredCommit(commit);
    loadCommitFiles(commit.id);
  };

  const handleCommitLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      if (!isTooltipHoveredRef.current) {
        setHoveredCommit(null);
      }
    }, 150);
  };

  const handleTooltipEnter = () => {
    isTooltipHoveredRef.current = true;
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const handleTooltipLeave = () => {
    isTooltipHoveredRef.current = false;
    hideTimeoutRef.current = setTimeout(() => {
      if (!isTooltipHoveredRef.current) {
        setHoveredCommit(null);
      }
    }, 150);
  };

  const toggleCommitFolder = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedCommitFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedCommitFolders(newExpanded);
  };

  const loadCommitFiles = async (hash: string) => {
    if (commitFilesMap[hash]) return;
    setLoadingCommitFiles((prev) => ({ ...prev, [hash]: true }));
    try {
      const res = await vibe.git.commitFiles(cwd, hash);
      if (res.ok && res.data) {
        setCommitFilesMap((prev) => ({ ...prev, [hash]: res.data }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCommitFiles((prev) => ({ ...prev, [hash]: false }));
    }
  };

  // Fetch Git Status, Branches, and Graph
  const fetchAllData = useCallback(async () => {
    if (!cwd) return;
    setLoading(true);
    try {
      const [statusRes, branchRes, curBranchRes, graphRes] = await Promise.all([
        vibe.git.status(cwd),
        vibe.git.branches(cwd),
        vibe.git.currentBranch(cwd),
        vibe.git.graph(cwd, 9999999),
      ]);

      if (statusRes.ok && Array.isArray(statusRes.data)) {
        setFiles(statusRes.data);
      }
      if (branchRes.ok && Array.isArray(branchRes.data)) {
        setBranches(branchRes.data);
      }
      if (curBranchRes.ok && typeof curBranchRes.data === "string") {
        setCurrentBranch(curBranchRes.data || "HEAD");
      }
      if (graphRes.ok && Array.isArray(graphRes.data)) {
        setGraphNodes(graphRes.data);
      }
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Stage / Unstage / Revert / Commit Handlers
  const handleStageAll = async () => {
    await vibe.git.stageAll(cwd);
    fetchAllData();
  };

  const handleStageFile = async (filePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await vibe.git.stageFile(cwd, filePath);
    fetchAllData();
  };

  const handleUnstageFile = async (filePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await vibe.git.unstageFile(cwd, filePath);
    fetchAllData();
  };

  const handleRevertFile = async (filePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await vibe.git.revertFile(cwd, filePath);
    fetchAllData();
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    const res = await vibe.git.commit(cwd, commitMessage);
    if (res.ok) {
      setCommitMessage("");
      fetchAllData();
    }
  };

  const handleCheckoutBranch = async (branchName: string) => {
    await vibe.git.checkoutBranch(cwd, branchName);
    setShowBranchModal(false);
    fetchAllData();
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    await vibe.git.createBranch(cwd, newBranchName.trim());
    await vibe.git.checkoutBranch(cwd, newBranchName.trim());
    setNewBranchName("");
    setShowBranchModal(false);
    fetchAllData();
  };

  // Filtered file groups
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter((f) => f.path.toLowerCase().includes(q));
  }, [files, searchQuery]);

  const stagedFiles = useMemo(() => {
    return filteredFiles.filter((f) => f.indexStatus !== " " && f.indexStatus !== "?");
  }, [filteredFiles]);

  const changesFiles = useMemo(() => {
    return filteredFiles.filter((f) => f.worktreeStatus !== " ");
  }, [filteredFiles]);

  const stagedTree = useMemo(() => buildTree(stagedFiles), [stagedFiles]);
  const changesTree = useMemo(() => buildTree(changesFiles), [changesFiles]);

  const viewModels = useMemo(() => computeSwimlanes(graphNodes), [graphNodes]);

  return (
    <div className="scm-view scm-container">
      {/* ── HEADER ── */}
      <div className="scm-header">
        <span>{t("sourceControl")}</span>
        <div className="actions">
          <button
            className="action-label"
            title={viewMode === "list" ? t("viewAsTree") : t("viewAsFlatList")}
            onClick={() => setViewMode(viewMode === "list" ? "tree" : "list")}
            style={{
              backgroundColor: viewMode === "tree" ? "var(--bg-3)" : "transparent",
            }}
          >
            <i className={viewMode === "list" ? "codicon codicon-list-tree" : "codicon codicon-list-flat"}></i>
          </button>
          <button className="action-label" title={t("refreshTooltip")} onClick={fetchAllData}>
            <i className="codicon codicon-refresh"></i>
          </button>
          <button
            className="action-label"
            title={t("viewsAndMoreActions")}
            onClick={() => setShowMoreMenu(!showMoreMenu)}
          >
            <i className="codicon codicon-ellipsis"></i>
          </button>
        </div>
      </div>

      {/* ── MORE ACTIONS DROPDOWN MENU ── */}
      {showMoreMenu && (
        <div className="scm-dropdown-menu">
          <div
            className="scm-menu-item"
            onClick={() => {
              setShowMoreMenu(false);
              handleStageAll();
            }}
          >
            <i className="codicon codicon-add" style={{ marginRight: 8 }}></i> {t("stageAllChanges")}
          </div>
          <div
            className="scm-menu-item"
            onClick={() => {
              setShowMoreMenu(false);
              setShowBranchModal(true);
            }}
          >
            <i className="codicon codicon-git-branch" style={{ marginRight: 8 }}></i> {t("checkoutCreateBranch")}
          </div>
          <div className="scm-menu-divider" />
          <div
            className="scm-menu-item"
            onClick={() => {
              setShowMoreMenu(false);
              fetchAllData();
            }}
          >
            <i className="codicon codicon-refresh" style={{ marginRight: 8 }}></i> {t("refreshStatus")}
          </div>
        </div>
      )}

      {/* ── BODY SECTIONS ── */}
      <div className="scm-body" style={{ flex: 1, overflowY: "auto" }}>
        {/* 1. REPOSITORIES SECTION */}
        <div className="scm-section">
          <div className="scm-section-header" onClick={() => toggleSection("repos")}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <i className={`codicon codicon-chevron-${expanded.repos ? "down" : "right"}`}></i>
              <span>{t("repositories")}</span>
            </div>
          </div>

          {expanded.repos && (
            <div
              className="monaco-list-row cursor-default"
              onClick={() => setShowBranchModal(true)}
              style={{ height: 22 }}
            >
              <div
                className="scm-provider"
                style={{ width: "100%", paddingLeft: 8, display: "flex", flexDirection: "row", alignItems: "center" }}
              >
                <i className="icon codicon codicon-repo" style={{ marginRight: 6 }}></i>
                <div className="monaco-icon-label" style={{ display: "flex", flex: 1, alignItems: "center" }}>
                  <div className="monaco-icon-name-container" style={{ fontWeight: 600 }}>
                    {cwd.split(/[\\/]/).pop()}
                  </div>
                  <div
                    className="monaco-icon-description-container"
                    style={{ display: "flex", alignItems: "center", opacity: 0.7 }}
                  >
                    <i className="codicon codicon-git-branch" style={{ marginRight: 4, fontSize: 12 }}></i>
                    {currentBranch}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. SOURCE CONTROL SECTION */}
        <div className="scm-section">
          <div className="scm-section-header" onClick={() => toggleSection("scm")}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <i className={`codicon codicon-chevron-${expanded.scm ? "down" : "right"}`}></i>
              <span>{t("sourceControl")}</span>
            </div>
            {files.length > 0 && <span className="monaco-count-badge">{files.length}</span>}
          </div>

          {expanded.scm && (
            <div className="monaco-list">
              {/* Commit Input Box */}
              <div style={{ padding: "0 12px 12px 12px" }}>
                <div
                  className="sc-input-wrap"
                  style={{
                    backgroundColor: "var(--bg-2)",
                    border: "1px solid var(--line)",
                    borderRadius: "4px",
                    padding: "4px 8px",
                  }}
                >
                  <textarea
                    className="sc-input"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder={t("commitMessagePlaceholder", { branch: currentBranch })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        handleCommit();
                      }
                    }}
                    style={{
                      width: "100%",
                      minHeight: "60px",
                      border: "none",
                      background: "transparent",
                      outline: "none",
                      color: "var(--fg)",
                      fontSize: "13px",
                      resize: "vertical",
                      padding: 0,
                    }}
                  />
                </div>
              </div>

              {/* Commit Action Button */}
              <button
                className={`scm-action-button ${!commitMessage.trim() ? "disabled" : ""}`}
                onClick={() => {
                  if (commitMessage.trim()) handleCommit();
                }}
                disabled={!commitMessage.trim()}
              >
                <i className="codicon codicon-check"></i> {t("commitBtn")}
              </button>

              {/* Quick Filter Input */}
              {files.length > 3 && (
                <div style={{ padding: "0 12px 12px 12px" }}>
                  <div
                    className="sc-input-wrap"
                    style={{
                      backgroundColor: "var(--bg-2)",
                      border: "1px solid var(--line)",
                      borderRadius: "4px",
                      padding: "2px 8px",
                    }}
                  >
                    <i
                      className="codicon codicon-filter"
                      style={{
                        fontSize: 12,
                        color: "var(--fg-muted)",
                        opacity: 0.7,
                        marginRight: 6,
                        flexShrink: 0,
                      }}
                    />
                    <input
                      type="text"
                      className="sc-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t("filterChangesPlaceholder")}
                      style={{
                        width: "100%",
                        height: "24px",
                        border: "none",
                        background: "transparent",
                        outline: "none",
                        color: "var(--fg)",
                        fontSize: "13px",
                        padding: 0,
                      }}
                    />
                    {searchQuery && (
                      <i
                        className="codicon codicon-close"
                        title={t("clearFilter")}
                        onClick={() => setSearchQuery("")}
                        style={{
                          fontSize: 12,
                          color: "var(--fg-dim)",
                          cursor: "pointer",
                          marginLeft: 6,
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>
                </div>
              )}

              {files.length === 0 ? (
                <div style={{ padding: "16px 12px", textAlign: "center", opacity: 0.6, fontSize: "12px" }}>
                  {t("noChangesDetected")}
                </div>
              ) : (
                <div className="monaco-list">
                  {/* STAGED CHANGES GROUP */}
                  {stagedFiles.length > 0 && (
                    <>
                      <div className="monaco-list-row" onClick={() => toggleSection("staged")}>
                        <div
                          className="resource-group"
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            paddingRight: 8,
                          }}
                        >
                          <div className="name" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <i className={`codicon codicon-chevron-${expanded.staged ? "down" : "right"}`}></i>
                            <span style={{ fontWeight: 600 }}>{t("stagedChanges")}</span>
                          </div>
                          <div className="actions">
                            <div
                              className="action-label"
                              title={t("unstageAll")}
                              onClick={(e) => {
                                e.stopPropagation();
                                stagedFiles.forEach((f) => handleUnstageFile(f.path));
                              }}
                            >
                              <i className="codicon codicon-remove"></i>
                            </div>
                          </div>
                          <div className="count monaco-count-badge">{stagedFiles.length}</div>
                        </div>
                      </div>

                      {expanded.staged && (
                        <div className="scm-group-children">
                          {viewMode === "list" ? (
                            stagedFiles.map((file) => (
                              <FileRow
                                key={"staged-" + file.path}
                                file={file}
                                isStaged={true}
                                onOpenFile={openStagedFile}
                                onStageFile={handleStageFile}
                                onUnstageFile={handleUnstageFile}
                                onRevertFile={handleRevertFile}
                              />
                            ))
                          ) : (
                            <>
                              {Object.keys(stagedTree.folders).map((fName) => (
                                <TreeFolder
                                  key={"staged-folder-" + stagedTree.folders[fName].path}
                                  folderName={fName}
                                  folderData={stagedTree.folders[fName]}
                                  isStaged={true}
                                  depth={1}
                                  expandedFolders={expandedFolders}
                                  onToggleFolder={toggleFolder}
                                  onOpenFile={openStagedFile}
                                  onStageFile={handleStageFile}
                                  onUnstageFile={handleUnstageFile}
                                  onRevertFile={handleRevertFile}
                                />
                              ))}
                              {stagedTree.files.map((file) => (
                                <FileRow
                                  key={"staged-tree-" + file.path}
                                  file={file}
                                  isStaged={true}
                                  onOpenFile={openStagedFile}
                                  onStageFile={handleStageFile}
                                  onUnstageFile={handleUnstageFile}
                                  onRevertFile={handleRevertFile}
                                />
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* CHANGES GROUP */}
                  {changesFiles.length > 0 && (
                    <>
                      <div className="monaco-list-row" onClick={() => toggleSection("changes")}>
                        <div
                          className="resource-group"
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            paddingRight: 8,
                          }}
                        >
                          <div className="name" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <i className={`codicon codicon-chevron-${expanded.changes ? "down" : "right"}`}></i>
                            <span style={{ fontWeight: 600 }}>{t("changes")}</span>
                          </div>
                          <div className="actions">
                            <div
                              className="action-label"
                              title={t("stageAllChanges")}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStageAll();
                              }}
                            >
                              <i className="codicon codicon-add"></i>
                            </div>
                          </div>
                          <div className="count monaco-count-badge">{changesFiles.length}</div>
                        </div>
                      </div>

                      {expanded.changes && (
                        <div className="scm-group-children">
                          {viewMode === "list" ? (
                            changesFiles.map((file) => (
                              <FileRow
                                key={"changed-" + file.path}
                                file={file}
                                isStaged={false}
                                onOpenFile={openWorkingFile}
                                onStageFile={handleStageFile}
                                onUnstageFile={handleUnstageFile}
                                onRevertFile={handleRevertFile}
                              />
                            ))
                          ) : (
                            <>
                              {Object.keys(changesTree.folders).map((fName) => (
                                <TreeFolder
                                  key={"changed-folder-" + changesTree.folders[fName].path}
                                  folderName={fName}
                                  folderData={changesTree.folders[fName]}
                                  isStaged={false}
                                  depth={1}
                                  expandedFolders={expandedFolders}
                                  onToggleFolder={toggleFolder}
                                  onOpenFile={openWorkingFile}
                                  onStageFile={handleStageFile}
                                  onUnstageFile={handleUnstageFile}
                                  onRevertFile={handleRevertFile}
                                />
                              ))}
                              {changesTree.files.map((file) => (
                                <FileRow
                                  key={"changed-tree-" + file.path}
                                  file={file}
                                  isStaged={false}
                                  onOpenFile={openWorkingFile}
                                  onStageFile={handleStageFile}
                                  onUnstageFile={handleUnstageFile}
                                  onRevertFile={handleRevertFile}
                                />
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. SOURCE CONTROL GRAPH SECTION */}
        <div className="scm-section">
          <div className="scm-section-header" onClick={() => toggleSection("graph")}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <i className={`codicon codicon-chevron-${expanded.graph ? "down" : "right"}`}></i>
              <span>{t("graph")}</span>
            </div>
            {graphNodes.length > 0 && <span className="monaco-count-badge">{graphNodes.length}</span>}
          </div>

          {expanded.graph && (
            <div className="monaco-list">
              {viewModels.length === 0 ? (
                <div style={{ padding: "16px 12px", textAlign: "center", opacity: 0.6, fontSize: "12px" }}>
                  {t("noCommitsInGraph")}
                </div>
              ) : (
                viewModels.map((vm) => {
                  const node = vm.node;
                  const isSelected = selectedCommit?.id === node.id;

                  return (
                    <div key={node.id} style={{ display: "flex", flexDirection: "column" }}>
                      <div
                        className={`monaco-list-row ${isSelected ? "selected" : ""}`}
                        onMouseEnter={(e) => handleCommitHover(node, e)}
                        onMouseLeave={handleCommitLeave}
                        onClick={async () => {
                          if (isSelected) {
                            setSelectedCommit(null);
                          } else {
                            const details = await vibe.git.commitDetails(cwd, node.id);
                            if (details.ok && details.data) {
                              setSelectedCommit(details.data);
                              loadCommitFiles(node.id);
                            }
                          }
                        }}
                        style={{ paddingLeft: 4, paddingRight: 4 }}
                      >
                        <div className="history-item" style={{ display: "flex", width: "100%", alignItems: "center" }}>
                          <GraphRow viewModel={vm} />

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              flex: 1,
                              minWidth: 0,
                              paddingLeft: 4,
                              paddingRight: 8,
                            }}
                          >
                            <span
                              style={{
                                flex: 1,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                fontSize: 12,
                              }}
                            >
                              {node.summary}
                            </span>
                          </div>

                          {/* Ref Tags */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              marginLeft: "auto",
                              flexShrink: 0,
                              gap: 4,
                              paddingRight: 4,
                              maxWidth: "240px",
                              overflow: "hidden",
                            }}
                          >
                            {node.isHead && (
                              <span
                                className="scm-ref-pill head"
                                title={currentBranch}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "1px 6px",
                                  fontSize: 10,
                                  borderRadius: 10,
                                  backgroundColor: "var(--bg-3)",
                                  color: "var(--fg)",
                                  border: "1px solid var(--line)",
                                  maxWidth: "120px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <i
                                  className="codicon codicon-target"
                                  style={{ fontSize: 10, marginRight: 2, color: "#68d391", flexShrink: 0 }}
                                ></i>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{currentBranch}</span>
                              </span>
                            )}
                            {node.refNames.map((ref) => {
                              if (ref.includes(currentBranch) && node.isHead) return null;
                              const isRemote = ref.startsWith("origin/") || ref.includes("/");
                              return (
                                <span
                                  key={ref}
                                  title={ref}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "1px 6px",
                                    fontSize: 10,
                                    borderRadius: 10,
                                    backgroundColor: "var(--bg-3)",
                                    color: isRemote ? "#b794f4" : "#63b3ed",
                                    border: "1px solid var(--line)",
                                    maxWidth: "120px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <i
                                    className="codicon codicon-git-branch"
                                    style={{ fontSize: 10, marginRight: 2, flexShrink: 0 }}
                                  ></i>
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{ref}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div
                          style={{
                            backgroundColor: "transparent",
                            fontSize: "12px",
                            borderBottom: "1px solid var(--line)",
                            display: "flex",
                            paddingLeft: 4,
                            paddingRight: 4,
                          }}
                        >
                          <div
                            style={{
                              width: `${GRAPH_LEFT_PADDING + Math.max(vm.inputSwimlanes.length, vm.outputSwimlanes.length, 1) * SWIMLANE_WIDTH + 8}px`,
                              flexShrink: 0,
                              position: "relative",
                            }}
                          >
                            <svg
                              style={{
                                position: "absolute",
                                top: 0,
                                bottom: 0,
                                left: 0,
                                right: 0,
                                width: "100%",
                                height: "100%",
                                overflow: "visible",
                              }}
                            >
                              {vm.outputSwimlanes.map((lane, idx) => {
                                const x = GRAPH_LEFT_PADDING + idx * SWIMLANE_WIDTH + SWIMLANE_WIDTH / 2;
                                return (
                                  <line key={idx} x1={x} y1="0" x2={x} y2="100%" stroke={lane.color} strokeWidth="2" />
                                );
                              })}
                            </svg>
                          </div>
                          <div style={{ flex: 1, overflow: "hidden", paddingBottom: 8 }}>
                            {loadingCommitFiles[node.id] ? (
                              <div style={{ padding: "8px 12px", opacity: 0.6 }}>Loading files...</div>
                            ) : commitFilesMap[node.id] && commitFilesMap[node.id].length > 0 ? (
                              <div className="scm-group-children" style={{ overflow: "hidden" }}>
                                {(() => {
                                  const tree = buildCommitTree(commitFilesMap[node.id]);
                                  return (
                                    <>
                                      {Object.keys(tree.folders).map((fName) => (
                                        <CommitTreeFolder
                                          key={"commit-folder-" + tree.folders[fName].path}
                                          folderName={fName}
                                          folderData={tree.folders[fName]}
                                          depth={0}
                                          expandedCommitFolders={expandedCommitFolders}
                                          onToggleCommitFolder={toggleCommitFolder}
                                          onOpenFile={(path) => openCommitFile(node.id, path)}
                                        />
                                      ))}
                                      {tree.files.map((file) => (
                                        <div key={"commit-tree-file-" + file.path}>
                                          <CommitFileRow
                                            file={file}
                                            onOpenFile={(path) => openCommitFile(node.id, path)}
                                          />
                                        </div>
                                      ))}
                                    </>
                                  );
                                })()}
                              </div>
                            ) : commitFilesMap[node.id] ? (
                              <div style={{ padding: "8px 12px", opacity: 0.6 }}>{t("noFilesChanged")}</div>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── BRANCH MANAGEMENT MODAL ── */}
      {showBranchModal && (
        <GitBranchModal
          branches={branches}
          newBranchName={newBranchName}
          onNewBranchNameChange={setNewBranchName}
          onCreateBranch={handleCreateBranch}
          onCheckoutBranch={handleCheckoutBranch}
          onClose={() => setShowBranchModal(false)}
        />
      )}

      {/* ── TOOLTIP PORTAL (Exact VSCode Commit Hover Layout) ── */}
      {hoveredCommit && (
        <GitCommitTooltip
          hoveredCommit={hoveredCommit}
          tooltipPosition={tooltipPosition}
          tooltipRef={tooltipRef}
          currentBranch={currentBranch}
          commitFilesMap={commitFilesMap}
          onTooltipEnter={handleTooltipEnter}
          onTooltipLeave={handleTooltipLeave}
          onSelectCommit={async (commit) => {
            const details = await vibe.git.commitDetails(cwd, commit.id);
            if (details.ok && details.data) {
              setSelectedCommit(details.data);
              loadCommitFiles(commit.id);
            }
          }}
        />
      )}
    </div>
  );
}
