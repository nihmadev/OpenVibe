import type React from "react";
import { useState } from "react";
import { writeClipboard } from "@/infrastructure/clipboard";
import { useI18n } from "@/shared/i18n/useI18n";
import { CopyCheckIcon } from "@/shared/icons/icons";
import { Tooltip } from "@/shared/ui/Tooltip/Tooltip";
import type { HistoryItem } from "../../../model/history";

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
        <button className="ui-icon-btn ui-icon-btn--md msg__action-btn" onClick={() => onRevert?.(item.id)}>
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
        <button className="ui-icon-btn ui-icon-btn--md msg__action-btn" onClick={onCopy}>
          <CopyCheckIcon copied={copied} />
        </button>
      </Tooltip>
    </div>
  );
}
