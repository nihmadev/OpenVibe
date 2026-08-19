import * as React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Select } from "../Select";

const options = [
  { value: "dark", label: "Dark", group: "Theme" },
  { value: "light", label: "Light", group: "Theme" },
  { value: "system", label: "System", group: "Automatic", disabled: true },
] as const;

describe("Select", () => {
  it("preserves option order and exposes listbox semantics", async () => {
    const user = userEvent.setup();
    render(<Select aria-label="Theme" value="light" options={options} onChange={() => undefined} />);
    await user.click(screen.getByRole("combobox", { name: "Theme" }));
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((item) => item.textContent)).toEqual(["Dark", "Light", "System"]);
    expect(screen.getByRole("option", { name: "System" })).toHaveAttribute("aria-disabled", "true");
  });

  it("supports arrows, Home/End, Enter, Escape and typeahead through Radix", async () => {
    const user = userEvent.setup(); const onChange = vi.fn();
    render(<Select aria-label="Theme" value="dark" options={options} onChange={onChange} />);
    const trigger = screen.getByRole("combobox", { name: "Theme" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("light");
    expect(trigger).toHaveFocus();
    await user.keyboard("{ArrowDown}l");
    expect(screen.getByRole("option", { name: "Light" })).toHaveAttribute("data-highlighted");
    await user.keyboard("{Home}{End}{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("uses a custom portal container", async () => {
    const user = userEvent.setup(); const portal = document.createElement("div"); document.body.append(portal);
    render(<Select aria-label="Theme" value="dark" options={options} portalContainer={portal} />);
    await user.click(screen.getByRole("combobox", { name: "Theme" }));
    expect(within(portal).getByRole("listbox")).toBeInTheDocument();
  });

  it("opens nested choices with pointer and keyboard navigation", async () => {
    const user = userEvent.setup(); const onChange = vi.fn();
    render(<Select aria-label="Model configuration" value="medium" onChange={onChange} options={[
      { value: "model", label: "Model", children: [{ value: "sol", label: "5.6 Sol" }] },
      { value: "effort", label: "Effort", children: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium", description: "Balanced reasoning" },
        { value: "high", label: "High" },
      ] },
    ]} />);
    const trigger = screen.getByRole("button", { name: "Model configuration" });
    await user.click(trigger);
    const effort = screen.getByRole("menuitem", { name: "Effort" });
    effort.focus();
    await user.keyboard("{ArrowRight}");
    const medium = await screen.findByRole("menuitemradio", { name: /Medium/ });
    expect(medium).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{End}{Enter}");
    expect(onChange).toHaveBeenCalledWith("high");
    expect(trigger).toHaveFocus();
  });
});
