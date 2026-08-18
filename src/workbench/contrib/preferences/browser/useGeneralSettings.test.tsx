import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const persisted = vi.hoisted(
  () =>
    new Map<string, string>([
      ["settings:radius", "0"],
      ["settings:blur", "strong"],
      ["settings:borderStyle", "borderless"],
      ["settings:tabStyle", "pills"],
    ]),
);

vi.mock("@/platform/storage/common/keyValueStore", () => ({
  appState: {
    get: vi.fn(async (key: string) => persisted.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      persisted.set(key, value);
    }),
  },
}));

vi.mock("@/platform/theme/fontService", () => ({ applyFont: vi.fn(async () => undefined) }));
vi.mock("@/platform/configuration/browser/zoomConfiguration", () => ({
  setZoomDefault: vi.fn(),
  setZoomStep: vi.fn(),
}));

import { applyThemeVars, type ThemeVars } from "@/platform/theme/themeRegistry";
import { DEFAULT_GENERAL_SETTINGS } from "../common/preferences";
import { applyAppearance, GeneralSettingsProvider } from "./useGeneralSettings";

function resetAppearance(): void {
  const root = document.documentElement;
  for (const token of [
    "--radius",
    "--radius-xs",
    "--radius-sm",
    "--radius-md",
    "--radius-lg",
    "--radius-xl",
    "--radius-2xl",
    "--blur-amount",
    "--line",
    "--line-strong",
    "--theme-line",
    "--theme-line-strong",
    "--surface-border",
    "--surface-border-soft",
    "--workspace-panel-border",
    "--workspace-panel-border-heavy",
    "--workspace-panel-border-light",
  ]) {
    root.style.removeProperty(token);
  }
  root.classList.remove("theme-borderless", "theme-tab-pills");
}

afterEach(resetAppearance);

describe("global appearance settings", () => {
  it("preserves a zero radius across the entire radius scale", () => {
    applyAppearance({ ...DEFAULT_GENERAL_SETTINGS, radius: "0" });

    for (const token of [
      "--radius",
      "--radius-xs",
      "--radius-sm",
      "--radius-md",
      "--radius-lg",
      "--radius-xl",
      "--radius-2xl",
    ]) {
      expect(document.documentElement.style.getPropertyValue(token)).toBe("0px");
    }
  });

  it("loads saved appearance while the preferences dialog is not mounted", async () => {
    render(
      <GeneralSettingsProvider>
        <div>application</div>
      </GeneralSettingsProvider>,
    );

    await waitFor(() => {
      const root = document.documentElement;
      expect(root.style.getPropertyValue("--radius")).toBe("0px");
      expect(root.style.getPropertyValue("--blur-amount")).toBe("20px");
      expect(root).toHaveClass("theme-borderless", "theme-tab-pills");
    });
  });

  it("keeps borderless mode active when a theme is applied and restores theme borders", () => {
    applyAppearance({ ...DEFAULT_GENERAL_SETTINGS, borderStyle: "borderless" });
    applyThemeVars({ "--line": "#123456", "--line-strong": "#abcdef" } as ThemeVars);

    const root = document.documentElement;
    expect(root.style.getPropertyValue("--line")).toBe("transparent");
    expect(root.style.getPropertyValue("--line-strong")).toBe("transparent");

    applyAppearance({ ...DEFAULT_GENERAL_SETTINGS, borderStyle: "bordered" });
    expect(root.style.getPropertyValue("--line")).toBe("#123456");
    expect(root.style.getPropertyValue("--line-strong")).toBe("#abcdef");
  });
});
