import * as React from "react";
import axe from "axe-core";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, Checkbox, Field, FieldError, Input, Label, Description, Progress, RadioGroup, Select, Tabs, TreeView } from "../index";

async function expectNoViolations(container: HTMLElement): Promise<void> { const results = await axe.run(container); expect(results.violations, results.violations.map((item) => `${item.id}: ${item.help}`).join("\n")).toEqual([]); }

describe.each(["light", "dark", "high-contrast"])("accessibility in %s theme", (theme) => {
  it("has no detectable violations in the component composition", async () => {
    const { container } = render(<main data-z-theme={theme}><Field invalid><Label>Name</Label><Description>Public name</Description><Input /><FieldError>Required</FieldError></Field><Checkbox label="Publish" /><RadioGroup legend="Mode" options={[{ value: "a", label: "Automatic" }, { value: "m", label: "Manual" }]} /><Select aria-label="Theme" value="dark" options={[{ value: "dark", label: "Dark" }]} /><Button>Save</Button><Progress label="Upload" value={50} /><Tabs items={[{ value: "one", label: "One", content: "First" }, { value: "two", label: "Two", content: "Second" }]} /><TreeView label="Files" nodes={[{ id: "readme", label: "README" }]} /></main>);
    await expectNoViolations(container);
  });
});
