import type React from "react";

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
  "aria-hidden"?: boolean | "true" | "false";
}

/** Generic icon component type used to store icons in maps or pass them as props. */
export type IconComponent = React.FC<IconProps>;

export function svgAttrs({
  size = 24,
  strokeWidth = 2,
  className,
  style,
  ...rest
}: IconProps): React.SVGAttributes<SVGSVGElement> & { width: number | string; height: number | string } {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    style,
    ...rest,
  };
}
