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

// Lane colors palette matching VS Code Git Graph - friendly pastel colors
export const LANE_COLORS = [
  "#519bc8", // Soft Blue
  "#c87d46", // Soft Orange
  "#6fb96f", // Soft Green
  "#c06060", // Soft Red
  "#9b6fbd", // Soft Purple
  "#4db2b2", // Soft Cyan
  "#c2b04f", // Soft Yellow
  "#8e9ca8", // Soft Slate
];

export const SWIMLANE_WIDTH = 14;
export const SWIMLANE_HEIGHT = 22;
export const CIRCLE_RADIUS = 3.5;
export const CIRCLE_STROKE_WIDTH = 2;
export const GRAPH_LEFT_PADDING = 8;

export function computeSwimlanes(nodes: CommitGraphNode[]): CommitViewModel[] {
  let colorIndex = -1;
  const viewModels: CommitViewModel[] = [];

  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    const outputSwimlanesFromPreviousItem = viewModels.at(-1)?.outputSwimlanes ?? [];
    const inputSwimlanes = outputSwimlanesFromPreviousItem.map((i) => ({ ...i }));

    const outputBuffer: (SwimlaneNode | null)[] = new Array(inputSwimlanes.length).fill(null);

    let nodeFound = false;
    let mainColor = LANE_COLORS[0];
    const extraParents: SwimlaneNode[] = [];

    for (let i = 0; i < inputSwimlanes.length; i++) {
      const lane = inputSwimlanes[i];
      if (lane.id === node.id) {
        if (!nodeFound) {
          nodeFound = true;
          mainColor = lane.color;
          if (node.parentIds.length > 0) {
            outputBuffer[i] = { id: node.parentIds[0], color: mainColor };
            for (let j = 1; j < node.parentIds.length; j++) {
              colorIndex = (colorIndex + 1) % LANE_COLORS.length;
              extraParents.push({ id: node.parentIds[j], color: LANE_COLORS[colorIndex] });
            }
          } else {
            outputBuffer[i] = null;
          }
        } else {
          outputBuffer[i] = null;
        }
      } else {
        outputBuffer[i] = lane;
      }
    }

    if (!nodeFound) {
      if (node.parentIds.length > 0) {
        colorIndex = (colorIndex + 1) % LANE_COLORS.length;
        mainColor = LANE_COLORS[colorIndex];
        extraParents.push({ id: node.parentIds[0], color: mainColor });
        for (let j = 1; j < node.parentIds.length; j++) {
          colorIndex = (colorIndex + 1) % LANE_COLORS.length;
          extraParents.push({ id: node.parentIds[j], color: LANE_COLORS[colorIndex] });
        }
      }
    }

    for (let i = 0; i < outputBuffer.length; i++) {
      if (outputBuffer[i] === null && extraParents.length > 0) {
        outputBuffer[i] = extraParents.shift()!;
      }
    }

    const outputSwimlanes: SwimlaneNode[] = [];
    for (const lane of outputBuffer) {
      if (lane !== null) {
        outputSwimlanes.push(lane);
      }
    }

    for (const lane of extraParents) {
      outputSwimlanes.push(lane);
    }

    viewModels.push({ node, inputSwimlanes, outputSwimlanes });
  }

  return viewModels;
}

function getShiftPath(x1: number, y1: number, x2: number, y2: number, shiftY: number): string {
  if (x1 === x2) return `M ${x1} ${y1} V ${y2}`;

  const dirX = x2 > x1 ? 1 : -1;
  const dirY1 = shiftY >= y1 ? 1 : -1;
  const dirY2 = y2 >= shiftY ? 1 : -1;

  const absDeltaX = Math.abs(x2 - x1);
  const radius = Math.min(6, absDeltaX / 2, Math.abs(shiftY - y1), Math.abs(y2 - shiftY));

  const yStartArc1 = shiftY - radius * dirY1;
  const xEndArc1 = x1 + radius * dirX;

  const xStartArc2 = x2 - radius * dirX;
  const yEndArc2 = shiftY + radius * dirY2;

  return (
    `M ${x1} ${y1} ` +
    `V ${yStartArc1} ` +
    `Q ${x1} ${shiftY}, ${xEndArc1} ${shiftY} ` +
    `H ${xStartArc2} ` +
    `Q ${x2} ${shiftY}, ${x2} ${yEndArc2} ` +
    `V ${y2}`
  );
}

