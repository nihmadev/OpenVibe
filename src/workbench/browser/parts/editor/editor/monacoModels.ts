import type * as monaco from "monaco-editor";
import { getLanguage } from "@/base/browser/ui/icons/iconResolver";
import { fileService } from "@/workbench/services/files/tauri/fileService";
import { typeDefinitionService } from "@/workbench/services/languageServer/tauri/typeDefinitionService";

export const INACTIVE_MODEL_LIMIT = 40;

export interface CachedModel {
  model: monaco.editor.ITextModel;
  originalContent: string;
  workspace?: string;
  pinCount?: number;
  lastUsed?: number;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function isDirty(entry: CachedModel): boolean {
  return !entry.model.isDisposed() && entry.model.getValue() !== entry.originalContent;
}

export class MonacoModelCache {
  private readonly entries = new Map<string, CachedModel>();
  private readonly pendingPins = new Map<string, number>();
  private clock = 0;
  private activeWorkspace: string | null = null;

  constructor(private readonly inactiveLimit = INACTIVE_MODEL_LIMIT) {}

  get size(): number {
    return this.entries.size;
  }

  get(path: string): CachedModel | undefined {
    const entry = this.entries.get(path);
    if (!entry) return undefined;
    if (entry.model.isDisposed()) {
      this.entries.delete(path);
      return undefined;
    }
    entry.lastUsed = ++this.clock;
    return entry;
  }

  peek(path: string): CachedModel | undefined {
    return this.entries.get(path);
  }

  has(path: string): boolean {
    return this.get(path) !== undefined;
  }

  set(path: string, value: CachedModel): this {
    const previous = this.entries.get(path);
    if (previous && previous.model !== value.model && !previous.model.isDisposed() && !isDirty(previous)) {
      previous.model.dispose();
    }
    const pinCount = Math.max(value.pinCount ?? 0, previous?.pinCount ?? 0, this.pendingPins.get(path) ?? 0);
    this.pendingPins.delete(path);
    this.entries.set(path, {
      ...value,
      workspace: value.workspace ? normalizePath(value.workspace) : previous?.workspace,
      pinCount,
      lastUsed: ++this.clock,
    });
    this.evict();
    return this;
  }

  delete(path: string): boolean {
    return this.entries.delete(path);
  }

  pin(path: string): void {
    const entry = this.entries.get(path);
    if (entry) {
      entry.pinCount = (entry.pinCount ?? 0) + 1;
      entry.lastUsed = ++this.clock;
    } else {
      this.pendingPins.set(path, (this.pendingPins.get(path) ?? 0) + 1);
    }
  }

  unpin(path: string): void {
    const entry = this.entries.get(path);
    if (!entry) {
      const count = this.pendingPins.get(path) ?? 0;
      if (count <= 1) this.pendingPins.delete(path);
      else this.pendingPins.set(path, count - 1);
      return;
    }
    entry.pinCount = Math.max(0, (entry.pinCount ?? 0) - 1);
    entry.lastUsed = ++this.clock;
    if (entry.pinCount === 0 && !isDirty(entry) && entry.workspace && entry.workspace !== this.activeWorkspace) {
      this.disposeEntry(path, entry);
      return;
    }
    this.evict();
  }

  setActiveWorkspace(workspace: string | null): string | null {
    const next = workspace ? normalizePath(workspace) : null;
    const previous = this.activeWorkspace;
    if (previous === next) return previous;
    this.activeWorkspace = next;
    if (previous) this.clearUnusedWorkspace(previous);
    return previous;
  }

  clearUnusedWorkspace(workspace: string): void {
    const normalized = normalizePath(workspace);
    for (const [path, entry] of this.entries) {
      if (entry.workspace === normalized && (entry.pinCount ?? 0) === 0 && !isDirty(entry)) {
        this.disposeEntry(path, entry);
      }
    }
  }

  evict(): void {
    const candidates = [...this.entries.entries()]
      .filter(([, entry]) => (entry.pinCount ?? 0) === 0 && !isDirty(entry) && !entry.model.isDisposed())
      .sort(([, a], [, b]) => (a.lastUsed ?? 0) - (b.lastUsed ?? 0));
    while (candidates.length > this.inactiveLimit) {
      const [path, entry] = candidates.shift()!;
      this.disposeEntry(path, entry);
    }
  }

