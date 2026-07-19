const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

const paint = (code: string, value: string): string =>
  useColor ? `\x1b[${code}m${value}\x1b[0m` : value;

export const ui = {
  brand: (value: string) => paint("38;5;109", value),
  heading: (value: string) => paint("1;38;5;252", value),
  muted: (value: string) => paint("38;5;245", value),
  dim: (value: string) => paint("2", value),
  success: (value: string) => paint("38;5;114", value),
  warning: (value: string) => paint("38;5;179", value),
  danger: (value: string) => paint("38;5;167", value),
  accent: (value: string) => paint("38;5;152", value),
  bullet: useColor ? "◆" : "-",
  arrow: useColor ? "›" : ">",
  check: useColor ? "✓" : "OK",
  cross: useColor ? "✕" : "!",
  rule: (width = 52) => ui.muted("─".repeat(width)),
};

export function status(kind: "info" | "success" | "warning" | "error", message: string): string {
  const icon = kind === "success" ? ui.success(ui.check) : kind === "error" ? ui.danger(ui.cross) : kind === "warning" ? ui.warning("!") : ui.accent(ui.arrow);
  return `${icon} ${message}`;
}
