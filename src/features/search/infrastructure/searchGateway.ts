// Typed Tauri adapter for code search commands (owned by the search feature).
import { invoke } from "@tauri-apps/api/core";
import type { ContentMatch, FileGroupEntry } from "@/features/files/model/fs";
import { type Result, wrap } from "@/infrastructure/tauri/helpers";

export interface SearchFilesResult {
  files: FileGroupEntry[];
  totalMatches: number;
}

export interface SearchFileMatchesResult {
  total: number;
  matches: ContentMatch[];
}

export interface SearchOptions {
  matchCase: boolean;
  matchWholeWord: boolean;
  useRegex: boolean;
  include?: string;
  exclude?: string;
}

export const searchGateway = {
  /** Search file contents; returns per-file match counts. */
  searchFiles: (
    root: string,
    query: string,
    options: SearchOptions,
    maxFiles?: number,
  ): Promise<Result<SearchFilesResult>> =>
    wrap(
      () =>
        invoke<SearchFilesResult>("fs_search_content_files", {
          root,
          query,
          matchCase: options.matchCase,
          matchWholeWord: options.matchWholeWord,
          useRegex: options.useRegex,
          include: options.include,
          exclude: options.exclude,
          maxFiles,
        }),
      (result) => ({ files: result.files, totalMatches: result.totalMatches }),
    ),

  /** Load individual matches for a single file from the current search. */
  fileMatches: (
    root: string,
    query: string,
    options: SearchOptions,
    filePath: string,
    offset: number,
    limit: number,
  ): Promise<Result<SearchFileMatchesResult>> =>
    wrap(
      () =>
        invoke<SearchFileMatchesResult>("fs_search_content_file_matches", {
          root,
          query,
          matchCase: options.matchCase,
          matchWholeWord: options.matchWholeWord,
          useRegex: options.useRegex,
          include: options.include ?? "",
          exclude: options.exclude ?? "",
          filePath,
          offset,
          limit,
        }),
      (result) => ({ total: result.total, matches: result.matches }),
    ),
};
