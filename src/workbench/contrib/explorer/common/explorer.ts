export interface ExplorerViewProps {
  cwd: string;
  onOpenFile: (path: string) => void;
  activeFile: string | null;
  revealPath?: string | null;
}
