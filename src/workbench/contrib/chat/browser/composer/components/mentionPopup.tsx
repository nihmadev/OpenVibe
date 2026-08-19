import { interactiveItemClassName, interactiveListClassName } from "@zazaru/ui";
import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { FileIcon, FolderIcon } from "@/base/browser/ui/icons/iconRegistry";
import { useI18n } from "@/platform/localization/localizationService";
import type { FileMatch } from "@/workbench/services/files/common/files";
import type { MentionState } from "../../../common/chat";

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

    const updatePosition = () => {
      const parentRect = parent.getBoundingClientRect();
      const titlebarEl = document.querySelector(".titlebar");
      const titlebarBottom = titlebarEl ? titlebarEl.getBoundingClientRect().bottom : 38;
      const safeTopMargin = titlebarBottom + 12;
      const spaceAbove = parentRect.top - safeTopMargin - 8;
      const spaceBelow = window.innerHeight - parentRect.bottom - 16 - 8;

      if (spaceAbove < 140 && spaceBelow > spaceAbove) {
        setPositionStyle({
          bottom: "auto",
          top: "calc(100% + 8px)",
          maxHeight: `${Math.max(80, Math.min(320, spaceBelow))}px`,
        });
      } else {
        setPositionStyle({
          bottom: "calc(100% + 8px)",
          top: "auto",
          maxHeight: `${Math.max(80, Math.min(320, spaceAbove))}px`,
        });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updatePosition);
    observer?.observe(parent);
    return () => {
      window.removeEventListener("resize", updatePosition);
      observer?.disconnect();
    };
  }, [mention.active]);

  if (!mention.active) return null;

  return (
    <div
      ref={popupRef}
      style={positionStyle}
      className={interactiveListClassName("composer-suggestions")}
      role="listbox"
    >
      {mention.loading && mention.matches.length === 0 ? (
        <div className="composer-suggestions__empty">{t("searching")}</div>
      ) : null}
      {!mention.loading && mention.matches.length === 0 ? (
        <div className="composer-suggestions__empty">{t("noMatches")}</div>
      ) : null}
      {mention.matches.map((m, i) => (
        <div
          key={m.path}
          className={interactiveItemClassName(
            i === mention.selected,
            `composer-suggestions__item${i === mention.selected ? " composer-suggestions__item--active" : ""}`,
          )}
          role="option"
          aria-selected={i === mention.selected}
          onMouseEnter={() => onHover(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(m);
          }}
        >
          <span className="composer-suggestions__icon" aria-hidden="true">
            {m.isDir ? <FolderIcon open={false} name={m.name} /> : <FileIcon name={m.name} />}
          </span>
          <span className="composer-suggestions__path" title={m.rel}>
            {m.rel}
          </span>
        </div>
      ))}
    </div>
  );
}
