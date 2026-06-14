import React, { useState, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import "../../styles/Tooltip.css";

interface Props {
  text: string;
  children: React.ReactElement;
  side?: "auto" | "right" | "left" | "bottom";
}

function applyTipStyle(tip: HTMLElement, x: number, y: number, dir: string): void {
  tip.style.left = x + "px";
  tip.style.top = y + "px";

  const arrow = tip.firstElementChild as HTMLElement | null;

  switch (dir) {
    case "up":
      tip.style.transform = "translate(-50%, -100%)";
      tip.style.paddingBottom = "6px";
      tip.style.paddingTop = "0";
      if (arrow) {
        arrow.className = "tooltip-arrow tooltip-arrow--up";
      }
      break;
    case "down":
      tip.style.transform = "translateX(-50%)";
      tip.style.paddingTop = "6px";
      tip.style.paddingBottom = "0";
      if (arrow) {
        arrow.className = "tooltip-arrow tooltip-arrow--down";
      }
      break;
    case "right":
      tip.style.transform = "translateY(-50%)";
      tip.style.paddingLeft = "6px";
      tip.style.paddingRight = "0";
      if (arrow) {
        arrow.className = "tooltip-arrow tooltip-arrow--right";
      }
      break;
    case "left":
      tip.style.transform = "translate(-100%, -50%)";
      tip.style.paddingRight = "6px";
      tip.style.paddingLeft = "0";
      if (arrow) {
        arrow.className = "tooltip-arrow tooltip-arrow--left";
      }
      break;
  }
}

export function Tooltip({ text, children, side = "auto" }: Props): React.ReactElement {
  const childRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(false);

  const showTip = useCallback(() => {
    setShow(true);
  }, []);

  const hideTip = useCallback(() => {
    setShow(false);
  }, []);

  useLayoutEffect(() => {
    const tip = tipRef.current;
    const el = childRef.current;
    if (!show || !tip || !el) return;

    const pad = 8;
    const elRect = el.getBoundingClientRect();

    let x: number;
    let y: number;
    let dir: string;

    if (side === "right") {
      x = elRect.right + 6;
      y = elRect.top + elRect.height / 2;
      dir = "right";
    } else if (side === "left") {
      x = elRect.left - 6;
      y = elRect.top + elRect.height / 2;
      dir = "left";
    } else if (side === "bottom") {
      x = elRect.left + elRect.width / 2;
      y = elRect.bottom + 6;
      dir = "down";
    } else {
      const preferUp = elRect.top > 150;
      x = elRect.left + elRect.width / 2;
      if (preferUp) {
        y = elRect.top - 6;
        dir = "up";
      } else {
        y = elRect.bottom + 6;
        dir = "down";
      }
    }

    applyTipStyle(tip, x, y, dir);

    const tipRect = tip.getBoundingClientRect();

    if (side === "right" || side === "left") {
      const halfH = tipRect.height / 2;
      if (y - halfH < pad) y = pad + halfH;
      else if (y + halfH > window.innerHeight - pad) y = window.innerHeight - pad - halfH;

      if (dir === "right" && tipRect.right > window.innerWidth - pad) {
        dir = "left";
        x = elRect.left - 6;
        applyTipStyle(tip, x, y, dir);
      } else if (dir === "left" && tipRect.left < pad) {
        dir = "right";
        x = elRect.right + 6;
        applyTipStyle(tip, x, y, dir);
      }
    } else {
      const halfW = tipRect.width / 2;
      if (x - halfW < pad) x = pad + halfW;
      else if (x + halfW > window.innerWidth - pad) x = window.innerWidth - pad - halfW;

      if (dir === "up" && tipRect.top < pad) {
        dir = "down";
        y = elRect.bottom + 6;
        applyTipStyle(tip, x, y, dir);
      } else if (dir === "down" && tipRect.bottom > window.innerHeight - pad) {
        dir = "up";
        y = elRect.top - 6;
        applyTipStyle(tip, x, y, dir);
      }
    }
  }, [show, side]);

  const child = React.cloneElement(children, {
    ref: childRef,
    onMouseEnter: (e: any) => {
      showTip();
      if (children.props.onMouseEnter) children.props.onMouseEnter(e);
    },
    onMouseLeave: (e: any) => {
      hideTip();
      if (children.props.onMouseLeave) children.props.onMouseLeave(e);
    },
  });

  return (
    <>
      {child}
      {show &&
        createPortal(
          <div className="tooltip-root" ref={tipRef}>
            <div className="tooltip-arrow" />
            <div className="tooltip-content">{text}</div>
          </div>,
          document.body,
        )}
    </>
  );
}
