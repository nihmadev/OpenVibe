import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComposerOptions } from "./composerOptions";

const providerMocks = vi.hoisted(() => {
  let enabled: string[] = [];
  const listeners = new Set<() => void>();

  return {
    setEnabled(next: string[]) {
      enabled = next;
    },
    listProviders: vi.fn(async () => [
      {
        id: "provider-1",
        name: "Test Provider",
        description: "",
        baseUrl: "https://api.test/v1",
        apiKey: "secret",
        model: "old-model",
        addedAt: 1,
      },
    ]),
    listEnabledModels: vi.fn(async () => enabled),
    fetchModels: vi.fn(async () => ({
      ok: true as const,
      models: [{ id: "fresh-model", name: "Fresh Model Name" }],
    })),
    onEnabledModelsChange: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
});

vi.mock("@/workbench/services/aiProviders/tauri/aiProviderService", () => ({
  aiProviderService: providerMocks,
}));

vi.mock("@/workbench/services/aiProviders/browser/providerLogo", () => ({
  ProviderLogo: () => <span data-testid="provider-logo" />,
}));

describe("ComposerOptions", () => {
  it("refreshes enabled models whenever the selector is opened", async () => {
    providerMocks.setEnabled([]);
    const { container, getByText } = render(
      <ComposerOptions
        currentModel="old-model"
        onPickModel={vi.fn()}
        onOpenSettings={vi.fn()}
        showReasoningEffort={false}
        currentEffort={undefined}
        onReasoningEffortChange={vi.fn()}
        effortOptions={[]}
      />,
    );

    await waitFor(() => expect(providerMocks.listEnabledModels).toHaveBeenCalledTimes(1));
    providerMocks.setEnabled(["provider-1::fresh-model"]);

    fireEvent.click(container.querySelector(".composer-options__trigger")!);
    await waitFor(() => expect(providerMocks.listEnabledModels).toHaveBeenCalledTimes(2));
    fireEvent.click(container.querySelector(".composer-options__row")!);

    await waitFor(() => expect(getByText("Fresh Model Name")).toBeInTheDocument());
  });
});
