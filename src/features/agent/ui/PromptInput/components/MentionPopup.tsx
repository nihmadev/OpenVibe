import { interactiveItemClassName, interactiveListClassName } from "@zazaru/ui";
import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import type { FileMatch } from "@/features/files/model/fs";
import { useI18n } from "@/shared/i18n/useI18n";
import { FileIcon, FolderIcon } from "@/shared/icons";
import type { MentionState } from "../types";

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
  }, [mention.active]);

  if (!mention.active) return null;

  return (
    <div
      ref={popupRef}
      style={positionStyle}
      className={interactiveListClassName("popup popup--mentions")}
      role="listbox"
    >
      {mention.loading && mention.matches.length === 0 ? <div className="popup__empty">{t("searching")}</div> : null}
      {!mention.loading && mention.matches.length === 0 ? <div className="popup__empty">{t("noMatches")}</div> : null}
      {mention.matches.map((m, i) => (
        <div
          key={m.path}
          className={interactiveItemClassName(
            i === mention.selected,
            `popup__item popup__item--mention${i === mention.selected ? " popup__item--active" : ""}`,
          )}
          role="option"
          aria-selected={i === mention.selected}
          onMouseEnter={() => onHover(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(m);
          }}
        >
          <span className="popup__mention-icon" aria-hidden="true">
            {m.isDir ? <FolderIcon open={false} name={m.name} /> : <FileIcon name={m.name} />}
          </span>
          <span className="popup__mention-path" title={m.rel}>
            {m.rel}
          </span>
        </div>
      ))}
    </div>
  );
}
