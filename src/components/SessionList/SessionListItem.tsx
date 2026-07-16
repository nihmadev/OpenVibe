import React from "react";
import type { ChatSummary } from "../../types.js";
import { CheckIcon, TrashIcon } from "../Icons/icons.js";
import { Tooltip } from "../Tooltip/Tooltip.js";
import { useI18n } from "../../hooks/useI18n.js";

interface SessionListItemProps {
  chat: ChatSummary;
  active: boolean;
  selected: boolean;
  onPick: (isMultiselect: boolean) => void;
  onDelete: () => void;
}

export function SessionListItem({
  chat,
  active,
  selected,
  onPick,
  onDelete,
}: SessionListItemProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div
      className={
        "session-list__row" +
        (active ? " session-list__row--active" : "") +
        (selected ? " session-list__row--selected" : "")
      }
      onClick={(e) => {
        onPick(e.ctrlKey || e.metaKey);
      }}
    >
      <div className="session-list__rowtitle-pill">
        {selected && (
          <div className="session-list__checkbox session-list__checkbox--checked">
            <CheckIcon />
          </div>
        )}
        <span className="session-list__rowtitle">{chat.title || t("untitled")}</span>

        <span className="session-list__pill-sep" />

        <Tooltip text={t("deleteSession")} side="right">
          <button
            className="session-list__delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <TrashIcon />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
