import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type React from "react";
import "./tooltip.css";

interface Props {
  text: string;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left" | "auto";
  align?: "start" | "center" | "end";
  delayDuration?: number;
}

export function Tooltip({
  text,
  children,
  side = "auto",
  align = "center",
  delayDuration = 200,
}: Props): React.ReactElement {
  if (!text) return children;

  const actualSide = side === "auto" ? "top" : side;

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={100}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content side={actualSide} align={align} sideOffset={5} className="tooltip-content">
            {text}
            <TooltipPrimitive.Arrow className="tooltip-arrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
