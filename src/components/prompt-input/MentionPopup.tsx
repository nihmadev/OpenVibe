import React from "react";
import type { MentionState } from "./types.js";
import type { FileMatch } from "../../types.js";
import { useI18n } from "../../hooks/useI18n.js";

interface MentionPopupProps {
  mention: MentionState;
  onSelect: (match: FileMatch) => void;
  onHover: (index: number) => void;
}

export function MentionPopup({ mention, onSelect, onHover }: MentionPopupProps) {
  const { t } = useI18n();
  if (!mention.active) return null;

  return (
    <div className="popup popup--mentions" role="listbox">
      {mention.loading && mention.matches.length === 0 ? <div className="popup__empty">{t("searching")}</div> : null}
      {!mention.loading && mention.matches.length === 0 ? <div className="popup__empty">{t("noMatches")}</div> : null}
      {mention.matches.map((m, i) => (
        <div
          key={m.path}
          className={"popup__item popup__item--mention" + (i === mention.selected ? " popup__item--active" : "")}
          role="option"
          aria-selected={i === mention.selected}
          onMouseEnter={() => onHover(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(m);
          }}
        >
          <span className="popup__name">{m.name}</span>
          <span className="popup__desc">{m.rel}</span>
        </div>
      ))}
    </div>
  );
}
