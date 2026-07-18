import React from "react";
import type { CommitGraphNode, CommitViewModel, SwimlaneNode, FileStatus, CommitFile } from "../types.js";

// Format relative time helper
export function formatRelativeTime(timestampSeconds: number): string {
  if (!timestampSeconds) return "";
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestampSeconds;
  if (diff < -30) {
    return `in ${formatRelativeTime(timestampSeconds + diff * 2)}`;
  }
  if (diff < 30) return "now";
  if (diff < 60) return diff === 1 ? "1 second ago" : `${diff} seconds ago`;
  if (diff < 3600) {
    const mins = Math.floor(diff / 60);
    return mins === 1 ? "1 minute ago" : `${mins} minutes ago`;
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }
  if (diff < 2592000) {
    const weeks = Math.floor(diff / 604800);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  if (diff < 31536000) {
    const months = Math.floor(diff / 2592000);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }
  const years = Math.floor(diff / 31536000);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

// Lane colors palette matching VS Code Git Graph
export const LANE_COLORS = ["#3794ff", "#e06c75", "#98c379", "#d19a66", "#c678dd", "#56b6c2", "#e5c07b", "#61afef"];

export const SWIMLANE_WIDTH = 14;
export const SWIMLANE_HEIGHT = 22;
export const CIRCLE_RADIUS = 3;
export const CIRCLE_STROKE_WIDTH = 1.5;

export function computeSwimlanes(nodes: CommitGraphNode[]): CommitViewModel[] {
  let colorIndex = -1;
  const viewModels: CommitViewModel[] = [];

  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    const outputSwimlanesFromPreviousItem = viewModels.at(-1)?.outputSwimlanes ?? [];
    const inputSwimlanes = outputSwimlanesFromPreviousItem.map((i) => ({ ...i }));
    const outputSwimlanes: SwimlaneNode[] = [];

    let firstParentAdded = false;

    if (node.parentIds.length > 0) {
      for (const swimlane of inputSwimlanes) {
        if (swimlane.id === node.id) {
          if (!firstParentAdded) {
            outputSwimlanes.push({
              id: node.parentIds[0],
              color: swimlane.color,
            });
            firstParentAdded = true;
          }
          continue;
        }
        outputSwimlanes.push({ ...swimlane });
      }
    } else {
      for (const swimlane of inputSwimlanes) {
        if (swimlane.id !== node.id) {
          outputSwimlanes.push({ ...swimlane });
        }
      }
    }

    for (let i = firstParentAdded ? 1 : 0; i < node.parentIds.length; i++) {
      colorIndex = (colorIndex + 1) % LANE_COLORS.length;
      outputSwimlanes.push({
        id: node.parentIds[i],
        color: LANE_COLORS[colorIndex],
      });
    }

    viewModels.push({ node, inputSwimlanes, outputSwimlanes });
  }

  return viewModels;
}

export function GraphRow({ viewModel }: { viewModel: CommitViewModel }) {
  const { node, inputSwimlanes, outputSwimlanes } = viewModel;

  const inputIndex = inputSwimlanes.findIndex((n) => n.id === node.id);
  const circleIndex = inputIndex !== -1 ? inputIndex : inputSwimlanes.length;

  const circleColor =
    circleIndex < outputSwimlanes.length
      ? outputSwimlanes[circleIndex].color
      : circleIndex < inputSwimlanes.length
        ? inputSwimlanes[circleIndex].color
        : LANE_COLORS[0];

  const getX = (idx: number) => idx * SWIMLANE_WIDTH + SWIMLANE_WIDTH / 2;
  const cy = SWIMLANE_HEIGHT / 2;

  const paths: React.ReactNode[] = [];

  let outputSwimlaneIndex = 0;
  for (let index = 0; index < inputSwimlanes.length; index++) {
    const color = inputSwimlanes[index].color;

    if (inputSwimlanes[index].id === node.id) {
      if (index !== circleIndex) {
        const d = `M ${getX(index)} 0 C ${getX(index)} ${cy * 0.6}, ${getX(circleIndex)} ${cy * 0.4}, ${getX(circleIndex)} ${cy}`;
        paths.push(
          <path key={`merge-${index}`} d={d} fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" />,
        );
      } else {
        outputSwimlaneIndex++;
      }
    } else {
      if (
        outputSwimlaneIndex < outputSwimlanes.length &&
        inputSwimlanes[index].id === outputSwimlanes[outputSwimlaneIndex].id
      ) {
        if (index === outputSwimlaneIndex) {
          paths.push(
            <path
              key={`pass-${index}`}
              d={`M ${getX(index)} 0 V ${SWIMLANE_HEIGHT}`}
              fill="none"
              stroke={color}
              strokeWidth="1"
              strokeLinecap="round"
            />,
          );
        } else {
          const d = `M ${getX(index)} 0 C ${getX(index)} ${cy}, ${getX(outputSwimlaneIndex)} ${cy}, ${getX(outputSwimlaneIndex)} ${SWIMLANE_HEIGHT}`;
          paths.push(
            <path key={`shift-${index}`} d={d} fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" />,
          );
        }
        outputSwimlaneIndex++;
      }
    }
  }

  for (let i = 1; i < node.parentIds.length; i++) {
    let parentOutputIndex = -1;
    for (let j = outputSwimlanes.length - 1; j >= 0; j--) {
      if (outputSwimlanes[j].id === node.parentIds[i]) {
        parentOutputIndex = j;
        break;
      }
    }
    if (parentOutputIndex === -1) continue;
    const color = outputSwimlanes[parentOutputIndex].color;
    const d = `M ${getX(circleIndex)} ${cy} C ${getX(circleIndex)} ${cy + (SWIMLANE_HEIGHT - cy) * 0.6}, ${getX(parentOutputIndex)} ${cy + (SWIMLANE_HEIGHT - cy) * 0.4}, ${getX(parentOutputIndex)} ${SWIMLANE_HEIGHT}`;
    paths.push(<path key={`parent-${i}`} d={d} fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" />);
  }

  if (inputIndex !== -1) {
    paths.push(
      <path
        key="to-star"
        d={`M ${getX(circleIndex)} 0 V ${cy}`}
        fill="none"
        stroke={inputSwimlanes[inputIndex].color}
        strokeWidth="1"
        strokeLinecap="round"
      />,
    );
  }

  if (node.parentIds.length > 0) {
    paths.push(
      <path
        key="from-star"
        d={`M ${getX(circleIndex)} ${cy} V ${SWIMLANE_HEIGHT}`}
        fill="none"
        stroke={circleColor}
        strokeWidth="1"
        strokeLinecap="round"
      />,
    );
  }

  const cx = getX(circleIndex);

  if (node.isHead) {
    // HEAD: large hollow ring — visually prominent
    paths.push(<circle key="head-bg" cx={cx} cy={cy} r={CIRCLE_RADIUS + 4} fill="var(--vscode-sideBar-background)" />);
    paths.push(
      <circle
        key="head"
        cx={cx}
        cy={cy}
        r={CIRCLE_RADIUS + 3}
        fill="transparent"
        stroke={circleColor}
        strokeWidth={2}
      />,
    );
  } else if (node.parentIds.length > 1) {
    // Merge commit: medium hollow ring with inner dot
    paths.push(<circle key="node-bg" cx={cx} cy={cy} r={CIRCLE_RADIUS + 1} fill="var(--vscode-sideBar-background)" />);
    paths.push(
      <circle
        key="node-outer"
        cx={cx}
        cy={cy}
        r={CIRCLE_RADIUS + 1}
        fill="transparent"
        stroke={circleColor}
        strokeWidth={CIRCLE_STROKE_WIDTH}
      />,
    );
    paths.push(
      <circle key="node-inner" cx={cx} cy={cy} r={CIRCLE_RADIUS - 2} fill={circleColor} stroke="transparent" />,
    );
  } else {
    // Regular commit: small solid dot
    paths.push(
      <circle key="node-bg" cx={cx} cy={cy} r={CIRCLE_RADIUS + 1.0} fill="var(--vscode-sideBar-background)" />,
    );
    paths.push(
      <circle
        key="node"
        cx={cx}
        cy={cy}
        r={CIRCLE_RADIUS + 1.3}
        fill={circleColor}
        stroke={circleColor}
        strokeWidth={CIRCLE_STROKE_WIDTH}
      />,
    );
  }

  const rowLanes = Math.max(inputSwimlanes.length, outputSwimlanes.length, circleIndex + 1, 1);
  const width = rowLanes * SWIMLANE_WIDTH;

  return (
    <div className="graph-container" style={{ width: `${width}px`, flexShrink: 0, height: 22, display: "flex" }}>
      <svg width={width} height="22" style={{ overflow: "visible" }}>
        {paths}
      </svg>
    </div>
  );
}

export function getStatusLetter(file: FileStatus) {
  const s = file.staged ? file.indexStatus : file.worktreeStatus;
  if (s === "?") return "U";
  return s || "M";
}

export function buildTree(fileList: FileStatus[]) {
  const root: { folders: Record<string, any>; files: FileStatus[] } = {
    folders: {},
    files: [],
  };

  fileList.forEach((file) => {
    const parts = file.path.split(/[\\/]/);
    if (parts.length === 1) {
      root.files.push(file);
    } else {
      let current = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const folder = parts[i];
        if (!current.folders[folder]) {
          current.folders[folder] = { folders: {}, files: [], path: parts.slice(0, i + 1).join("/") };
        }
        current = current.folders[folder];
      }
      current.files.push(file);
    }
  });

  return root;
}

export function buildCommitTree(fileList: CommitFile[]) {
  const root: { folders: Record<string, any>; files: CommitFile[] } = {
    folders: {},
    files: [],
  };
  fileList.forEach((file) => {
    const parts = file.path.split(/[\\/]/);
    if (parts.length === 1) {
      root.files.push(file);
    } else {
      let current = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const folder = parts[i];
        if (!current.folders[folder]) {
          current.folders[folder] = { folders: {}, files: [], path: parts.slice(0, i + 1).join("/") };
        }
        current = current.folders[folder];
      }
      current.files.push(file);
    }
  });
  return root;
}
