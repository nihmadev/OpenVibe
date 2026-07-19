import type { FsEntry } from "../../types.js";

export interface NodeState {
  open: boolean;
  loading: boolean;
  error?: string;
  children?: FsEntry[];
}

export interface CtxState {
  x: number;
  y: number;
  /** Right-clicked entry, or null if right-click on empty space (root). */
  entry: FsEntry | null;
  parent: string;
}

export interface RootProps {
  cwd: string;
  onOpenFile: (path: string) => void;
  activeFile: string | null;
  revealPath?: string | null;
}

export interface NodeProps {
  entry: FsEntry;
  depth: number;
  parent: string;
  states: Map<string, NodeState>;
  setStates: React.Dispatch<React.SetStateAction<Map<string, NodeState>>>;
  onOpenFile: (path: string) => void;
  activeFile: string | null;
  renamingPath: string | null;
  onCommitRename: (oldPath: string, newName: string) => void;
  onCancelRename: () => void;
  onContext: (state: CtxState) => void;
  cutPath: string | null;
  refreshAll: () => Promise<void>;
  creating?: { dir: string; kind: "file" | "dir" } | null;
  onCommitCreate?: (name: string) => Promise<void>;
  onCancelCreate?: () => void;
  onSelectDir?: (path: string) => void;
  isLast?: boolean;
  guides?: boolean[];
}
