import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserMessageContent } from "./userMessageContent";

describe("UserMessageContent", () => {
  it("uses the shared inline mention for a root folder from metadata", () => {
    const { container } = render(
      <UserMessageContent text="Inspect @src next" mentions={[{ display: "src", path: "/repo/src", isDir: true }]} />,
    );

    const mention = container.querySelector(".inline-file-mention");
    expect(mention?.textContent).toBe("src");
    expect(mention?.querySelector("img")?.getAttribute("src")).toContain("folder-src.svg");
    expect(container.querySelector(".user-msg-pill")).toBeNull();
  });
});