  private disposeEntry(path: string, entry: CachedModel): void {
    if (this.entries.get(path) !== entry) return;
    this.entries.delete(path);
    if (!entry.model.isDisposed()) entry.model.dispose();
  }
}

export const MODEL_CACHE = new MonacoModelCache();

const TYPES_LOADING_PROMISES = new Map<string, Promise<void>>();
const PACKAGE_PATHS_CACHE = new Map<string, Record<string, string[]>>();
const EXTRA_LIB_DISPOSABLES = new Map<string, monaco.IDisposable[]>();
const TYPES_WORKSPACE_GENERATIONS = new Map<string, number>();
const LOCAL_IMPORT_RE = /(?:from|import|require|export\s+\*)\s*\(?\s*['"](\.\.?\/[^'"]+)['"]/g;
let activeTypesWorkspace: string | null = null;

function disposeWorkspaceTypes(cwd: string): void {
  const workspace = normalizePath(cwd);
  TYPES_WORKSPACE_GENERATIONS.set(workspace, (TYPES_WORKSPACE_GENERATIONS.get(workspace) ?? 0) + 1);
  for (const disposable of EXTRA_LIB_DISPOSABLES.get(workspace) ?? []) disposable.dispose();
  EXTRA_LIB_DISPOSABLES.delete(workspace);
  TYPES_LOADING_PROMISES.delete(workspace);
  PACKAGE_PATHS_CACHE.delete(workspace);
}

export function setActiveMonacoWorkspace(cwd: string | null): void {
  const workspace = cwd ? normalizePath(cwd) : null;
  if (workspace === activeTypesWorkspace) return;
  const previous = activeTypesWorkspace;
  activeTypesWorkspace = workspace;
  MODEL_CACHE.setActiveWorkspace(workspace);
  if (previous) disposeWorkspaceTypes(previous);
}

export function releaseMonacoWorkspace(cwd: string): void {
  const workspace = normalizePath(cwd);
  if (activeTypesWorkspace === workspace) {
    activeTypesWorkspace = null;
    MODEL_CACHE.setActiveWorkspace(null);
  } else {
    MODEL_CACHE.clearUnusedWorkspace(workspace);
  }
  disposeWorkspaceTypes(workspace);
}

export async function loadTypeDefinitions(m: typeof monaco, cwd: string): Promise<void> {
  const workspace = normalizePath(cwd);
  setActiveMonacoWorkspace(workspace);
  const baseUrl = `${workspace}/`;

  if (!TYPES_LOADING_PROMISES.has(workspace)) {
    const generation = TYPES_WORKSPACE_GENERATIONS.get(workspace) ?? 0;
    TYPES_LOADING_PROMISES.set(
      workspace,
      (async () => {
        const disposables: monaco.IDisposable[] = [];
        try {
          const res = await typeDefinitionService.preloadTypes(cwd);
          const packagePaths: Record<string, string[]> = {};

          if (res.ok && res.packages) {
            for (const pkg of res.packages) {
              const typeFilePath = normalizePath(pkg.typePath);
              if (typeFilePath.startsWith(baseUrl)) {
                packagePaths[pkg.name] = [`./${typeFilePath.slice(baseUrl.length)}`];
              }
            }
          }

          if (res.ok) {
            for (const typeFile of res.types) {
              try {
                disposables.push(
                  m.typescript.typescriptDefaults.addExtraLib(typeFile.content, normalizePath(typeFile.path)),
                );
              } catch {
                // A malformed declaration should not prevent the remaining libraries from loading.
              }
            }
          }

          if (activeTypesWorkspace !== workspace || (TYPES_WORKSPACE_GENERATIONS.get(workspace) ?? 0) !== generation) {
            for (const disposable of disposables) disposable.dispose();
            return;
          }
          PACKAGE_PATHS_CACHE.set(workspace, packagePaths);
          EXTRA_LIB_DISPOSABLES.set(workspace, disposables);
        } catch (error) {
          for (const disposable of disposables) disposable.dispose();
          console.error("Failed to load type definitions:", error);
          if ((TYPES_WORKSPACE_GENERATIONS.get(workspace) ?? 0) === generation) {
            TYPES_LOADING_PROMISES.delete(workspace);
            PACKAGE_PATHS_CACHE.delete(workspace);
          }
        }
      })(),
    );
  }

  await TYPES_LOADING_PROMISES.get(workspace);
  if (activeTypesWorkspace !== workspace) return;
  m.typescript.typescriptDefaults.setCompilerOptions({
    target: m.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: 100 as Parameters<
      typeof m.typescript.typescriptDefaults.setCompilerOptions
    >[0]["moduleResolution"],
    module: m.typescript.ModuleKind.ESNext,
    noEmit: true,
    typeRoots: [`${baseUrl}node_modules/@types`],
    jsx: m.typescript.JsxEmit.React,
    allowJs: true,
    reactNamespace: "React",
    esModuleInterop: true,
    isolatedModules: true,
    resolveJsonModule: true,
    allowSyntheticDefaultImports: true,
    noImplicitAny: false,
    noImplicitThis: false,
    strictNullChecks: false,
    baseUrl,
    paths: PACKAGE_PATHS_CACHE.get(workspace) || {},
  });
}

function resolveRelativePath(basePath: string, relativePath: string): string {
  const parts = basePath.replace(/[\\/][^\\/]+$/, "").split(/[\\/]/);
  for (const part of relativePath.split(/[\\/]/)) {
    if (part === "..") parts.pop();
    else if (part !== "." && part !== "") parts.push(part);
  }
  return parts.join("/");
}

export async function preloadLocalImports(
  m: typeof monaco,
  content: string,
  currentPath: string,
  cwd?: string,
): Promise<void> {
  const matches = [...content.matchAll(LOCAL_IMPORT_RE)];
  await Promise.all(
    matches.map(async (match) => {
      const absolutePath = resolveRelativePath(currentPath, match[1]);
      const lastSlash = absolutePath.lastIndexOf("/");
      const lastDot = absolutePath.lastIndexOf(".");
      const basePath = lastDot > lastSlash ? absolutePath.slice(0, lastDot) : absolutePath;

      for (const extension of ["", ".tsx", ".ts", ".js", ".jsx", "/index.tsx", "/index.ts", "/index.js"]) {
        const targetPath = basePath + extension;
        const uri = m.Uri.file(normalizePath(targetPath));
        const existing = m.editor.getModel(uri);
        if (existing) {
          const cached = MODEL_CACHE.peek(targetPath);
          if (!cached) {
            MODEL_CACHE.set(targetPath, {
              model: existing,
              originalContent: existing.getValue(),
              workspace: cwd,
            });
          }
          return;
        }

        const res = await fileService.read(targetPath);
        if (res.ok) {
          try {
            const model = m.editor.createModel(res.content, getLanguage(targetPath), uri);
            MODEL_CACHE.set(targetPath, { model, originalContent: res.content, workspace: cwd });
          } catch {
            // Another import may have created this model concurrently.
          }
          return;
        }
      }
    }),
  );
}
