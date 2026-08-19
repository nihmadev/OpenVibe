export interface ScmViewProps {
  cwd: string;
  onOpenFile?: (path: string) => void;
  onClose?: () => void;
}