export function GraphRow({ viewModel }: { viewModel: CommitViewModel }) {
  const { node, inputSwimlanes, outputSwimlanes } = viewModel;

  const inputIndex = inputSwimlanes.findIndex((n) => n.id === node.id);
  const circleIndex = inputIndex !== -1 ? inputIndex : inputSwimlanes.length;

  const getX = (idx: number) => GRAPH_LEFT_PADDING + idx * SWIMLANE_WIDTH + SWIMLANE_WIDTH / 2;
  const cy = SWIMLANE_HEIGHT / 2;
  const h = SWIMLANE_HEIGHT;

  const paths: React.ReactNode[] = [];

  const passThroughMap = new Map<number, number>();
  const parentOutputMap = new Map<number, number>();

  let nf = false;
  let pIdx = 0;
  const extraParents: number[] = [];

  const buffer: (string | null)[] = new Array(inputSwimlanes.length).fill(null);

  for (let i = 0; i < inputSwimlanes.length; i++) {
    if (inputSwimlanes[i].id === node.id) {
      if (!nf) {
        nf = true;
        if (node.parentIds.length > 0) {
          buffer[i] = `p0`;
          for (pIdx = 1; pIdx < node.parentIds.length; pIdx++) {
            extraParents.push(pIdx);
          }
        }
      }
    } else {
      buffer[i] = `in${i}`;
    }
  }

  if (!nf) {
    for (let p = 0; p < node.parentIds.length; p++) {
      extraParents.push(p);
    }
  }

  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === null && extraParents.length > 0) {
      buffer[i] = `p${extraParents.shift()}`;
    }
  }

  const finalLayout: string[] = [];
  for (const val of buffer) {
    if (val !== null) finalLayout.push(val);
  }
  for (const val of extraParents) {
    finalLayout.push(`p${val}`);
  }

  for (let out = 0; out < finalLayout.length; out++) {
    const val = finalLayout[out];
    if (val.startsWith("p")) {
      parentOutputMap.set(parseInt(val.substring(1)), out);
    } else if (val.startsWith("in")) {
      passThroughMap.set(parseInt(val.substring(2)), out);
    }
  }

  let nodeFoundInGraph = false;

  for (let i = 0; i < inputSwimlanes.length; i++) {
    const color = inputSwimlanes[i].color;
    if (inputSwimlanes[i].id === node.id) {
      if (i === circleIndex) {
        paths.push(<path key={`in-${i}`} d={`M ${getX(i)} 0 V ${cy}`} fill="none" stroke={color} strokeWidth="2" />);
      } else {
        const d = getShiftPath(getX(i), 0, getX(circleIndex), cy, cy * 0.5);
        paths.push(<path key={`in-merge-${i}`} d={d} fill="none" stroke={color} strokeWidth="2" />);
      }
      if (!nodeFoundInGraph) nodeFoundInGraph = true;
    } else {
      const targetOutIdx = passThroughMap.get(i);
      if (targetOutIdx !== undefined) {
        const d = getShiftPath(getX(i), 0, getX(targetOutIdx), h, cy);
        paths.push(<path key={`pass-shift-${i}`} d={d} fill="none" stroke={color} strokeWidth="2" />);
      }
    }
  }

  for (let p = 0; p < node.parentIds.length; p++) {
    const pOutIdx = parentOutputMap.get(p);
    if (pOutIdx !== undefined) {
      const color = outputSwimlanes[pOutIdx].color;
      const d = getShiftPath(getX(circleIndex), cy, getX(pOutIdx), h, cy + cy * 0.5);
      paths.push(<path key={`out-branch-${p}`} d={d} fill="none" stroke={color} strokeWidth="2" />);
    }
  }

  let circleColor = LANE_COLORS[0];
  if (nodeFoundInGraph) {
    circleColor = inputSwimlanes[circleIndex].color;
  } else if (node.parentIds.length > 0) {
    circleColor = outputSwimlanes[parentOutputMap.get(0)!].color;
  }

  const cx = getX(circleIndex);
  const bgFill = "var(--bg)";

  if (node.isHead) {
    paths.push(<circle key="head-bg" cx={cx} cy={cy} r={CIRCLE_RADIUS + 2} fill={bgFill} />);
    paths.push(
      <circle
        key="head"
        cx={cx}
        cy={cy}
        r={CIRCLE_RADIUS + 1}
        fill="transparent"
        stroke={circleColor}
        strokeWidth={2}
      />,
    );
    paths.push(<circle key="head-inner" cx={cx} cy={cy} r={CIRCLE_RADIUS - 1.5} fill={circleColor} />);
  } else if (node.parentIds.length > 1) {
    paths.push(<circle key="node-bg" cx={cx} cy={cy} r={CIRCLE_RADIUS + 1} fill={bgFill} />);
    paths.push(
      <circle
        key="node-outer"
        cx={cx}
        cy={cy}
        r={CIRCLE_RADIUS}
        fill="transparent"
        stroke={circleColor}
        strokeWidth={2}
      />,
    );
    paths.push(<circle key="node-inner" cx={cx} cy={cy} r={CIRCLE_RADIUS - 2} fill={circleColor} />);
  } else {
    paths.push(<circle key="node-bg" cx={cx} cy={cy} r={CIRCLE_RADIUS + 1} fill={bgFill} />);
    paths.push(<circle key="node" cx={cx} cy={cy} r={CIRCLE_RADIUS} fill={circleColor} />);
  }

  const rowLanes = Math.max(inputSwimlanes.length, outputSwimlanes.length, circleIndex + 1, 1);
  const width = GRAPH_LEFT_PADDING + rowLanes * SWIMLANE_WIDTH + 8;

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
