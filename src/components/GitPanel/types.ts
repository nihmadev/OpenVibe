export interface GitPanelProps {
  cwd: string;
  onOpenFile?: (path: string) => void;
  onClose?: () => void;
}

export interface FileStatus {
  path: string;
  originalPath: string | null;
  status: string;
  staged: boolean;
  indexStatus: string;
  worktreeStatus: string;
}

export interface BranchInfo {
  name: string;
  isHead: boolean;
  isRemote: boolean;
  upstream: string | null;
}

export interface CommitGraphNode {
  id: string;
  shortId: string;
  message: string;
  summary: string;
  author: string;
  authorEmail: string;
  authorAvatar: string | null;
  time: number;
  parentIds: string[];
  branchNames: string[];
  column: number;
  refNames: string[];
  isHead: boolean;
  isMerge: boolean;
  lanes: number[];
}

export interface CommitInfo {
  id: string;
  shortId: string;
  message: string;
  summary: string;
  author: string;
  authorEmail: string;
  authorAvatar: string | null;
  time: number;
  parentIds: string[];
  branchNames: string[];
}

export interface CommitFile {
  path: string;
  status: string;
  oldPath: string | null;
  additions?: number;
  deletions?: number;
}

export interface SwimlaneNode {
  id: string;
  color: string;
}

export interface CommitViewModel {
  node: CommitGraphNode;
  inputSwimlanes: SwimlaneNode[];
  outputSwimlanes: SwimlaneNode[];
}
