import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AlertDialog, Badge, Box, Button, Callout, ContextMenu, DropdownMenu, EmptyState, Grid, Heading, Inline, Kbd, Popover, Progress, SearchField, Separator, Skeleton, Spinner, SplitPane, Stack, Table, Tabs, Text, Tooltip, ToastProvider, Toolbar, useToast } from "../index";

describe("catalog components", () => {
  it("renders foundation and feedback primitives with useful semantics", () => {
    render(<Box><Stack><Heading>System</Heading><Text>Ready</Text><Inline><Kbd>Enter</Kbd><Badge>Stable</Badge><Spinner label="Working" /></Inline><Grid><Callout title="Notice">Details</Callout><Progress label="Sync" value={2} max={4} /><Skeleton /><EmptyState title="Nothing here" /></Grid><Separator /></Stack></Box>);
    expect(screen.getByRole("heading", { name: "System" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Working" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Sync" })).toHaveAttribute("aria-valuenow", "2");
  });

  it("opens Popover and Tooltip from keyboard focus", async () => {
    const user = userEvent.setup(); render(<><Popover trigger={<Button>Details</Button>}>Popover body</Popover><Tooltip content="Helpful hint"><Button>Hint</Button></Tooltip></>);
    await user.click(screen.getByRole("button", { name: "Details" })); expect(screen.getByText("Popover body")).toBeVisible(); await user.keyboard("{Escape}");
    await user.tab(); expect(await screen.findByRole("tooltip")).toHaveTextContent("Helpful hint");
  });

  it("supports dropdown and context menu selection", async () => {
    const user = userEvent.setup(); const select = vi.fn();
    render(<><DropdownMenu trigger={<Button>Actions</Button>} items={[{ id: "rename", label: "Rename", onSelect: select }, { id: "delete", label: "Delete", disabled: true }]} /><ContextMenu items={[{ id: "copy", label: "Copy", onSelect: select }]}><div>Target</div></ContextMenu></>);
    await user.click(screen.getByRole("button", { name: "Actions" })); await user.keyboard("{ArrowDown}{Enter}"); expect(select).toHaveBeenCalledTimes(1);
    await user.pointer({ target: screen.getByText("Target"), keys: "[MouseRight]" }); const copy = screen.getByRole("menuitem", { name: "Copy" }); expect(copy).toBeInTheDocument(); await user.click(copy); expect(select).toHaveBeenCalledTimes(2);
  });

  it("uses alertdialog semantics and confirms", async () => {
    const user = userEvent.setup(); const confirm = vi.fn(); render(<AlertDialog trigger={<Button>Remove</Button>} title="Remove item?" description="This cannot be undone." confirmLabel="Remove" onConfirm={confirm}>Confirm the destructive action.</AlertDialog>);
    await user.click(screen.getByRole("button", { name: "Remove" })); expect(screen.getByRole("alertdialog", { name: "Remove item?" })).toBeInTheDocument(); await user.click(screen.getByRole("button", { name: "Remove" })); expect(confirm).toHaveBeenCalledOnce();
  });

  it("navigates Tabs and Toolbar and resizes SplitPane by keyboard", async () => {
    const user = userEvent.setup(); const resize = vi.fn(); render(<><Tabs activationMode="manual" items={[{ value: "a", label: "Alpha", content: "A" }, { value: "b", label: "Beta", content: "B" }]} /><Toolbar label="Editor"><button type="button">Bold</button><button type="button">Italic</button></Toolbar><SplitPane first="One" second="Two" onSizeChange={resize} /></>);
    const alpha = screen.getByRole("tab", { name: "Alpha" }); alpha.focus(); await user.keyboard("{ArrowRight}{Enter}"); expect(screen.getByRole("tabpanel")).toHaveTextContent("B");
    screen.getByRole("button", { name: "Bold" }).focus(); await user.keyboard("{ArrowRight}"); expect(screen.getByRole("button", { name: "Italic" })).toHaveFocus();
    screen.getByRole("separator").focus(); await user.keyboard("{ArrowRight}"); expect(resize).toHaveBeenCalledWith(51);
  });

  it("renders tables, SearchField and toast announcements", async () => {
    const user = userEvent.setup();
    function Publisher(): React.ReactElement { const toast = useToast(); return <Button onClick={() => toast.publish({ title: "Saved" })}>Publish</Button>; }
    render(<ToastProvider><SearchField label="Filter" defaultValue="abc" onClear={() => undefined} /><Table caption="Files" rows={[{ id: 1, name: "README" }]} rowKey={(row) => row.id} columns={[{ id: "name", header: "Name", cell: (row) => row.name }]} /><Publisher /></ToastProvider>);
    expect(screen.getByRole("searchbox", { name: "Filter" })).toBeVisible(); expect(screen.getByRole("table", { name: "Files" })).toBeInTheDocument(); await user.click(screen.getByRole("button", { name: "Publish" })); expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });
});
