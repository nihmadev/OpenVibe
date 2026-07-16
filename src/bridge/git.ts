import { invoke } from "@tauri-apps/api/core";
import { wrap } from "./helpers.js";

export const gitBridge = {
  git: {
    repoInfo: (cwd: string) =>
      wrap(
        () => invoke("git_repo_info", { path: cwd }),
        (r) => ({ data: r }),
      ),
    status: (cwd: string) =>
      wrap(
        () => invoke("git_status", { path: cwd }),
        (r) => ({ data: r }),
      ),
    stageFile: (cwd: string, filePath: string) => wrap(() => invoke("git_stage_file", { path: cwd, filePath })),
    stageAll: (cwd: string) => wrap(() => invoke("git_stage_all", { path: cwd })),
    unstageFile: (cwd: string, filePath: string) => wrap(() => invoke("git_unstage_file", { path: cwd, filePath })),
    revertFile: (cwd: string, filePath: string) => wrap(() => invoke("git_revert_file", { path: cwd, filePath })),
    commit: (cwd: string, message: string) => wrap(() => invoke("git_commit", { path: cwd, message })),
    branches: (cwd: string) =>
      wrap(
        () => invoke("git_branches", { path: cwd }),
        (r) => ({ data: r }),
      ),
    commits: (cwd: string, maxCount: number) =>
      wrap(
        () => invoke("git_commits", { path: cwd, maxCount }),
        (r) => ({ data: r }),
      ),
    graph: (cwd: string, maxCount: number) =>
      wrap(
        () => invoke("git_graph", { path: cwd, maxCount }),
        (r) => ({ data: r }),
      ),
    publishBranch: (cwd: string, branch: string) => wrap(() => invoke("git_publish_branch", { path: cwd, branch })),
    currentBranch: (cwd: string) =>
      wrap(
        () => invoke("git_current_branch", { path: cwd }),
        (r) => ({ data: r }),
      ),
    commitDetails: (cwd: string, oid: string) =>
      wrap(
        () => invoke("git_commit_details", { path: cwd, oid }),
        (r) => ({ data: r }),
      ),
    commitFiles: (cwd: string, oid: string) =>
      wrap(
        () => invoke("git_commit_files", { path: cwd, oid }),
        (r) => ({ data: r }),
      ),
    checkoutBranch: (cwd: string, name: string) => wrap(() => invoke("git_checkout_branch", { path: cwd, name })),
    createBranch: (cwd: string, name: string) => wrap(() => invoke("git_create_branch", { path: cwd, name })),
  },
};
