import React from "react";
import { ChevronRightIcon, FolderIcon, FileIcon } from "../../Icons/index.js";
import { getLanguageFromFilename, getCachedHighlight } from "../../../utils/searchSyntax.js";
import type { TreeNode } from "../utils/searchTreeUtils.js";

export interface SearchTreeViewProps {
  treeNodes: TreeNode[];
  collapsedTree: Set<string>;
  onToggleTreeNode: (path: string) => void;
  query: string;
  matchCase: boolean;
  onOpenFile: (path: string, line?: number, column?: number, matchLength?: number) => void;
  onClose: () => void;
}

export function SearchTreeView({
  treeNodes,
  collapsedTree,
  onToggleTreeNode,
  query,
  matchCase,
  onOpenFile,
  onClose,
}: SearchTreeViewProps): React.ReactElement {
  const renderTreeRow = (node: TreeNode, depth: number, guidePositions: number[]): React.ReactNode[] => {
    const nodePath = node.path;
    const collapsed = collapsedTree.has(nodePath);
    const hasChildren = node.children.length > 0 || node.matches.length > 0;
    const elements: React.ReactNode[] = [];
    elements.push(
      <div
        key={`row-${nodePath}`}
        className="sc-tree-row"
        style={{ paddingLeft: 8 + depth * 10 }}
        onClick={() => {
          if (node.isDir) onToggleTreeNode(nodePath);
          else if (node.matches.length > 0) onToggleTreeNode(nodePath);
        }}
      >
        {guidePositions.map((pos, i) => (
          <span key={i} className="sc-guide-line" style={{ left: pos }} />
        ))}
        <span
          className="sc-chev"
          onClick={(e) => {
            e.stopPropagation();
            onToggleTreeNode(nodePath);
          }}
        >
          {hasChildren && <ChevronRightIcon open={!collapsed} />}
        </span>
        {node.isDir ? <FolderIcon open={false} name={node.name} /> : <FileIcon name={node.name} />}
        <span className="sc-tree-name">{node.name}</span>
        {!node.isDir && node.matches.length > 0 && (
          <>
            <span className="sc-tree-path">{node.path}</span>
            <span className="sc-match-badge">{node.matches.length}</span>
          </>
        )}
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
        node.matches.forEach((m) => {
          const lang = getLanguageFromFilename(m.name);
          elements.push(
            <div
              key={`match-${m.path}:${m.line}`}
              className="sc-match-row"
              style={{ paddingLeft: 8 + (depth + 1) * 10 + 14 }}
              onClick={() => {
                onOpenFile(m.path, m.line, m.column, query.length);
                onClose();
              }}
            >
              {guidePositions.map((pos, i) => (
                <span key={i} className="sc-guide-line" style={{ left: pos }} />
              ))}
              <span className="sc-match-content">{getCachedHighlight(m.content, lang, query, matchCase)}</span>
            </div>,
          );
        });
      }
    }
    return elements;
  };

  return <div className="sc-tree-view">{treeNodes.map((node) => renderTreeRow(node, 0, []))}</div>;
}
