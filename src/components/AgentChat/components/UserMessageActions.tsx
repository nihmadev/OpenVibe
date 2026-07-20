import React, { useState } from "react";
import { useI18n } from "../../../hooks/useI18n.js";
import { Tooltip } from "../../Tooltip/Tooltip.js";
import type { HistoryItem } from "../types.js";
import { writeClipboard } from "../../../utils/clipboard.js";

export function UserMessageActions({
  item,
  onRevert,
}: {
  item: HistoryItem;
  onRevert?: (id: string) => void;
}): React.ReactElement {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const ok = await writeClipboard(item.text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="msg--user-actions">
      <Tooltip text={t("revertToMessage")}>
        <button className="msg__action-btn" onClick={() => onRevert?.(item.id)}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 10 4 15 9 20"></polyline>
            <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
          </svg>
        </button>
      </Tooltip>
      <Tooltip text={t("copy")}>
        <button className="msg__action-btn" onClick={onCopy}>
          {copied ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--green)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          )}
        </button>
      </Tooltip>
    </div>
  );
}
