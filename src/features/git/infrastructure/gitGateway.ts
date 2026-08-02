// Typed Tauri adapter for git commands (owned by the git feature).
import { invoke } from "@tauri-apps/api/core";
import { type Result, wrap } from "@/infrastructure/tauri/helpers";
import type { BranchInfo, CommitFile, CommitGraphNode, CommitInfo, FileStatus } from "../model/git";

export interface RepoInfo {
  isRepo: boolean;
  root: string | null;
}

const data = <T>(r: T) => ({ data: r });

export const gitGateway = {
  repoInfo: (cwd: string): Promise<Result<{ data: RepoInfo }>> =>
    wrap(() => invoke<RepoInfo>("git_repo_info", { path: cwd }), data),
  status: (cwd: string): Promise<Result<{ data: FileStatus[] }>> =>
    wrap(() => invoke<FileStatus[]>("git_status", { path: cwd }), data),
  stageFile: (cwd: string, filePath: string): Promise<Result<object>> =>
    wrap(
      () => invoke("git_stage_file", { path: cwd, filePath }),
      () => ({}),
    ),
  stageAll: (cwd: string): Promise<Result<object>> =>
    wrap(
      () => invoke("git_stage_all", { path: cwd }),
      () => ({}),
    ),
  unstageFile: (cwd: string, filePath: string): Promise<Result<object>> =>
    wrap(
      () => invoke("git_unstage_file", { path: cwd, filePath }),
      () => ({}),
    ),
  revertFile: (cwd: string, filePath: string): Promise<Result<object>> =>
    wrap(
      () => invoke("git_revert_file", { path: cwd, filePath }),
      () => ({}),
    ),
  commit: (cwd: string, message: string): Promise<Result<object>> =>
    wrap(
      () => invoke("git_commit", { path: cwd, message }),
      () => ({}),
    ),
  branches: (cwd: string): Promise<Result<{ data: BranchInfo[] }>> =>
    wrap(() => invoke<BranchInfo[]>("git_branches", { path: cwd }), data),
  commits: (cwd: string, maxCount: number): Promise<Result<{ data: CommitInfo[] }>> =>
    wrap(() => invoke<CommitInfo[]>("git_commits", { path: cwd, maxCount }), data),
  graph: (cwd: string, maxCount: number): Promise<Result<{ data: CommitGraphNode[] }>> =>
    wrap(() => invoke<CommitGraphNode[]>("git_graph", { path: cwd, maxCount }), data),
  publishBranch: (cwd: string, branch: string): Promise<Result<object>> =>
    wrap(
      () => invoke("git_publish_branch", { path: cwd, branch }),
      () => ({}),
    ),
  currentBranch: (cwd: string): Promise<Result<{ data: string | null }>> =>
    wrap(() => invoke<string | null>("git_current_branch", { path: cwd }), data),
  commitDetails: (cwd: string, oid: string): Promise<Result<{ data: CommitInfo }>> =>
    wrap(() => invoke<CommitInfo>("git_commit_details", { path: cwd, oid }), data),
  commitFiles: (cwd: string, oid: string): Promise<Result<{ data: CommitFile[] }>> =>
    wrap(() => invoke<CommitFile[]>("git_commit_files", { path: cwd, oid }), data),
  checkoutBranch: (cwd: string, name: string): Promise<Result<object>> =>
    wrap(
      () => invoke("git_checkout_branch", { path: cwd, name }),
      () => ({}),
    ),
  createBranch: (cwd: string, name: string): Promise<Result<object>> =>
    wrap(
      () => invoke("git_create_branch", { path: cwd, name }),
      () => ({}),
    ),
  fileContent: (cwd: string, filePath: string, refName: string): Promise<Result<{ data: string }>> =>
    wrap(() => invoke<string>("git_file_content", { path: cwd, filePath, refName }), data),
  generateCommitMessage: (cwd: string): Promise<Result<{ data: string }>> =>
    wrap(() => invoke<string>("generate_commit_message", { path: cwd }), data),
};
