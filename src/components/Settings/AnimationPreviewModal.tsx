import React, { useState, useEffect, useRef, useCallback } from "react";
import type { AnimStyle, AnimKey } from "../../hooks/useAnimations.js";
import { useAnimations } from "../../hooks/useAnimations.js";

// ─── Duration map ────────────────────────────────────────────────────────────
const PREVIEW_DURATION: Record<AnimStyle, number> = {
  fade: 220,
  slide: 260,
  scale: 220,
  "fade-slide": 260,
  none: 80,
};

const ANIM_CLASS: Record<AnimStyle, string> = {
  fade: "apm-preview--fade",
  slide: "apm-preview--slide",
  scale: "apm-preview--scale",
  "fade-slide": "apm-preview--fade-slide",
  none: "apm-preview--none",
};

// ─── Mini ProjectRail (horizontal) ──────────────────────────────────────────
const TILE_COLORS = ["#7c6af7", "#f97316", "#10b981", "#3b82f6"];
const TILE_LABELS = ["A", "B", "C", "D"];

function MiniProjectRail({ highlightIdx }: { highlightIdx: number }) {
  return (
    <div className="apm-rail apm-rail--row">
      {TILE_LABELS.map((label, i) => (
        <div key={i} className={"apm-rail__tile" + (i === highlightIdx ? " apm-rail__tile--active" : "")}>
          <span className="apm-rail__avatar" style={{ background: TILE_COLORS[i] } as React.CSSProperties}>
            {label}
          </span>
        </div>
      ))}
      <div className="apm-rail__add">+</div>
    </div>
  );
}

// ─── Mini ContextMenu ────────────────────────────────────────────────────────
function MiniContextMenu({ cls, visible }: { cls: string; visible: boolean }) {
  return (
    <div className={"apm-ctx " + cls} style={{ opacity: visible ? undefined : 0 }} key={String(visible)}>
      <div className="apm-ctx__item">New File</div>
      <div className="apm-ctx__item">New Folder</div>
      <div className="apm-ctx__sep" />
      <div className="apm-ctx__item apm-ctx__item--danger">Delete</div>
    </div>
  );
}

// ─── Mini Panel / Modal ──────────────────────────────────────────────────────
function MiniPanel({ cls, visible }: { cls: string; visible: boolean }) {
  return (
    <div className={"apm-panel " + cls} style={{ opacity: visible ? undefined : 0 }} key={String(visible)}>
      <div className="apm-panel__header" />
      <div className="apm-panel__body">
        <div className="apm-panel__bar" />
        <div className="apm-panel__bar apm-panel__bar--short" />
        <div className="apm-panel__bar" />
      </div>
    </div>
  );
}

// ─── Mini Buttons ────────────────────────────────────────────────────────────
function MiniButtons({ cls, visible }: { cls: string; visible: boolean }) {
  return (
    <div className="apm-buttons" key={String(visible)}>
      <button className={"apm-btn" + (visible ? " " + cls : "")} style={{ opacity: visible ? 1 : 0.3 }} tabIndex={-1}>
        Send
      </button>
      <button
        className={"apm-btn apm-btn--outline" + (visible ? " " + cls : "")}
        style={{ animationDelay: "0.06s", opacity: visible ? 1 : 0.3 }}
        tabIndex={-1}
      >
        Cancel
      </button>
    </div>
  );
}

// ─── Mini Sidebar slide ──────────────────────────────────────────────────────
// The sidebar bars are pure <span> elements (display:block, fixed height/width)
// so there's no inline text to cause font-size blowup.
function MiniSidebarSlide({ cls, sidebarOpen }: { cls: string; sidebarOpen: boolean }) {
  return (
    <div className="apm-layout">
      <div
        className={"apm-sidebar" + (sidebarOpen ? " apm-sidebar--open " + cls : " apm-sidebar--closed")}
        key={String(sidebarOpen)}
      >
        <span className="apm-sidebar__item" />
        <span className="apm-sidebar__item" />
        <span className="apm-sidebar__item" />
        <span className="apm-sidebar__item" />
      </div>
      <div className="apm-main">
        <span className="apm-panel__bar" />
        <span className="apm-panel__bar apm-panel__bar--short" />
        <span className="apm-panel__bar" />
      </div>
    </div>
  );
}

// ─── Scene selector ──────────────────────────────────────────────────────────
function PreviewContent({
  animKey,
  animStyle,
  playing,
  tick,
}: {
  animKey: AnimKey;
  animStyle: AnimStyle;
  playing: boolean;
  tick: number;
}) {
  const cls = playing ? ANIM_CLASS[animStyle] : "";

  if (animKey === "projectHover") {
    return (
      <div className="apm-scene apm-scene--center">
        <MiniProjectRail highlightIdx={playing ? tick % TILE_LABELS.length : -1} />
      </div>
    );
  }
  if (animKey === "projectSwitch") {
    return (
      <div className="apm-scene apm-scene--full">
        <MiniPanel cls={cls} visible={playing} key={String(playing) + tick} />
      </div>
    );
  }
  if (animKey === "sidebarSlide") {
    return (
      <div className="apm-scene apm-scene--full">
        <MiniSidebarSlide cls={cls} sidebarOpen={playing} />
      </div>
    );
  }
  if (animKey === "contextMenu") {
    return (
      <div className="apm-scene apm-scene--center">
        <MiniContextMenu cls={cls} visible={playing} key={String(playing) + tick} />
      </div>
    );
  }
  if (animKey === "buttons") {
    return (
      <div className="apm-scene apm-scene--center">
        <MiniButtons cls={cls} visible={playing} key={String(playing) + tick} />
      </div>
    );
  }
  // panelAppear
  return (
    <div className="apm-scene apm-scene--center">
      <MiniPanel cls={cls} visible={playing} key={String(playing) + tick} />
    </div>
  );
}

// ─── Inline preview — hover-triggered, embedded in the settings card ─────────
export function InlineAnimPreview({ animKey, animStyle }: { animKey: AnimKey; animStyle: AnimStyle }) {
  const { animMultiplier } = useAnimations();
  const mult = Math.max(parseFloat(animMultiplier) || 1, 0.01);
  const [playing, setPlaying] = useState(false);
  const [tick, setTick] = useState(0);
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const cycleRef = useRef<ReturnType<typeof setInterval>>();

  const play = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPlaying(false);
    timerRef.current = setTimeout(() => {
      setPlaying(true);
      setTick((n) => n + 1);
      const dur = (PREVIEW_DURATION[animStyle] + 150) * mult;
      timerRef.current = setTimeout(() => setPlaying(false), dur);
    }, 20 * mult);
  }, [animStyle, mult]);

  // Start cycle on hover, stop on leave
  useEffect(() => {
    if (hovered) {
      play();
      cycleRef.current = setInterval(() => play(), 1200 * mult);
    } else {
      if (cycleRef.current) clearInterval(cycleRef.current);
      // don't abort in-flight animation — let it finish naturally
    }
    return () => {
      if (cycleRef.current) clearInterval(cycleRef.current);
    };
  }, [hovered, play, mult]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (cycleRef.current) clearInterval(cycleRef.current);
    };
  }, []);

  return (
    <div
      className={"apm-inline-stage" + (hovered ? " apm-inline-stage--active" : "")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <PreviewContent animKey={animKey} animStyle={animStyle} playing={playing} tick={tick} />
    </div>
  );
}
