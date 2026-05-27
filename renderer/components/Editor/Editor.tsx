import { Editor as MonacoEditor, loader } from "@monaco-editor/react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import type * as monaco from "monaco-editor";
import React, { useCallback, useEffect, useRef, useState } from "react";
import "../../styles/Editor.css";
import { getLanguage } from "../icons/utils.js";
import { useTheme } from "../../hooks/useTheme.js";
import { makeMonacoTheme } from "../Themes/monacoThemes.js";
import { useI18n } from "../../hooks/useI18n.js";

// Wire up Monaco workers for Vite (one-time, module scope is fine)
if (typeof self !== "undefined") {
  self.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      if (label === "json") return new jsonWorker();
      if (label === "css" || label === "scss" || label === "less") return new cssWorker();
      if (label === "html" || label === "handlebars" || label === "razor") return new htmlWorker();
      if (label === "typescript" || label === "javascript") return new tsWorker();
      return new editorWorker();
    },
  };
}
// Configure Monaco to load from local public folder instead of CDN.
// This is much faster and works offline.
loader.config({ 
  paths: { 
    vs: "./monaco-editor/min/vs" 
  } 
});
// loader.init() is called in preloader.ts to start fetching Monaco assets early

interface Props {
  path: string;
  cwd?: string;
  onDirtyChange?: (dirty: boolean) => void;
  /** @deprecated kept for backward compat, no longer used */
  onClose?: () => void;
}

const TYPES_LOADING_PROMISES = new Map<string, Promise<void>>();

async function loadTypeDefinitions(m: typeof monaco, cwd: string) {
  let promise = TYPES_LOADING_PROMISES.get(cwd);
  if (promise) return promise;

  promise = (async () => {
    try {
      // Use a project-specific set for loaded libs within this promise scope
      // to avoid re-loading the same lib multiple times for the same project
      const projectLoadedLibs = new Set<string>();

      // 1. Basic compiler options
      m.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: m.languages.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution: m.languages.typescript.ModuleResolutionKind.NodeJs,
        module: m.languages.typescript.ModuleKind.ESNext,
        noEmit: true,
        typeRoots: ["node_modules/@types"],
        jsx: m.languages.typescript.JsxEmit.React,
        allowJs: true,
        reactNamespace: "React",
        esModuleInterop: true,
        isolatedModules: true,
        resolveJsonModule: true,
        // Important for local imports
        baseUrl: `file:///${cwd.replace(/\\/g, "/")}/`,
        paths: {
          "*": ["*"]
        },
        allowSyntheticDefaultImports: true,
        noImplicitAny: false,
        noImplicitThis: false,
        strictNullChecks: false,
      });

      const typeNames = new Set<string>();

      // 2. Scan package.json for dependencies
      const pkgRes = await window.vibe.fs.read(`${cwd}/package.json`);
      if (pkgRes.ok) {
        try {
          const pkg = JSON.parse(pkgRes.content);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          Object.keys(deps).forEach(d => typeNames.add(d));
        } catch (e) { /* ignore */ }
      }

      // 3. Scan node_modules/@types directly
      const typesDirRes = await window.vibe.fs.list(`${cwd}/node_modules/@types`);
      if (typesDirRes.ok) {
        typesDirRes.entries.forEach((e: any) => {
          if (e.isDir) {
            // Handle scoped types (e.g., @types/node)
            if (e.name.startsWith("__")) {
              typeNames.add(e.name.replace("__", "/"));
            } else {
              typeNames.add(e.name);
            }
          }
        });
      }

      // 4. Load discovered types
      for (const typeName of typeNames) {
        const pathsToTry = [
          `${cwd}/node_modules/${typeName}/package.json`,
          `${cwd}/node_modules/@types/${typeName}/package.json`,
          `${cwd}/node_modules/@types/${typeName.replace("/", "__")}/package.json`,
          `${cwd}/node_modules/${typeName}/index.d.ts`,
          `${cwd}/node_modules/@types/${typeName}/index.d.ts`,
        ];

        for (const p of pathsToTry) {
          if (projectLoadedLibs.has(p)) break;

          const res = await window.vibe.fs.read(p);
          if (!res.ok) continue;

          if (p.endsWith("package.json")) {
            try {
              const pkg = JSON.parse(res.content);
              const typesPath = pkg.types || pkg.typings;
              if (typesPath) {
                const fullPath = `${cwd}/node_modules/${typeName}/${typesPath.startsWith("./") ? typesPath.slice(2) : typesPath}`;
                if (!projectLoadedLibs.has(fullPath)) {
                  const typesRes = await window.vibe.fs.read(fullPath);
                  if (typesRes.ok) {
                    m.languages.typescript.typescriptDefaults.addExtraLib(
                      typesRes.content,
                      `file:///${fullPath.replace(/\\/g, "/")}`
                    );
                    projectLoadedLibs.add(fullPath);
                  }
                }
              }
            } catch (e) { /* ignore */ }
          } else {
            try {
              m.languages.typescript.typescriptDefaults.addExtraLib(
                res.content,
                `file:///${p.replace(/\\/g, "/")}`
              );
              projectLoadedLibs.add(p);
            } catch (e) { /* ignore */ }
            break;
          }
        }
      }

      // 5. Scan for local .d.ts files in the project
      try {
        const localTypesRes = await window.vibe.fs.find(cwd, "**/*.d.ts", 50);
        if (localTypesRes.ok) {
          for (const match of localTypesRes.matches) {
            const res = await window.vibe.fs.read(match.path);
            if (res.ok) {
              const fullPath = match.path.replace(/\\/g, "/");
              if (!projectLoadedLibs.has(fullPath)) {
                m.languages.typescript.typescriptDefaults.addExtraLib(
                  res.content,
                  `file:///${fullPath}`
                );
                projectLoadedLibs.add(fullPath);
              }
            }
          }
        }
      } catch (e) { /* ignore find errors */ }

    } catch (e) {
      console.error("Failed to load type definitions:", e);
      TYPES_LOADING_PROMISES.delete(cwd); // Allow retry on failure
    }
  })();

  TYPES_LOADING_PROMISES.set(cwd, promise);
  return promise;
}

