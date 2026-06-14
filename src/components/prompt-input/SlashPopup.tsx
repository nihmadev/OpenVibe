import React from "react";
import type { SlashCommand } from "./types.js";

interface SlashPopupProps {
  visible: boolean;
  matches: SlashCommand[];
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onHover: (index: number) => void;
}

export function SlashPopup({ visible, matches, selectedIndex, onSelect, onHover }: SlashPopupProps) {
  if (!visible || matches.length === 0) return null;

  return (
    <div className="popup" role="listbox">
      {matches.map((c, i) => (
        <div
          key={c.name}
          className={"popup__item" + (i === selectedIndex ? " popup__item--active" : "")}
          role="option"
          aria-selected={i === selectedIndex}
          onMouseEnter={() => onHover(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(c);
          }}
        >
          <span className="popup__name">{c.name}</span>
          <span className="popup__desc">{c.description}</span>
        </div>
      ))}
    </div>
  );
}
