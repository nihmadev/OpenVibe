import React from "react";
import type { BranchInfo } from "../types.js";
import { useI18n } from "../../../hooks/useI18n.js";

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
        <div className="scm-section-header" style={{ padding: "8px 12px" }}>
          <span>{t("checkoutCreateBranch")}</span>
          <div className="action-label" onClick={onClose}>
            <i className="codicon codicon-remove"></i>
          </div>
        </div>
        <div className="scm-editor-container" style={{ padding: "8px 12px" }}>
          {/* Create branch input */}
          <div style={{ display: "flex", gap: "6px", marginBottom: 8 }}>
            <div
              className="sc-input-wrap"
              style={{
                flex: 1,
                backgroundColor: "var(--bg-2)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-md)",
                padding: "0 8px",
              }}
            >
              <input
                type="text"
                className="sc-input"
                placeholder={t("newBranchName")}
                value={newBranchName}
                onChange={(e) => onNewBranchNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCreateBranch();
                }}
                style={{
                  width: "100%",
                  height: "26px",
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  color: "var(--fg)",
                  fontSize: "12px",
                }}
              />
            </div>
            <button
              className="sc-action-btn"
              style={{
                width: "auto",
                padding: "0 10px",
                height: "28px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-2)",
                color: "var(--fg)",
                border: "1px solid var(--line)",
                cursor: "pointer",
              }}
              onClick={onCreateBranch}
              disabled={!newBranchName.trim()}
            >
              {t("createBranchBtn")}
            </button>
          </div>

          {/* Branch List */}
          <div className="monaco-list" style={{ maxHeight: 200, overflowY: "auto" }}>
            {branches.map((b) => (
              <div
                key={b.name}
                className={`monaco-list-row ${b.isHead ? "selected" : ""}`}
                onClick={() => onCheckoutBranch(b.name)}
                style={{ height: 28 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%" }}>
                  <span className="icon" style={{ display: "flex" }}>
                    <i className="codicon codicon-git-branch"></i>
                  </span>
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {b.name}
                  </span>
                  {b.isHead && <span style={{ fontSize: "10px", opacity: 0.7 }}>{t("currentBranch")}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
