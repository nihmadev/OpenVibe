import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/platform/localization/localizationService";
import type { ChatSummary } from "@/workbench/services/chat/common/chat";
import type { Project } from "@/workbench/services/workspace/common/workspace";
import { SidebarView } from "./sidebarView";

const { listForProject } = vi.hoisted(() => ({
  listForProject: vi.fn<(projectId: string) => Promise<ChatSummary[]>>(),
}));

vi.mock("@/workbench/browser/desktopPreview", () => ({
  browserPreviewChatsByProject: {},
  isBrowserDevPreview: false,
}));

vi.mock("@/workbench/services/chat/tauri/chatService", () => ({
  chatService: { listForProject },
  onChatsUpdated: () => () => {},
}));

vi.mock("@/workbench/services/files/tauri/fileService", () => ({
  fileService: { reveal: vi.fn() },
}));

const projects: Project[] = [
  {
    id: "openvibe",
    path: "/workspace/openvibe",
    name: "OpenVibe",
    color: "#e2a579",
    addedAt: 1,
  },
  {
    id: "browser-runtime",
    path: "/workspace/browser-runtime",
    name: "Browser Runtime",
    color: "#82afe0",
    addedAt: 2,
  },
];

const chatsByProject: Record<string, ChatSummary[]> = {
  openvibe: [
    {
      id: "sidebar-redesign",
      title: "Redesign the session sidebar",
      createdAt: 100,
      updatedAt: 300,
      messageCount: 9,
    },
  ],
  "browser-runtime": [
    {
      id: "browser-lifecycle",
      title: "Simplify browser lifecycle",
      createdAt: 200,
      updatedAt: 400,
      messageCount: 12,
    },
  ],
};

function renderSidebar() {
  listForProject.mockImplementation(async (projectId) => chatsByProject[projectId] ?? []);
  return render(
    <I18nProvider lang="English">
      <SidebarView
        open
        width={275}
        onResize={vi.fn()}
        projects={projects}
        activeProjectId="openvibe"
        activeChatId="sidebar-redesign"
        onPickProject={vi.fn()}
        onAddProject={vi.fn()}
        onRemoveProject={vi.fn()}
        onEditProject={vi.fn()}
        onPickChat={vi.fn()}
        onNewChat={vi.fn()}
        onDeleteChat={vi.fn()}
        onRenameChat={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SidebarView", () => {
  it("keeps only new chat and search in the primary navigation with the same text treatment", async () => {
    renderSidebar();
    await waitFor(() => expect(listForProject).toHaveBeenCalledTimes(2));

    const newChat = screen.getByTestId("new-conversation-button");
    const search = screen.getByTestId("session-search-button");

    expect(newChat.className).toBe(search.className);
    expect(screen.queryByRole("button", { name: "History" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Scheduled" })).not.toBeInTheDocument();
  });

  it("loads project chats and filters them through the global search", async () => {
    renderSidebar();

    await waitFor(() => expect(listForProject).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText("Redesign the session sidebar").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("session-search-button"));
    const dialog = screen.getByRole("dialog", { name: "Search chats" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Search chats" }), {
      target: { value: "browser" },
    });

    expect(await within(dialog).findByText("Simplify browser lifecycle")).toBeInTheDocument();
    expect(within(dialog).queryByText("Redesign the session sidebar")).not.toBeInTheDocument();
  });

  it("collapses recent chats from the chevron beside the section title", async () => {
    renderSidebar();
    await waitFor(() => expect(listForProject).toHaveBeenCalledTimes(2));

    const toggle = screen.getByRole("button", { name: "Recent" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("Redesign the session sidebar")).toHaveLength(2);

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByText("Redesign the session sidebar")).toHaveLength(1);
  });

  it("opens the source-aligned project action menu", async () => {
    renderSidebar();
    await waitFor(() => expect(listForProject).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getAllByRole("button", { name: "Project options" })[0]!);
    const menu = await screen.findByRole("menu");

    expect(within(menu).getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Reveal in file manager" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Remove from list" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "New conversation in project" })).not.toBeInTheDocument();
  });
});
