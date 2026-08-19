import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, Dialog, Field, FieldError, Input, Label, Description, ListGroup, ListItem, NumberInput, Toggle, TreeView } from "../index";

describe("form controls", () => {
  it("Button defaults to button and exposes loading state", () => { render(<form><Button loading>Save</Button></form>); const button = screen.getByRole("button", { name: /save.*loading/i }); expect(button).toHaveAttribute("type", "button"); expect(button).toBeDisabled(); expect(button).toHaveAttribute("aria-busy", "true"); });
  it("Field connects label, description and error to Input", () => { render(<Field invalid><Label>Email</Label><Description>Work address</Description><Input /><FieldError>Required</FieldError></Field>); const input = screen.getByRole("textbox", { name: "Email" }); expect(input).toHaveAccessibleDescription("Work address Required"); expect(input).toHaveAttribute("aria-invalid", "true"); });
  it("Toggle has native switch geometry and accessible name", async () => { const user = userEvent.setup(); const change = vi.fn(); render(<Toggle aria-label="Autosave" checked={false} onValueChange={change} />); await user.click(screen.getByRole("checkbox", { name: "Autosave" })); expect(change).toHaveBeenCalledWith(true); });
  it("NumberInput keeps invalid and intermediate values and steps from a bound", async () => { const user = userEvent.setup(); const change = vi.fn(); const { rerender } = render(<NumberInput aria-label="Zoom" value="-" min={0} max={5} step={0.5} onChange={change} />); const input = screen.getByRole("spinbutton", { name: "Zoom" }); await user.type(input, "x"); expect(change).toHaveBeenLastCalledWith("-x", expect.anything()); rerender(<NumberInput aria-label="Zoom" value="" min={0} max={5} step={0.5} onChange={change} />); input.focus(); await user.keyboard("{ArrowUp}"); expect(change).toHaveBeenLastCalledWith("0.0"); });
});

describe("disclosure and overlays", () => {
  it("removes collapsed descendants from focus and exposes aria-controls", async () => { const user = userEvent.setup(); render(<ListGroup title="Files" defaultExpanded><ListItem>README</ListItem></ListGroup>); const toggle = screen.getByRole("button", { name: /files/i }); expect(toggle).toHaveAttribute("aria-controls"); await user.click(toggle); expect(screen.queryByRole("button", { name: "README" })).not.toBeInTheDocument(); });
  it("Dialog traps focus, closes with Escape, and restores trigger focus", async () => { const user = userEvent.setup(); render(<Dialog trigger={<button type="button">Open</button>} title="Edit"><Input aria-label="Name" /></Dialog>); const trigger = screen.getByRole("button", { name: "Open" }); await user.click(trigger); expect(screen.getByRole("dialog", { name: "Edit" })).toBeInTheDocument(); await user.keyboard("{Escape}"); expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(trigger).toHaveFocus(); });
});

describe("TreeView", () => {
  it("supports roving focus, expansion and parent navigation", async () => { const user = userEvent.setup(); const select = vi.fn(); render(<TreeView label="Files" nodes={[{ id: "src", label: "src", children: [{ id: "index", label: "index.ts" }] }, { id: "readme", label: "README" }]} onSelect={select} />); const src = screen.getByRole("treeitem", { name: /src/i }); src.focus(); await user.keyboard("{ArrowRight}{ArrowRight}"); expect(screen.getByRole("treeitem", { name: "index.ts" })).toHaveFocus(); await user.keyboard("{ArrowLeft}"); expect(src).toHaveFocus(); await user.keyboard("{End}{Enter}"); expect(select).toHaveBeenCalledWith("readme"); });
});
