// Filesystem entry and search result contracts (owned by the files feature).

export interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
  size?: number;
}

export interface FileMatch {
  path: string;
  rel: string;
  name: string;
  isDir?: boolean;
}

export interface ContentMatch {
  path: string;
  rel: string;
  name: string;
  line: number;
  column: number;
  content: string;
}

export interface FileGroupEntry {
  path: string;
  rel: string;
  name: string;
  matchCount: number;
}
