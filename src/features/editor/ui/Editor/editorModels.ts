import type * as monaco from "monaco-editor";
import { editorGateway } from "@/features/editor/infrastructure/editorGateway";
import { fsApi } from "@/features/files/infrastructure/fsGateway";
import { getLanguage } from "@/shared/icons/utils";

interface CachedModel {
  model: monaco.editor.ITextModel;
  originalContent: string;
}

export const MODEL_CACHE = new Map<string, CachedModel>();

const TYPES_LOADING_PROMISES = new Map<string, Promise<void>>();
const PACKAGE_PATHS_CACHE = new Map<string, Record<string, string[]>>();
const LOCAL_IMPORT_RE = /(?:from|import|require|export\s+\*)\s*\(?\s*['"](\.\.?\/[^'"]+)['"]/g;

export async function loadTypeDefinitions(m: typeof monaco, cwd: string): Promise<void> {
  const baseUrl = `${cwd.replace(/\\/g, "/")}/`;

  if (!TYPES_LOADING_PROMISES.has(cwd)) {
    TYPES_LOADING_PROMISES.set(
      cwd,
      (async () => {
        try {
          const res = await editorGateway.preloadTypes(cwd);
          const packagePaths: Record<string, string[]> = {};

          if (res.ok && res.packages) {
            for (const pkg of res.packages) {
              const typeFilePath = pkg.typePath.replace(/\\/g, "/");
              if (typeFilePath.startsWith(baseUrl)) {
                packagePaths[pkg.name] = [`./${typeFilePath.slice(baseUrl.length)}`];
              }
            }
          }
          PACKAGE_PATHS_CACHE.set(cwd, packagePaths);

          if (res.ok) {
            for (const typeFile of res.types) {
              try {
                m.typescript.typescriptDefaults.addExtraLib(typeFile.content, typeFile.path.replace(/\\/g, "/"));
              } catch {
                // A malformed declaration should not prevent the remaining libraries from loading.
              }
            }
          }
        } catch (error) {
          console.error("Failed to load type definitions:", error);
          TYPES_LOADING_PROMISES.delete(cwd);
          PACKAGE_PATHS_CACHE.delete(cwd);
        }
      })(),
    );
  }

  await TYPES_LOADING_PROMISES.get(cwd);
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
    paths: PACKAGE_PATHS_CACHE.get(cwd) || {},
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

export async function preloadLocalImports(m: typeof monaco, content: string, currentPath: string): Promise<void> {
  const matches = [...content.matchAll(LOCAL_IMPORT_RE)];
  await Promise.all(
    matches.map(async (match) => {
      const absolutePath = resolveRelativePath(currentPath, match[1]);
      const lastSlash = absolutePath.lastIndexOf("/");
      const lastDot = absolutePath.lastIndexOf(".");
      const basePath = lastDot > lastSlash ? absolutePath.slice(0, lastDot) : absolutePath;

      for (const extension of ["", ".tsx", ".ts", ".js", ".jsx", "/index.tsx", "/index.ts", "/index.js"]) {
        const targetPath = basePath + extension;
        const uri = m.Uri.file(targetPath.replace(/\\/g, "/"));
        if (m.editor.getModel(uri)) return;

        const res = await fsApi.read(targetPath);
        if (res.ok) {
          try {
            const model = m.editor.createModel(res.content, getLanguage(targetPath), uri);
            MODEL_CACHE.set(targetPath, { model, originalContent: res.content });
          } catch {
            // Another import may have created this model concurrently.
          }
          return;
        }
      }
    }),
  );
}
