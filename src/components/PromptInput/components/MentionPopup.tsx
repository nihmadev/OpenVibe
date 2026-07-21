import React, { useState, useRef, useLayoutEffect } from "react";
import type { MentionState } from "../types.js";
import type { FileMatch } from "../../../types.js";
import { useI18n } from "../../../hooks/useI18n.js";
import { FileIcon, FolderIcon } from "../../Icons/index.js";

interface MentionPopupProps {
  mention: MentionState;
  onSelect: (match: FileMatch) => void;
  onHover: (index: number) => void;
}

export function MentionPopup({ mention, onSelect, onHover }: MentionPopupProps) {
  const { t } = useI18n();
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    if (!mention.active) return;
    const el = popupRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const titlebarEl = document.querySelector(".titlebar");
    const titlebarBottom = titlebarEl ? titlebarEl.getBoundingClientRect().bottom : 38;
    const safeTopMargin = titlebarBottom + 12;

    const spaceAbove = parentRect.top - safeTopMargin;
    const spaceBelow = window.innerHeight - parentRect.bottom - 16;

    if (spaceAbove < 140 && spaceBelow > spaceAbove) {
      setPositionStyle({
        bottom: "auto",
        top: "calc(100% + 8px)",
        maxHeight: `${Math.max(80, Math.min(280, spaceBelow))}px`,
      });
    } else {
      setPositionStyle({
        bottom: "calc(100% + 8px)",
        top: "auto",
        maxHeight: `${Math.max(80, Math.min(280, spaceAbove))}px`,
      });
    }
  }, [mention.active, mention.matches.length, mention.loading]);

  if (!mention.active) return null;

  return (
    <div ref={popupRef} style={positionStyle} className="popup popup--mentions" role="listbox">
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
          {m.isDir ? <FolderIcon open={false} name={m.name} /> : <FileIcon name={m.name} />}
          <span className="popup__name">{m.name}</span>
          <span className="popup__desc">{m.rel}</span>
        </div>
      ))}
    </div>
  );
}
