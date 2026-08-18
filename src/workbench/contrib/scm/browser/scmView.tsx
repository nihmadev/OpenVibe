import { IconButton, Input, interactiveListClassName } from "@zazaru/ui";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader } from "@/base/browser/ui/loader/loader";
import { useI18n } from "@/platform/localization/localizationService";
import "@vscode/codicons/dist/codicon.css";
import "./scmView.css";
import type { BranchInfo, CommitFile, CommitGraphNode, CommitInfo, FileStatus } from "../../../services/scm/common/scm";
import { gitScmService } from "../../../services/scm/tauri/gitScmService";
import type { ScmViewProps } from "../common/scm";
import {
  buildCommitTree,
  buildTree,
  computeSwimlanes,
  GRAPH_LEFT_PADDING,
  GraphRow,
  SWIMLANE_WIDTH,
} from "./commitGraph";
import { GitBranchModal } from "./components/gitBranchModal";
import { GitCommitTooltip } from "./components/gitCommitTooltip";
import { CommitFileRow, CommitTreeFolder, FileRow, TreeFolder } from "./components/gitFileList";

const INITIAL_GRAPH_LIMIT = 300;

export function ScmView({ cwd, onOpenFile, onClose: _onClose }: ScmViewProps) {
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
  const [_loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [isGeneratingCommitMsg, setIsGeneratingCommitMsg] = useState(false);

  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);

  const [hoveredCommit, setHoveredCommit] = useState<CommitGraphNode | null>(null);
  const fetchGenerationRef = React.useRef(0);
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
  }, [hoveredCommit, tooltipPosition]);

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
      const res = await gitScmService.commitFiles(cwd, hash);
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
    const generation = ++fetchGenerationRef.current;
    setLoading(true);
    try {
      const graphPromise = gitScmService.graph(cwd, INITIAL_GRAPH_LIMIT);
      const [statusRes, branchRes, curBranchRes] = await Promise.all([
        gitScmService.status(cwd),
        gitScmService.branches(cwd),
        gitScmService.currentBranch(cwd),
      ]);

      if (fetchGenerationRef.current !== generation) return;
      if (statusRes.ok && Array.isArray(statusRes.data)) {
        setFiles(statusRes.data);
      }
      if (branchRes.ok && Array.isArray(branchRes.data)) {
        setBranches(branchRes.data);
      }
      if (curBranchRes.ok && typeof curBranchRes.data === "string") {
        setCurrentBranch(curBranchRes.data || "HEAD");
      }

      const graphRes = await graphPromise;
      if (fetchGenerationRef.current !== generation) return;
      if (graphRes.ok && Array.isArray(graphRes.data)) {
        setGraphNodes(graphRes.data);
      }
    } finally {
      if (fetchGenerationRef.current === generation) setLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    setFiles([]);
    setBranches([]);
    setGraphNodes([]);
    setSelectedCommit(null);
    setCommitFilesMap({});
    void fetchAllData();
    return () => {
      fetchGenerationRef.current += 1;
    };
  }, [fetchAllData]);

  // Stage / Unstage / Revert / Commit Handlers
  const handleStageAll = async () => {
    await gitScmService.stageAll(cwd);
    fetchAllData();
  };

  const handleStageFile = async (filePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await gitScmService.stageFile(cwd, filePath);
    fetchAllData();
  };

  const handleUnstageFile = async (filePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await gitScmService.unstageFile(cwd, filePath);
    fetchAllData();
  };

  const handleRevertFile = async (filePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await gitScmService.revertFile(cwd, filePath);
    fetchAllData();
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    const res = await gitScmService.commit(cwd, commitMessage);
    if (res.ok) {
      setCommitMessage("");
      fetchAllData();
    }
  };

  const handleCheckoutBranch = async (branchName: string) => {
    await gitScmService.checkoutBranch(cwd, branchName);
    setShowBranchModal(false);
    fetchAllData();
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    await gitScmService.createBranch(cwd, newBranchName.trim());
    await gitScmService.checkoutBranch(cwd, newBranchName.trim());
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
    return filteredFiles.filter((f) => f.staged || (f.indexStatus && f.indexStatus !== " " && f.indexStatus !== "?"));
  }, [filteredFiles]);

  const handleGenerateCommitMessage = async () => {
    if (!cwd || files.length === 0 || isGeneratingCommitMsg) return;
    setIsGeneratingCommitMsg(true);
    try {
      const res = await gitScmService.generateCommitMessage(cwd);
      if (res.ok && res.data) {
        setCommitMessage(res.data);
      } else if (!res.ok && res.error) {
        const errStr = String(res.error);
        console.error("Failed to generate commit message:", errStr);
        setCommitMessage(`[Error: ${errStr}]`);
      } else {
        setCommitMessage("[Error: Unknown error generated]");
      }
    } catch (e) {
      const errStr = String(e);
      console.error("Failed to generate commit message:", errStr);
      setCommitMessage(`[Error: ${errStr}]`);
    } finally {
      setIsGeneratingCommitMsg(false);
    }
  };

  const isCommitDisabled = !commitMessage.trim();
  const isWandDisabled = files.length === 0 || isGeneratingCommitMsg;
  const isContainerDisabled = isCommitDisabled && isWandDisabled;

  const changesFiles = useMemo(() => {
    return filteredFiles.filter((f) => f.worktreeStatus !== " ");
  }, [filteredFiles]);

  const stagedTree = useMemo(() => buildTree(stagedFiles), [stagedFiles]);
  const changesTree = useMemo(() => buildTree(changesFiles), [changesFiles]);

  const viewModels = useMemo(() => computeSwimlanes(graphNodes), [graphNodes]);
  const localBranchNames = useMemo(() => new Set(branches.map((branch) => branch.name)), [branches]);

  return (
    <div className="scm-view scm-container">
      {/* ── HEADER ── */}
      <div className="scm-header">
        <span>{t("sourceControl")}</span>
        <div className="actions">
          <IconButton
            scale="compact"
            pressed={viewMode === "tree"}
            title={viewMode === "list" ? t("viewAsTree") : t("viewAsFlatList")}
            aria-label={viewMode === "list" ? t("viewAsTree") : t("viewAsFlatList")}
            onClick={() => setViewMode(viewMode === "list" ? "tree" : "list")}
          >
            <i className={viewMode === "list" ? "codicon codicon-list-tree" : "codicon codicon-list-flat"}></i>
          </IconButton>
          <IconButton
            scale="compact"
            title={t("refreshTooltip")}
            aria-label={t("refreshTooltip")}
            onClick={fetchAllData}
          >
            <i className="codicon codicon-refresh"></i>
          </IconButton>
          <IconButton
            scale="compact"
            pressed={showMoreMenu}
            title={t("viewsAndMoreActions")}
            aria-label={t("viewsAndMoreActions")}
            onClick={() => setShowMoreMenu(!showMoreMenu)}
          >
            <i className="codicon codicon-ellipsis"></i>
          </IconButton>
        </div>
      </div>

      {/* ── MORE ACTIONS DROPDOWN MENU ── */}
      {showMoreMenu && (
        <div className={interactiveListClassName("scm-dropdown-menu")}>
          <button
            type="button"
            className="scm-menu-item"
            onClick={() => {
              setShowMoreMenu(false);
              handleStageAll();
            }}
          >
            <i className="codicon codicon-add"></i> {t("stageAllChanges")}
          </button>
          <button
            type="button"
            className="scm-menu-item"
            onClick={() => {
              setShowMoreMenu(false);
              setShowBranchModal(true);
            }}
          >
            <i className="codicon codicon-git-branch"></i> {t("checkoutCreateBranch")}
          </button>
          <div className="scm-menu-divider" />
          <button
            type="button"
            className="scm-menu-item"
            onClick={() => {
              setShowMoreMenu(false);
              fetchAllData();
            }}
          >
            <i className="codicon codicon-refresh"></i> {t("refreshStatus")}
          </button>
        </div>
      )}

      {/* ── BODY SECTIONS ── */}
      <div className="scm-body">
        {/* 1. REPOSITORIES SECTION */}
        <div className="scm-section">
          <div className="scm-section-header" onClick={() => toggleSection("repos")}>
            <div className="scm-section-title">
              <i className={`codicon codicon-chevron-${expanded.repos ? "down" : "right"}`}></i>
              <span>{t("repositories")}</span>
            </div>
          </div>

          {expanded.repos && (
            <div className="scm-list-row cursor-default" onClick={() => setShowBranchModal(true)}>
              <div className="scm-provider scm-repository-row">
                <i className="icon codicon codicon-repo scm-leading-icon"></i>
                <div className="scm-icon-label">
                  <div className="scm-icon-name scm-icon-name--strong">{cwd.split(/[\\/]/).pop()}</div>
                  <div className="scm-icon-description scm-branch-description">
                    <i className="codicon codicon-git-branch"></i>
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
            <div className="scm-section-title">
              <i className={`codicon codicon-chevron-${expanded.scm ? "down" : "right"}`}></i>
              <span>{t("sourceControl")}</span>
            </div>
            {files.length > 0 && <span className="scm-count-badge">{files.length}</span>}
          </div>

          {expanded.scm && (
            <div className="scm-list">
              {/* Commit Input Box */}
              <div className="scm-field-block">
                <div className="z-input-wrap scm-commit-input-wrap">
                  <textarea
                    className="scm-commit-input"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder={t("commitMessagePlaceholder", { branch: currentBranch })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        handleCommit();
                      }
                    }}
                  />
                </div>
              </div>

              {/* Split Commit Action Button */}
              <div className={`scm-split-button-container ${isContainerDisabled ? "disabled" : ""}`}>
                <button
                  className={`scm-split-button-main ${isCommitDisabled ? "disabled" : ""}`}
                  onClick={() => {
                    if (commitMessage.trim()) handleCommit();
                  }}
                  disabled={isCommitDisabled}
                >
                  <i className="codicon codicon-check"></i> {t("commitBtn")}
                </button>
                <div className="scm-split-button-separator" />
                <button
                  className={`scm-split-button-wand ${isWandDisabled ? "disabled" : ""}`}
                  onClick={handleGenerateCommitMessage}
                  disabled={isWandDisabled}
                  title={t("generateCommitMessage")}
                >
                  {isGeneratingCommitMsg ? (
                    <i className="codicon codicon-loading codicon-modifier-spin spin" />
                  ) : (
                    <i className="codicon codicon-wand" />
                  )}
                </button>
              </div>

              {/* Quick Filter Input */}
              {files.length > 3 && (
                <div className="scm-field-block">
                  <Input
                    containerClassName="scm-filter-input-wrap"
                    icon={<i className="codicon codicon-filter scm-filter-icon" />}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("filterChangesPlaceholder")}
                    rightElement={
                      searchQuery ? (
                        <IconButton
                          scale="compact"
                          className="scm-filter-clear"
                          title={t("clearFilter")}
                          aria-label={t("clearFilter")}
                          onClick={() => setSearchQuery("")}
                        >
                          <i className="codicon codicon-close" />
                        </IconButton>
                      ) : undefined
                    }
                  />
                </div>
              )}

              {files.length === 0 ? (
                <div className="scm-empty-state">{t("noChangesDetected")}</div>
              ) : (
                <div className="scm-list">
                  {/* STAGED CHANGES GROUP */}
                  {stagedFiles.length > 0 && (
                    <>
                      <div className="scm-list-row" onClick={() => toggleSection("staged")}>
                        <div className="resource-group scm-resource-group-row">
                          <div className="name scm-resource-group-name">
                            <i className={`codicon codicon-chevron-${expanded.staged ? "down" : "right"}`}></i>
                            <span>{t("stagedChanges")}</span>
                          </div>
                          <div className="actions">
                            <div
                              className="action-label"
                              title={t("unstageAll")}
                              onClick={(e) => {
                                e.stopPropagation();
                                stagedFiles.forEach((f) => {
                                  handleUnstageFile(f.path);
                                });
                              }}
                            >
                              <i className="codicon codicon-remove"></i>
                            </div>
                          </div>
                          <div className="count scm-count-badge">{stagedFiles.length}</div>
                        </div>
                      </div>

                      {expanded.staged && (
                        <div className="scm-group-children">
                          {viewMode === "list" ? (
                            stagedFiles.map((file) => (
                              <FileRow
                                key={`staged-${file.path}`}
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
                                  key={`staged-folder-${stagedTree.folders[fName].path}`}
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
                                  key={`staged-tree-${file.path}`}
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
                      <div className="scm-list-row" onClick={() => toggleSection("changes")}>
                        <div className="resource-group scm-resource-group-row">
                          <div className="name scm-resource-group-name">
                            <i className={`codicon codicon-chevron-${expanded.changes ? "down" : "right"}`}></i>
                            <span>{t("changes")}</span>
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
                          <div className="count scm-count-badge">{changesFiles.length}</div>
                        </div>
                      </div>

                      {expanded.changes && (
                        <div className="scm-group-children">
                          {viewMode === "list" ? (
                            changesFiles.map((file) => (
                              <FileRow
                                key={`changed-${file.path}`}
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
                                  key={`changed-folder-${changesTree.folders[fName].path}`}
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
                                  key={`changed-tree-${file.path}`}
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
          <div className="scm-section-header scm-section-header--graph" onClick={() => toggleSection("graph")}>
            <div className="scm-section-title">
              <i className={`codicon codicon-chevron-${expanded.graph ? "down" : "right"}`}></i>
              <span>{t("graph")}</span>
            </div>
            {graphNodes.length > 0 && <span className="scm-count-badge">{graphNodes.length}</span>}
          </div>

          {expanded.graph && (
            <div className="scm-list">
              {viewModels.length === 0 ? (
                <div className="scm-empty-state">{t("noCommitsInGraph")}</div>
              ) : (
                viewModels.map((vm) => {
                  const node = vm.node;
                  const isSelected = selectedCommit?.id === node.id;
                  const nodeRefs = node.refNames.filter((ref) => !(ref === currentBranch && node.isHead));
                  const visibleRefs = nodeRefs.slice(0, 2);
                  const hiddenRefs = nodeRefs.slice(2);

                  return (
                    <div key={node.id} className="scm-graph-item">
                      <div
                        onMouseEnter={(e) => handleCommitHover(node, e)}
                        onMouseLeave={handleCommitLeave}
                        onClick={async () => {
                          if (isSelected) {
                            setSelectedCommit(null);
                          } else {
                            const details = await gitScmService.commitDetails(cwd, node.id);
                            if (details.ok && details.data) {
                              setSelectedCommit(details.data);
                              loadCommitFiles(node.id);
                            }
                          }
                        }}
                        className={`scm-list-row scm-graph-list-row ${isSelected ? "selected" : ""}`}
                      >
                        <div className="history-item scm-graph-row">
                          <GraphRow viewModel={vm} />

                          <div className="scm-graph-summary-wrap">
                            <span className="scm-graph-summary">{node.summary}</span>
                          </div>

                          {/* Ref Tags */}
                          {(node.isHead || node.refNames.length > 0) && (
                            <div className="scm-ref-list">
                              {node.isHead && (
                                <span
                                  className="scm-ref-pill scm-ref-pill--head"
                                  title={`${currentBranch} (HEAD)`}
                                  aria-label={`${currentBranch} (HEAD)`}
                                >
                                  <i className="codicon codicon-target scm-ref-icon"></i>
                                  <span>{currentBranch}</span>
                                </span>
                              )}
                              {visibleRefs.map((ref) => {
                                const isRemote = !localBranchNames.has(ref);
                                return (
                                  <span
                                    key={ref}
                                    className={`scm-ref-pill ${isRemote ? "scm-ref-pill--remote" : "scm-ref-pill--local"}`}
                                    title={`${isRemote ? "Remote" : "Local"} branch: ${ref}`}
                                    aria-label={`${isRemote ? "Remote" : "Local"} branch: ${ref}`}
                                  >
                                    <i
                                      className={`codicon ${isRemote ? "codicon-cloud" : "codicon-git-branch"} scm-ref-icon`}
                                    ></i>
                                    <span>{ref}</span>
                                  </span>
                                );
                              })}
                              {hiddenRefs.length > 0 && (
                                <span
                                  className="scm-ref-pill scm-ref-pill--more"
                                  title={hiddenRefs.join(", ")}
                                  aria-label={`${hiddenRefs.length} more branches`}
                                >
                                  +{hiddenRefs.length}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="scm-expanded-commit">
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
                          <div className="scm-expanded-commit-files">
                            {loadingCommitFiles[node.id] ? (
                              <div className="scm-inline-empty">
                                <Loader />
                              </div>
                            ) : commitFilesMap[node.id] && commitFilesMap[node.id].length > 0 ? (
                              <div className="scm-group-children scm-group-children--clipped">
                                {(() => {
                                  const tree = buildCommitTree(commitFilesMap[node.id]);
                                  return (
                                    <>
                                      {Object.keys(tree.folders).map((fName) => (
                                        <CommitTreeFolder
                                          key={`commit-folder-${tree.folders[fName].path}`}
                                          folderName={fName}
                                          folderData={tree.folders[fName]}
                                          depth={0}
                                          expandedCommitFolders={expandedCommitFolders}
                                          onToggleCommitFolder={toggleCommitFolder}
                                          onOpenFile={(path) => openCommitFile(node.id, path)}
                                        />
                                      ))}
                                      {tree.files.map((file) => (
                                        <div key={`commit-tree-file-${file.path}`}>
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
                              <div className="scm-inline-empty">{t("noFilesChanged")}</div>
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
            const details = await gitScmService.commitDetails(cwd, commit.id);
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
