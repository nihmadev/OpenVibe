import type { Project } from "@/workbench/services/workspace/common/workspace";

export interface EditWorkspaceDialogProps {
  project: Project;
  onSave: () => void;
  onClose: () => void;
}