// Simple helper to resolve relative paths for local imports
function resolveRelativePath(basePath: string, relPath: string): string {
  const baseDir = basePath.replace(/[\\/][^\\/]+$/, "");
  const parts = baseDir.split(/[\\/]/);
  const relParts = relPath.split(/[\\/]/);
  
  for (const part of relParts) {
    if (part === "..") parts.pop();
    else if (part !== "." && part !== "") parts.push(part);
  }
  return parts.join("/");
}

// Regex to find local imports in the file
const LOCAL_IMPORT_RE = /(?:from|import|require)\s*\(?\s*['"](\.\.?\/[^'"]+)['"]/g;

async function preloadLocalImports(m: typeof monaco, content: string, currentPath: string) {
  const matches = [...content.matchAll(LOCAL_IMPORT_RE)];
  for (const match of matches) {
    const relPath = match[1];
    const absolutePath = resolveRelativePath(currentPath, relPath);
    
    // Try common extensions
    const extensions = ["", ".tsx", ".ts", ".js", ".jsx", "/index.tsx", "/index.ts", "/index.js"];
    for (const ext of extensions) {
      const targetPath = absolutePath + ext;
      const uri = m.Uri.file(targetPath.replace(/\\/g, "/"));
      
      // If model already exists, skip
      if (m.editor.getModel(uri)) break;
      
      // Try to read the file
      const res = await window.vibe.fs.read(targetPath);
      if (res.ok) {
        try {
          const model = m.editor.createModel(res.content, getLanguage(targetPath), uri);
          // Also cache it so we don't reload from disk if the user opens it later
          MODEL_CACHE.set(targetPath, { model, originalContent: res.content });
        } catch (e) { /* model might have been created in parallel */ }
        break; 
      }
    }
  }
}

// Model cache to prevent "white text" and enable instant switching
interface CachedModel {
  model: monaco.editor.ITextModel;
  originalContent: string;
}
const MODEL_CACHE = new Map<string, CachedModel>();

export function Editor({ path, cwd, onDirtyChange }: Props): React.ReactElement {
  const { t } = useI18n();
  const [content, setContent] = useState<string | null>(null);
  const [original, setOriginal] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoInstanceRef = useRef<typeof monaco | null>(null);

  const { currentTheme, previewTheme, colorScheme } = useTheme();
  const activeTheme = previewTheme ?? currentTheme;
  const resolvedScheme = colorScheme === "system"
    ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : colorScheme;
  const isDark = resolvedScheme === "dark";
  const themeVars = isDark ? activeTheme.darkVars : activeTheme.lightVars;
  const monacoThemeName = `vibe-editor-${activeTheme.id}-${resolvedScheme}`;

  useEffect(() => {
    const m = monacoInstanceRef.current;
    if (!m) return;
    m.editor.defineTheme(monacoThemeName, makeMonacoTheme(themeVars, isDark));
    m.editor.setTheme(monacoThemeName);
  }, [themeVars, monacoThemeName, isDark]);

  // Helper to get or create model
  const getOrCreateModel = useCallback((m: typeof monaco, p: string, initialContent: string) => {
    const normalizedPath = p.replace(/\\/g, "/");
    const uri = m.Uri.file(normalizedPath);
    let model = m.editor.getModel(uri);
    if (!model) {
      model = m.editor.createModel(initialContent, getLanguage(normalizedPath), uri);
    }
    return model;
  }, []);

  // Load content and manage models
  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 1. If we have monaco instance, check for existing model
      if (monacoInstanceRef.current) {
        try {
          const m = monacoInstanceRef.current;
          const uri = m.Uri.file(path);
          const existingModel = m.editor.getModel(uri);
          const cached = MODEL_CACHE.get(path);

          if (existingModel && cached) {
            setContent(existingModel.getValue());
            setOriginal(cached.originalContent);
            if (editorRef.current) {
              editorRef.current.setModel(existingModel);
            }
            // Trigger preload even for cached models
            preloadLocalImports(m, existingModel.getValue(), path);
            return;
          }
        } catch (e) {
          // If instance is disposed, we'll continue to load from disk
          console.warn("Failed to reuse existing model (likely disposed):", e);
        }
      }

      // 2. Load from disk
      setError(null);
      setContent(null); // Show loading state
      
      try {
        const res = await window.vibe.fs.read(path);
        if (cancelled) return;
        
        if (!res.ok) {
          setError(res.error);
        } else {
          setContent(res.content);
          setOriginal(res.content);
          
          if (monacoInstanceRef.current) {
            try {
              const m = monacoInstanceRef.current;
              const model = getOrCreateModel(m, path, res.content);
              MODEL_CACHE.set(path, { model, originalContent: res.content });
              if (editorRef.current) {
                editorRef.current.setModel(model);
              }
              // Preload local imports to fix "Cannot find module" errors
              preloadLocalImports(m, res.content, path);
            } catch (monacoErr: any) {
              console.error("Monaco error during load:", monacoErr);
              // Don't set global error if it's just a monaco race condition
              // but if it's persistent, we might need to.
              if (monacoErr.message?.includes("disposed")) {
                // Ignore disposal errors during transition
              } else {
                setError(monacoErr.message || "Editor error");
              }
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to read file");
      }
    }

    load();
    
    return () => {
      cancelled = true;
    };
  }, [path, getOrCreateModel]);

  const dirty = content !== null && content !== original;

  // Update original content in cache when saved
  const updateCacheOriginal = useCallback((newOriginal: string) => {
    const cached = MODEL_CACHE.get(path);
    if (cached) {
      cached.originalContent = newOriginal;
      setOriginal(newOriginal);
    }
  }, [path]);

  // Notify parent when dirty state changes
  const prevDirtyRef = React.useRef(false);
  React.useEffect(() => {
    if (prevDirtyRef.current !== dirty) {
      prevDirtyRef.current = dirty;
      onDirtyChange?.(dirty);
    }
  }, [dirty, onDirtyChange]);

  const save = useCallback(async () => {
    if (content === null || saving || !dirty) return;
    setSaving(true);
    try {
      const res = await window.vibe.fs.write(path, content);
      setSaving(false);
      if (!res.ok) setError(res.error);
      else {
        updateCacheOriginal(content);
      }
    } catch (e: any) {
      setSaving(false);
      setError(e.message || "Failed to save file");
    }
  }, [content, dirty, path, saving, updateCacheOriginal]);

  // Ctrl/Cmd+S
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  if (error) {
    return (
      <div className="editor editor--error">
        <span className="editor__error-title">{t("cannotOpenFile")}</span>
        <span className="editor__error-msg">{error}</span>
        <button className="editor__retry" onClick={() => { setError(null); setContent(null); }}>
          {t("retry")}
        </button>
      </div>
    );
  }

  // Use a simple loading state to avoid rendering Monaco with null/empty content
  if (content === null) {
    return <div className="editor editor--loading">{t("loading")}</div>;
  }

  return (
    <div className="editor">
      <MonacoEditor
        height="100%"
        theme={monacoThemeName}
        // No 'path' here to keep manual model control
        language={getLanguage(path)}
        value={content}
        loading={<div className="editor editor--loading">{t("loading")}</div>}
        beforeMount={(m) => {
          monacoInstanceRef.current = m;
          m.editor.defineTheme(monacoThemeName, makeMonacoTheme(themeVars, isDark));
          if (cwd) {
            loadTypeDefinitions(m, cwd);
          }
        }}
        onMount={(ed, m) => {
          editorRef.current = ed;
          monacoInstanceRef.current = m;
          
          try {
            // Ensure model is correctly set on mount
            const model = getOrCreateModel(m, path, content);
            MODEL_CACHE.set(path, { model, originalContent: original });
            ed.setModel(model);

            ed.onDidChangeModelContent(() => {
              setContent(ed.getValue());
            });
          } catch (e) {
            console.error("Error mounting editor:", e);
          }
        }}
        options={{
          fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
          fontSize: 13,
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderLineHighlight: "line",
          smoothScrolling: true,
          cursorBlinking: "smooth",
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          lineNumbersMinChars: 3,
          lineDecorationsWidth: 10,
          glyphMargin: false,
          folding: false,
          fixedOverflowWidgets: true,
          padding: { top: 10, bottom: 10 },
          scrollbar: {
            vertical: "hidden",
            horizontal: "hidden",
            useShadows: false,
            verticalScrollbarSize: 0,
            horizontalScrollbarSize: 0,
          },
        }}
      />
    </div>
  );
}
