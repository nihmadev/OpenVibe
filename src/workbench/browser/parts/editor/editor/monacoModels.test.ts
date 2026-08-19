import type * as monaco from "monaco-editor";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { preloadTypes } = vi.hoisted(() => ({ preloadTypes: vi.fn() }));

vi.mock("@/workbench/services/languageServer/tauri/typeDefinitionService", () => ({
  typeDefinitionService: { preloadTypes },
}));

vi.mock("@/workbench/services/files/tauri/fileService", () => ({
  fileService: { read: vi.fn() },
}));

import { loadTypeDefinitions, MonacoModelCache, releaseMonacoWorkspace } from "./monacoModels";

function createModel(value: string) {
  let current = value;
  let disposed = false;
  return {
    dispose: vi.fn(() => {
      disposed = true;
    }),
    getValue: () => current,
    isDisposed: () => disposed,
    setValue: (next: string) => {
      current = next;
    },
  } as unknown as monaco.editor.ITextModel;
}

describe("MonacoModelCache", () => {
  it("evicts the least recently used inactive model and disposes it", () => {
    const cache = new MonacoModelCache(2);
    const first = createModel("first");
    const second = createModel("second");
    const third = createModel("third");
    cache.set("/ws/first.ts", { model: first, originalContent: "first", workspace: "/ws" });
    cache.set("/ws/second.ts", { model: second, originalContent: "second", workspace: "/ws" });
    cache.set("/ws/third.ts", { model: third, originalContent: "third", workspace: "/ws" });

    expect(cache.has("/ws/first.ts")).toBe(false);
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(cache.size).toBe(2);
  });

  it("never evicts pinned or dirty models", () => {
    const cache = new MonacoModelCache(1);
    const pinned = createModel("pinned");
    const dirty = createModel("saved");
    const clean = createModel("clean");
    cache.pin("/ws/pinned.ts");
    cache.set("/ws/pinned.ts", { model: pinned, originalContent: "pinned", workspace: "/ws" });
    cache.set("/ws/dirty.ts", { model: dirty, originalContent: "saved", workspace: "/ws" });
    dirty.setValue("unsaved user edit");
    cache.set("/ws/clean.ts", { model: clean, originalContent: "clean", workspace: "/ws" });
    cache.evict();

    expect(cache.has("/ws/pinned.ts")).toBe(true);
    expect(cache.has("/ws/dirty.ts")).toBe(true);
    expect(dirty.dispose).not.toHaveBeenCalled();
    expect(cache.has("/ws/clean.ts")).toBe(true);
  });

  it("clears clean models from the previous workspace but retains dirty ones", () => {
    const cache = new MonacoModelCache(40);
    const clean = createModel("clean");
    const dirty = createModel("before");
    cache.setActiveWorkspace("/old");
    cache.set("/old/clean.ts", { model: clean, originalContent: "clean", workspace: "/old" });
    cache.set("/old/dirty.ts", { model: dirty, originalContent: "before", workspace: "/old" });
    dirty.setValue("after");

    cache.setActiveWorkspace("/new");

    expect(cache.has("/old/clean.ts")).toBe(false);
    expect(clean.dispose).toHaveBeenCalledOnce();
    expect(cache.has("/old/dirty.ts")).toBe(true);
    expect(dirty.dispose).not.toHaveBeenCalled();
  });
});

describe("Monaco extra libraries", () => {
  beforeEach(() => {
    preloadTypes.mockReset();
    preloadTypes.mockImplementation(async (cwd: string) => ({
      ok: true,
      packages: [],
      types: [{ content: `declare const ${cwd.length}: string`, path: `${cwd}/types.d.ts` }],
    }));
  });

  afterEach(() => {
    releaseMonacoWorkspace("/workspace-a");
    releaseMonacoWorkspace("/workspace-b");
  });

  it("disposes addExtraLib registrations when the workspace changes or closes", async () => {
    const disposables: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];
    const fakeMonaco = {
      typescript: {
        ScriptTarget: { ESNext: 99 },
        ModuleKind: { ESNext: 99 },
        JsxEmit: { React: 99 },
        typescriptDefaults: {
          addExtraLib: vi.fn(() => {
            const disposable = { dispose: vi.fn() };
            disposables.push(disposable);
            return disposable;
          }),
          setCompilerOptions: vi.fn(),
        },
      },
    } as unknown as typeof monaco;

    await loadTypeDefinitions(fakeMonaco, "/workspace-a");
    expect(disposables[0]?.dispose).not.toHaveBeenCalled();

    await loadTypeDefinitions(fakeMonaco, "/workspace-b");
    expect(disposables[0]?.dispose).toHaveBeenCalledOnce();

    releaseMonacoWorkspace("/workspace-b");
    expect(disposables[1]?.dispose).toHaveBeenCalledOnce();
  });
});
