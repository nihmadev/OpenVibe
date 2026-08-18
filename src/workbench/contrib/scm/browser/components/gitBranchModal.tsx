import { Button, IconButton, Input, interactiveItemClassName, interactiveListClassName } from "@zazaru/ui";
import { useI18n } from "@/platform/localization/localizationService";
import type { BranchInfo } from "../../../../services/scm/common/scm";

export interface GitBranchModalProps {
  branches: BranchInfo[];
  newBranchName: string;
  onNewBranchNameChange: (name: string) => void;
  onCreateBranch: () => void;
  onCheckoutBranch: (branchName: string) => void;
  onClose: () => void;
}

export function GitBranchModal({
  branches,
  newBranchName,
  onNewBranchNameChange,
  onCreateBranch,
  onCheckoutBranch,
  onClose,
}: GitBranchModalProps) {
  const { t } = useI18n();
  return (
    <div className="scm-modal-overlay" onClick={onClose}>
      <div className="scm-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="scm-section-header scm-branch-modal-header">
          <span>{t("checkoutCreateBranch")}</span>
          <IconButton scale="compact" onClick={onClose} aria-label={t("close")}>
            <i className="codicon codicon-remove"></i>
          </IconButton>
        </div>
        <div className="scm-editor-container scm-branch-modal-body">
          {/* Create branch input */}
          <div className="scm-branch-create">
            <Input
              type="text"
              placeholder={t("newBranchName")}
              value={newBranchName}
              onChange={(e) => onNewBranchNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreateBranch();
              }}
            />
            <Button variant="outline" onClick={onCreateBranch} disabled={!newBranchName.trim()}>
              {t("createBranchBtn")}
            </Button>
          </div>

          {/* Branch List */}
          <div className={interactiveListClassName("scm-list scm-branch-list")}>
            {branches.map((b) => (
              <div
                key={b.name}
                className={interactiveItemClassName(
                  b.isHead,
                  `scm-list-row scm-branch-row ${b.isHead ? "selected" : ""}`,
                )}
                onClick={() => onCheckoutBranch(b.name)}
              >
                <div className="scm-branch-row-content">
                  <span className="icon">
                    <i className="codicon codicon-git-branch"></i>
                  </span>
                  <span className="scm-branch-name">{b.name}</span>
                  {b.isHead && <span className="scm-branch-current">{t("currentBranch")}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
