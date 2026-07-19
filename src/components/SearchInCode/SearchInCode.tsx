import React from "react";
import { RefreshIcon, CollapseAllIcon, Loader2Icon, ClearIcon } from "../Icons/index.js";
import { Tooltip } from "../Tooltip/Tooltip.js";
import { useTranslate } from "../../hooks/useI18n.js";
import "@vscode/codicons/dist/codicon.css";
import "./SearchInCode.css";
import { getLanguageFromFilename } from "../../utils/searchSyntax.js";
import { useCodeSearch } from "./hooks/useCodeSearch.js";
import { SearchFilterBar } from "./components/SearchFilterBar.js";
import { SearchFileGroup } from "./components/SearchFileGroup.js";
import { SearchMatchRowMemo } from "./components/SearchMatchRow.js";
import { SearchTreeView } from "./components/SearchTreeView.js";

export interface SearchInCodeProps {
  cwd: string;
  onOpenFile: (path: string, line?: number, column?: number, matchLength?: number) => void;
  onClose: () => void;
}

export function SearchInCode({ cwd, onOpenFile, onClose }: SearchInCodeProps): React.ReactElement {
  const t = useTranslate();
  const searchState = useCodeSearch({ cwd, onOpenFile, onClose });

  const {
    query,
    replaceText,
    setReplaceText,
    matchCase,
    setMatchCase,
    matchWholeWord,
    setMatchWholeWord,
    useRegex,
    setUseRegex,
    preserveCase,
    setPreserveCase,
    replaceOpen,
    setReplaceOpen,
    showFilters,
    setShowFilters,
    includeFilter,
    setIncludeFilter,
    excludeFilter,
    setExcludeFilter,
    searching,
    viewAsTree,
    setViewAsTree,
    collapsedTree,
    fileEntries,
    totalMatches,
    fileMatchesMap,
    loadingFiles,
    collapsedFiles,
    selectedIndex,
    setSelectedIndex,
    inputRef,
    resultsRef,
    containerRef,
    flatRows,
    virtualizer,
    treeNodes,
    handleQueryChange,
    handleRefresh,
    handleClear,
    handleInputKeyDown,
    handleKeyDown,
    toggleFile,
    toggleTreeNode,
    handleCollapseAll,
  } = searchState;

  const fileCount = fileEntries.length;
  const resultCount = totalMatches;

  return (
    <div className="search-code" ref={containerRef} onKeyDown={handleKeyDown}>
      <div className="sc-header">
        <span className="sc-header-title">{t("searchInCode")}</span>
        <div className="sc-header-actions">
          <Tooltip text={t("refreshSearch")}>
            <button className="sc-action-btn" onClick={handleRefresh} aria-label={t("refreshSearch")}>
              <RefreshIcon />
            </button>
          </Tooltip>
          <Tooltip text={t("clearSearchResults")}>
            <button className="sc-action-btn" onClick={handleClear} aria-label={t("clearSearchResults")}>
              <ClearIcon />
            </button>
          </Tooltip>
          <Tooltip text={viewAsTree ? t("viewAsFlatList") : t("viewAsTree")}>
            <button
              className={`sc-action-btn ${viewAsTree ? "sc-action-btn--active" : ""}`}
              onClick={() => setViewAsTree((v) => !v)}
              aria-label={viewAsTree ? t("viewAsFlatList") : t("viewAsTree")}
              aria-pressed={viewAsTree}
            >
              <i className={viewAsTree ? "codicon codicon-list-flat" : "codicon codicon-list-tree"} />
            </button>
          </Tooltip>
          <Tooltip text={t("collapseAllTooltip")}>
            <button className="sc-action-btn" onClick={handleCollapseAll} aria-label={t("collapseAllTooltip")}>
              <CollapseAllIcon />
            </button>
          </Tooltip>
        </div>
      </div>

      <SearchFilterBar
        inputRef={inputRef}
        query={query}
        onQueryChange={handleQueryChange}
        onInputKeyDown={handleInputKeyDown}
        matchCase={matchCase}
        onToggleMatchCase={() => setMatchCase((v) => !v)}
        matchWholeWord={matchWholeWord}
        onToggleMatchWholeWord={() => setMatchWholeWord((v) => !v)}
        useRegex={useRegex}
        onToggleUseRegex={() => setUseRegex((v) => !v)}
        replaceOpen={replaceOpen}
        onToggleReplaceOpen={() => setReplaceOpen((v) => !v)}
        replaceText={replaceText}
        onReplaceTextChange={setReplaceText}
        preserveCase={preserveCase}
        onTogglePreserveCase={() => setPreserveCase((v) => !v)}
        showFilters={showFilters}
        onToggleShowFilters={() => setShowFilters((v) => !v)}
        includeFilter={includeFilter}
        onIncludeFilterChange={setIncludeFilter}
        excludeFilter={excludeFilter}
        onExcludeFilterChange={setExcludeFilter}
      />

      {query.trim() && !searching && (
        <div className="sc-summary">
          <span className="sc-summary-text">
            {resultCount === 0 ? t("noResultsFound") : t("searchInCodeResults", { count: resultCount, fileCount })}
          </span>
        </div>
      )}

      <div className="sc-results" ref={resultsRef}>
        {searching && !fileEntries.length && (
          <div className="sc-loading">
            <Loader2Icon />
          </div>
        )}

        {!query.trim() && !searching && <div className="sc-empty">{t("typeToSearch")}</div>}

        {!viewAsTree && fileEntries.length > 0 && (
          <div className="sc-flat-list" style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = flatRows[virtualRow.index];
              if (!row) return null;
              const entry = fileEntries[row.fileIndex];
              if (!entry) return null;

              if (row.type === "file-header") {
                const collapsed = collapsedFiles.has(entry.path);
                return (
                  <div
                    key={row.key}
                    className="sc-file-group"
                    data-index={virtualRow.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <SearchFileGroup
                      entry={entry}
                      collapsed={collapsed}
                      isSelected={virtualRow.index === selectedIndex}
                      onClick={() => toggleFile(entry.path)}
                      onMouseEnter={() => setSelectedIndex(virtualRow.index)}
                    />
                  </div>
                );
              }

              // Match row
              const fm = fileMatchesMap[entry.path];
              if (row.matchIndex === -1 || !fm) {
                return (
                  <div
                    key={row.key}
                    className={"sc-match-row" + (virtualRow.index === selectedIndex ? " sc-match-row--selected" : "")}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingLeft: 32,
                      color: "var(--fg-muted)",
                    }}
                    onMouseEnter={() => setSelectedIndex(virtualRow.index)}
                  >
                    {loadingFiles.has(entry.path) ? t("loadingMatches") : ""}
                  </div>
                );
              }
              if (row.matchIndex === -2) {
                return (
                  <div
                    key={row.key}
                    className={
                      "sc-match-row sc-match-row--last" +
                      (virtualRow.index === selectedIndex ? " sc-match-row--selected" : "")
                    }
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                      color: "var(--fg-muted)",
                      fontStyle: "italic",
                      paddingLeft: 32,
                      cursor: "default",
                    }}
                    onMouseEnter={() => setSelectedIndex(virtualRow.index)}
                  >
                    {t("moreMatches", { count: String(fm.total - 200) })}
                  </div>
                );
              }
              const m = fm.matches[row.matchIndex];
              if (!m) return null;
              const isLastMatch = row.matchIndex === fm.matches.length - 1 || row.matchIndex === 199;
              const lang = getLanguageFromFilename(entry.name);
              const isSelected = virtualRow.index === selectedIndex;
              return (
                <div
                  key={row.key}
                  className={isSelected ? "sc-match-row--selected-wrapper" : ""}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onMouseEnter={() => setSelectedIndex(virtualRow.index)}
                >
                  {row.matchIndex < 200 ? (
                    <SearchMatchRowMemo
                      match={m}
                      lang={lang}
                      query={query}
                      matchCase={matchCase}
                      isLastMatch={isLastMatch}
                      isSelected={isSelected}
                      onOpenFile={onOpenFile}
                      onClose={onClose}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {viewAsTree && treeNodes.length > 0 && (
          <SearchTreeView
            treeNodes={treeNodes}
            collapsedTree={collapsedTree}
            onToggleTreeNode={toggleTreeNode}
            loadingFiles={loadingFiles}
            query={query}
            matchCase={matchCase}
            onOpenFile={onOpenFile}
          />
        )}
      </div>
    </div>
  );
}
