export function basename(path: string): string {
  const m = /[\\/]([^\\/]+)$/.exec(path);
  return m?.[1] ?? path;
}

export function basenameTree(path: string): string {
  const m = /[\\/]([^\\/]+)[\\/]?$/.exec(path);
  return m?.[1] ?? path;
}

export function dirnameOf(path: string): string {
  const m = /^(.*)[\\/][^\\/]+$/.exec(path);
  return m?.[1] ?? path;
}

/**
 * Returns the VS Code-style compact label for a directory chain. A directory
 * is compacted only while it has exactly one child and that child is another
 * directory. Files in the child directory do not stop compaction. The supplied lookup
 * may return undefined for directories that have not been loaded yet.
 */
export function compactFolderPath<T extends { name: string; path: string; isDir: boolean }>(
  entry: T,
  getChildren: (path: string) => T[] | undefined,
): { label: string; path: string } {
  const result = compactFolderSegments(entry, getChildren);
  return { label: result.label, path: result.path };
}

/** Returns the individual directories represented by a compact folder label. */
export function compactFolderSegments<T extends { name: string; path: string; isDir: boolean }>(
  entry: T,
  getChildren: (path: string) => T[] | undefined,
): { label: string; path: string; segments: Array<{ name: string; path: string }> } {
  let label = entry.name;
  let path = entry.path;
  let compacted = false;
  const segments = [{ name: entry.name, path: entry.path }];
  let children = getChildren(path);
  while (children?.length === 1 && children[0]?.isDir) {
    const child = children[0]!;
    label += `/${child.name}`;
    compacted = true;
    path = child.path;
    segments.push({ name: child.name, path: child.path });
    children = getChildren(path);
  }
  return { label: compacted ? `${label}/` : label, path, segments };
}

/** Compact a loaded tree in-place using the same folder-chain rule. */
export function compactFolderTree<T extends { name: string; path: string; isDir: boolean; children: T[] }>(
  nodes: T[],
): T[] {
  for (const node of nodes) {
    if (!node.isDir) continue;
    compactFolderTree(node.children);
    while (node.children.length === 1 && node.children[0]?.isDir) {
      const child = node.children[0]!;
      node.name += `/${child.name}`;
      node.path = child.path;
      node.children = child.children;
    }
  }
  return nodes;
}
