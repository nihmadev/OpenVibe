import React from "react";
import { ChevronRightIcon, FolderIcon, FileIcon } from "../../Icons/index.js";
import { getLanguageFromFilename, getCachedHighlight } from "../../../utils/searchSyntax.js";
import { useTranslate } from "../../../hooks/useI18n.js";
import type { TreeNode } from "../utils/searchTreeUtils.js";

export interface SearchTreeViewProps {
  treeNodes: TreeNode[];
  collapsedTree: Set<string>;
  onToggleTreeNode: (path: string, filePath?: string) => void;
  loadingFiles: Set<string>;
  query: string;
  matchCase: boolean;
  onOpenFile: (path: string, line?: number, column?: number, matchLength?: number) => void;
}

export function SearchTreeView({
  treeNodes,
  collapsedTree,
  onToggleTreeNode,
  loadingFiles,
  query,
  matchCase,
  onOpenFile,
}: SearchTreeViewProps): React.ReactElement {
  const t = useTranslate();

  const renderTreeRow = (node: TreeNode, depth: number, guidePositions: number[]): React.ReactNode[] => {
    const nodePath = node.path;
    const collapsed = collapsedTree.has(nodePath);
    const hasChildren = node.children.length > 0 || node.matchesCount > 0;
    const isLoading = !node.isDir && !!node.filePath && loadingFiles.has(node.filePath);
    const visibleMatchCount = Math.min(node.matches.length, 200);
    const remainingMatchCount = Math.max(0, node.matchesCount - visibleMatchCount);
    const elements: React.ReactNode[] = [];
    elements.push(
      <div
        key={`row-${nodePath}`}
        className="sc-tree-row"
        style={{ paddingLeft: 8 + depth * 10 }}
        onClick={() => {
          if (node.isDir) onToggleTreeNode(nodePath);
          else if (node.matchesCount > 0) onToggleTreeNode(nodePath, node.filePath);
        }}
      >
        {guidePositions.map((pos, i) => (
          <span key={i} className="sc-guide-line" style={{ left: pos }} />
        ))}
        <span
          className="sc-chev"
          onClick={(e) => {
            e.stopPropagation();
            onToggleTreeNode(nodePath, node.filePath);
          }}
        >
          {hasChildren && <ChevronRightIcon open={!collapsed} />}
        </span>
        {node.isDir ? <FolderIcon open={!collapsed} name={node.name} /> : <FileIcon name={node.name} />}
        <span className="sc-tree-name">{node.name}</span>
        {!node.isDir && <span className="sc-match-badge">{node.matchesCount}</span>}
      </div>,
    );

    if (!collapsed && hasChildren) {
      const childGuidePositions = [...guidePositions, 8 + depth * 10 + 6];
      if (node.children.length > 0) {
        node.children.forEach((child) => {
          elements.push(...renderTreeRow(child, depth + 1, childGuidePositions));
        });
      }
      if (node.matches.length > 0) {
        node.matches.slice(0, 200).forEach((m, matchIndex) => {
          const lang = getLanguageFromFilename(m.name);
          elements.push(
            <div
              key={`match-${m.path}:${m.line}:${m.column}:${matchIndex}`}
              className={`sc-match-row${matchIndex === visibleMatchCount - 1 ? " sc-match-row--last" : ""}`}
              style={{ paddingLeft: 8 + (depth + 1) * 10 + 14 }}
              onClick={() => {
                onOpenFile(m.path, m.line, m.column, query.length);
              }}
            >
              {childGuidePositions.map((pos, i) => (
                <span key={i} className="sc-guide-line" style={{ left: pos }} />
              ))}
              <span className="sc-match-content">{getCachedHighlight(m.content, lang, query, matchCase)}</span>
            </div>,
          );
        });
      }
      if (!node.isDir && isLoading && node.matches.length === 0) {
        elements.push(
          <div
            key={`loading-${nodePath}`}
            className="sc-tree-message"
            style={{ paddingLeft: 8 + (depth + 1) * 10 + 14 }}
          >
            {childGuidePositions.map((pos, i) => (
              <span key={i} className="sc-guide-line" style={{ left: pos }} />
            ))}
            {t("loadingMatches")}
          </div>,
        );
      }
      if (!node.isDir && !isLoading && remainingMatchCount > 0) {
        elements.push(
          <div key={`more-${nodePath}`} className="sc-tree-message" style={{ paddingLeft: 8 + (depth + 1) * 10 + 14 }}>
            {t("moreMatches", { count: String(remainingMatchCount) })}
          </div>,
        );
      }
    }
    return elements;
  };

  return <div className="sc-tree-view">{treeNodes.map((node) => renderTreeRow(node, 0, []))}</div>;
}
