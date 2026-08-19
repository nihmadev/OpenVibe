import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { browserService } from "../tauri/browserService";
import { emitBrowserEvent } from "./browserEventService";
import { BrowserPane, mapClientPointToViewport } from "./browserPane";

vi.mock("../tauri/browserService", () => ({
  browserService: {
    start: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    snapshot: vi.fn().mockResolvedValue(undefined),
    resize: vi.fn().mockResolvedValue(undefined),
    setStreamActive: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn().mockResolvedValue(undefined),
    history: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
    tabs: vi.fn().mockResolvedValue(undefined),
    setManualControl: vi.fn().mockResolvedValue(undefined),
    pointer: vi.fn().mockResolvedValue(undefined),
    key: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("BrowserPane", () => {
  it("maps the displayed page to real CSS viewport coordinates", () => {
    expect(
      mapClientPointToViewport(260, 145, { left: 10, top: 20, width: 500, height: 250 }, { width: 1000, height: 500 }),
    ).toEqual({ x: 500, y: 250 });
  });

  it("moves the cursor to backend coordinates, shows click ripple, and hides it during takeover", () => {
    const view = render(<BrowserPane active={false} />);
    act(() => {
      emitBrowserEvent({
        type: "browser:snapshot",
        image: "data:image/png;base64,AA==",
        url: "https://example.com",
        viewport: { width: 1000, height: 500 },
      });
    });
    expect(view.queryByTestId("browser-agent-pointer")).toBeNull();

    act(() => {
      emitBrowserEvent({ type: "browser:pointer-move", x: 250, y: 100, durationMs: 320, target: "Continue" });
    });
    const pointer = view.getByTestId("browser-agent-pointer");
    expect(pointer).toHaveStyle({ left: "25%", top: "20%", transitionDuration: "320ms" });

    act(() => {
      emitBrowserEvent({ type: "browser:pointer-up", x: 250, y: 100 });
    });
    expect(view.getByTestId("click-ripple")).toBeInTheDocument();

    act(() => {
      emitBrowserEvent({ type: "browser:manual-control", manual: true });
    });
    expect(view.queryByTestId("browser-agent-pointer")).toBeNull();
  });

  it("takes manual control before dispatching an ordered click and keyboard input", async () => {
    const calls: string[] = [];
    vi.mocked(browserService.setManualControl).mockImplementationOnce(async (manual) => {
      calls.push(`manual:${manual}`);
    });
    vi.mocked(browserService.pointer).mockImplementation(async (kind) => {
      calls.push(`pointer:${kind}`);
    });
    vi.mocked(browserService.key).mockImplementationOnce(async (key) => {
      calls.push(`key:${key}`);
    });

    const view = render(<BrowserPane active={false} />);
    act(() => {
      emitBrowserEvent({
        type: "browser:snapshot",
        image: "data:image/png;base64,AA==",
        url: "https://www.google.com/",
        viewport: { width: 1000, height: 500 },
      });
    });
    const image = view.getByRole("img");
    fireEvent.mouseDown(image, { clientX: 120, clientY: 80 });
    fireEvent.mouseUp(image, { clientX: 120, clientY: 80 });
    fireEvent.keyDown(image.closest(".browser-pane__stage")!, { key: "a" });

    await waitFor(() => {
      expect(calls).toEqual(["manual:true", "pointer:down", "pointer:up", "key:a"]);
    });
    expect(view.getByRole("button", { name: "Завершить ручной ввод" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not take manual control from a passive hover", async () => {
    const calls: string[] = [];
    vi.mocked(browserService.setManualControl).mockImplementationOnce(async (manual) => {
      calls.push(`manual:${manual}`);
    });
    vi.mocked(browserService.pointer).mockImplementationOnce(async (kind) => {
      calls.push(`pointer:${kind}`);
    });

    const view = render(<BrowserPane active={false} />);
    act(() => {
      emitBrowserEvent({
        type: "browser:snapshot",
        image: "data:image/jpeg;base64,AA==",
        url: "https://example.com/",
        viewport: { width: 1000, height: 500 },
      });
    });
    fireEvent.mouseMove(view.getByRole("img"), { clientX: 120, clientY: 80 });

    await waitFor(() => expect(calls).toEqual([]));
    expect(view.getByRole("button", { name: "Управлять вручную" })).toHaveAttribute("aria-pressed", "false");
  });

  it("streams frames only while the browser panel is visible", async () => {
    vi.mocked(browserService.setStreamActive).mockClear();
    const view = render(<BrowserPane active={false} />);

    await waitFor(() => expect(browserService.setStreamActive).toHaveBeenLastCalledWith(false));
    view.rerender(<BrowserPane active />);
    await waitFor(() => expect(browserService.setStreamActive).toHaveBeenLastCalledWith(true));
  });

  it("coalesces live frames into the latest animation frame", async () => {
    const view = render(<BrowserPane active={false} />);
    act(() => {
      emitBrowserEvent({
        type: "browser:snapshot",
        image: "data:image/jpeg;base64,AA==",
        url: "https://example.com/",
        viewport: { width: 1000, height: 500 },
      });
    });
    const image = view.getByRole("img");
    act(() => {
      emitBrowserEvent({ type: "browser:snapshot", image: "data:image/jpeg;base64,BB==" });
      emitBrowserEvent({ type: "browser:snapshot", image: "data:image/jpeg;base64,CC==" });
    });
    await waitFor(() => expect(image.getAttribute("src")).toBe("data:image/jpeg;base64,CC=="));
  });

  it("keeps an address draft while blank frames arrive and commits the navigation result", async () => {
    let finishNavigation: ((value: unknown) => void) | undefined;
    vi.mocked(browserService.navigate).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishNavigation = resolve;
        }),
    );
    const view = render(<BrowserPane active={false} />);
    const address = view.getByLabelText("Адрес");

    fireEvent.focus(address);
    fireEvent.change(address, { target: { value: "example.com" } });
    act(() => {
      emitBrowserEvent({ type: "browser:snapshot", image: "data:image/jpeg;base64,AA==", url: "about:blank" });
    });
    expect(address).toHaveValue("example.com");

    fireEvent.submit(address.closest("form")!);
    act(() => {
      emitBrowserEvent({ type: "browser:snapshot", image: "data:image/jpeg;base64,AA==", url: "about:blank" });
    });
    expect(address).toHaveValue("example.com");

    await act(async () => finishNavigation?.({ url: "https://example.com/" }));
    await waitFor(() => expect(address).toHaveValue("https://example.com/"));
  });
});
