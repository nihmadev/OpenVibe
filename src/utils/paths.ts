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
