import type React from "react";
import { ArchiveIcon, CheckIcon, PinIcon, TrashIcon } from "@/base/browser/ui/icons/iconRegistry";
import { Tooltip } from "@/base/browser/ui/tooltip/tooltip";
import { useI18n } from "@/platform/localization/localizationService";
import type { ChatSummary } from "../../../../services/chat/common/chat";

interface SessionListItemProps {
  chat: ChatSummary;
  active: boolean;
  selected?: boolean;
  onPick: (isMultiselect: boolean) => void;
  onDelete: () => void;
  onPin?: () => void;
  onArchive?: () => void;
  workspaceLabel?: string;
}

function formatTime(timestamp: number): string {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

export function SessionListItem({
  chat,
  active,
  selected,
  onPick,
  onDelete,
  onPin,
  onArchive,
  workspaceLabel,
}: SessionListItemProps): React.ReactElement {
  const { t } = useI18n();
  const time = chat.updatedAt || chat.createdAt || 0;
  const status = chat.status || "idle";

  return (
    <div
      className={`session-list__row${active ? " session-list__row--active" : ""}${selected ? " session-list__row--selected" : ""}`}
      data-state={active ? "selected" : "idle"}
      onClick={(e) => {
        onPick(e.ctrlKey || e.metaKey);
      }}
    >
      {/* Leading Indicator (Status dot or Checkbox) */}
      <span className="session-list__icon-wrap">
        {selected ? (
          <div className="session-list__checkbox session-list__checkbox--checked">
            <CheckIcon />
          </div>
        ) : (
          <span className="session-list__status-dot-wrap">
            {status === "error" ? (
              <span className="session-list__status-dot session-list__status-dot--error" title="Error" />
            ) : chat.unreadAt ? (
              <span className="session-list__status-dot session-list__status-dot--unread" title="Unread" />
            ) : status === "running" ? (
              <span className="session-list__status-spinner" title="Running" />
            ) : (
              <span className="session-list__status-dot session-list__status-dot--idle" />
            )}
          </span>
        )}
      </span>

      {/* Title & Workspace */}
      <div className="session-list__content">
        <div className="session-list__title-row">
          <span className="session-list__title" title={chat.title || ""}>
            {chat.title || t("untitled" as any) || "Untitled Session"}
          </span>
        </div>
        {workspaceLabel ? (
          <div className="session-list__meta">
            <span className="session-list__workspace">{workspaceLabel}</span>
          </div>
        ) : null}
      </div>

      {/* Right Side: Timestamp by default <-> Actions on Hover */}
      <div className="session-list__right">
        {time > 0 ? <span className="session-list__time">{formatTime(time)}</span> : null}

        {/* Hover Action Buttons */}
        <div className="session-list__actions" onClick={(e) => e.stopPropagation()}>
          {onPin && (
            <Tooltip text={chat.pinned ? t("unpin" as any) || "Unpin" : t("pin" as any) || "Pin"} side="bottom">
              <button
                type="button"
                className={`session-list__action-btn${chat.pinned ? " session-list__action-btn--pinned" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onPin();
                }}
                aria-label="Pin"
              >
                <PinIcon size={13} />
              </button>
            </Tooltip>
          )}

          {onArchive && (
            <Tooltip text={t("archive" as any) || "Archive"} side="bottom">
              <button
                type="button"
                className="session-list__action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive();
                }}
                aria-label="Archive"
              >
                <ArchiveIcon size={13} />
              </button>
            </Tooltip>
          )}

          <Tooltip text={t("deleteSession")} side="bottom">
            <button
              type="button"
              className="session-list__action-btn session-list__action-btn--delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label={t("deleteSession")}
            >
              <TrashIcon />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
