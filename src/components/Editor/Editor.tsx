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
import { scg2Tracker } from "../../services/scg2Tracker.js";

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
    vs: "./monaco-editor/min/vs",
  },
});
// loader.init() is called in preloader.ts to start fetching Monaco assets early

interface Props {
  path: string;
  cwd?: string;
  onDirtyChange?: (dirty: boolean) => void;
  /** @deprecated kept for backward compat, no longer used */
  onClose?: () => void;
  /** Line number to navigate to after opening */
  gotoLine?: number;
  /** Column to set cursor when navigating */
  gotoColumn?: number;
  /** Match length to select when navigating */
  gotoMatchLength?: number;
}

const TYPES_LOADING_PROMISES = new Map<string, Promise<void>>();
const PACKAGE_PATHS_CACHE = new Map<string, Record<string, string[]>>();

async function loadTypeDefinitions(m: typeof monaco, cwd: string) {
  const baseUrl = cwd.replace(/\\/g, "/") + "/";

  // Load type data from backend once per cwd
  if (!TYPES_LOADING_PROMISES.has(cwd)) {
    TYPES_LOADING_PROMISES.set(
      cwd,
      (async () => {
        try {
          const res = await window.vibe.editor.preloadTypes(cwd);

          const packagePaths: Record<string, string[]> = {};
          if (res.ok && res.packages) {
            for (const pkg of res.packages) {
              const typeFilePath = pkg.typePath.replace(/\\/g, "/");
              if (typeFilePath.startsWith(baseUrl)) {
                packagePaths[pkg.name] = ["./" + typeFilePath.slice(baseUrl.length)];
              }
            }
          }
          PACKAGE_PATHS_CACHE.set(cwd, packagePaths);

          if (res.ok) {
            for (const tf of res.types) {
              try {
                m.typescript.typescriptDefaults.addExtraLib(tf.content, tf.path.replace(/\\/g, "/"));
              } catch (e) {
                /* ignore per-file errors */
              }
            }
          }
        } catch (e) {
          console.error("Failed to load type definitions:", e);
          TYPES_LOADING_PROMISES.delete(cwd);
          PACKAGE_PATHS_CACHE.delete(cwd);
        }
      })(),
    );
  }

  await TYPES_LOADING_PROMISES.get(cwd);

  // Always set compiler options (triggers TS re-check on every file switch)
  const packagePaths = PACKAGE_PATHS_CACHE.get(cwd) || {};
  m.typescript.typescriptDefaults.setCompilerOptions({
    target: m.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: 100 as any /* ModuleResolutionKind.Bundler */,
    module: m.typescript.ModuleKind.ESNext,
    noEmit: true,
    typeRoots: [baseUrl + "node_modules/@types"],
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
    baseUrl: baseUrl,
    paths: packagePaths,
  });
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

// Regex to find local imports in the file (matches import/export/require patterns)
const LOCAL_IMPORT_RE = /(?:from|import|require|export\s+\*)\s*\(?\s*['"](\.\.?\/[^'"]+)['"]/g;

async function preloadLocalImports(m: typeof monaco, content: string, currentPath: string) {
  const matches = [...content.matchAll(LOCAL_IMPORT_RE)];

  await Promise.all(
    matches.map(async (match) => {
      const relPath = match[1];
      const absolutePath = resolveRelativePath(currentPath, relPath);

      // Strip existing extension so .js imports resolve to .ts/.tsx source files
      const lastSlash = absolutePath.lastIndexOf("/");
      const lastDot = absolutePath.lastIndexOf(".");
      const basePath = lastDot > lastSlash ? absolutePath.slice(0, lastDot) : absolutePath;

      const extensions = ["", ".tsx", ".ts", ".js", ".jsx", "/index.tsx", "/index.ts", "/index.js"];
      for (const ext of extensions) {
        const targetPath = basePath + ext;
        const uri = m.Uri.file(targetPath.replace(/\\/g, "/"));
        if (m.editor.getModel(uri)) return;
        const res = await window.vibe.fs.read(targetPath);
        if (res.ok) {
          try {
            const model = m.editor.createModel(res.content, getLanguage(targetPath), uri);
            MODEL_CACHE.set(targetPath, { model, originalContent: res.content });
          } catch (e) {
            /* model might have been created in parallel */
          }
          return;
        }
      }
    }),
  );
}

// Model cache to prevent "white text" and enable instant switching
interface CachedModel {
  model: monaco.editor.ITextModel;
  originalContent: string;
}
const MODEL_CACHE = new Map<string, CachedModel>();
let monacoProvidersRegistered = false;

export function Editor({ path, cwd, onDirtyChange, gotoLine, gotoColumn, gotoMatchLength }: Props): React.ReactElement {
  const { t } = useI18n();
  const [content, setContent] = useState<string | null>(null);
  const [original, setOriginal] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoInstanceRef = useRef<typeof monaco | null>(null);

  const { currentTheme, previewTheme, colorScheme } = useTheme();
  const activeTheme = previewTheme ?? currentTheme;
  const resolvedScheme =
    colorScheme === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
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

  // Load content from disk when path changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      setContent(null);

      const res = await window.vibe.fs.read(path);
      if (cancelled) return;

      if (!res.ok) {
        setError(res.error);
        return;
      }

      setContent(res.content);
      setOriginal(res.content);

      // Preload type definitions and local imports for every file switch.
      // onMount only fires once (when the editor is first created), so
      // subsequent file changes depend on this path.
      const m = monacoInstanceRef.current;
      if (m && cwd) {
        await loadTypeDefinitions(m, cwd);
        await preloadLocalImports(m, res.content, path);
      }
      scg2Tracker.updateActivePath(path);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [path]);

  const dirty = content !== null && content !== original;

  // Update original content in cache when saved
  const updateCacheOriginal = useCallback(
    (newOriginal: string) => {
      const cached = MODEL_CACHE.get(path);
      if (cached) {
        cached.originalContent = newOriginal;
        setOriginal(newOriginal);
      }
    },
    [path],
  );

  // Notify parent when dirty state changes
  const prevDirtyRef = React.useRef(false);
  React.useEffect(() => {
    if (prevDirtyRef.current !== dirty) {
      prevDirtyRef.current = dirty;
      onDirtyChange?.(dirty);
    }
  }, [dirty, onDirtyChange]);

  // Navigate to position when gotoLine changes while editor is already mounted
  useEffect(() => {
    const ed = editorRef.current;
    const m = monacoInstanceRef.current;
    if (ed && gotoLine !== undefined) {
      const col = gotoColumn ?? 1;
      ed.revealLineInCenter(gotoLine);
      ed.setPosition({ lineNumber: gotoLine, column: col });
      if (m && gotoColumn !== undefined && gotoMatchLength !== undefined) {
        ed.setSelection(new m.Range(gotoLine, col, gotoLine, col + gotoMatchLength));
      }
      ed.focus();
    }
  }, [gotoLine, gotoColumn, gotoMatchLength]);

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
        <button
          className="editor__retry"
          onClick={() => {
            setError(null);
            setContent(null);
          }}
        >
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
        path={"file://" + path.replace(/\\/g, "/")}
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
        onMount={async (ed, m) => {
          editorRef.current = ed;
          monacoInstanceRef.current = m;

          if (!monacoProvidersRegistered) {
            monacoProvidersRegistered = true;
            m.languages.registerHoverProvider("*", {
              provideHover: (model: monaco.editor.ITextModel, position: monaco.Position) => {
                const markers = m.editor.getModelMarkers({ resource: model.uri });
                const markerAtPos = markers.find(
                  (marker: monaco.editor.IMarker) =>
                    marker.severity === m.MarkerSeverity.Error &&
                    position.lineNumber >= marker.startLineNumber &&
                    position.lineNumber <= marker.endLineNumber &&
                    position.column >= marker.startColumn &&
                    position.column <= marker.endColumn,
                );

                if (markerAtPos) {
                  const text = model.getValueInRange(markerAtPos);
                  const args = encodeURIComponent(
                    JSON.stringify([
                      model.uri.path,
                      markerAtPos.message,
                      text,
                      markerAtPos.startLineNumber,
                      markerAtPos.endLineNumber,
                    ]),
                  );
                  return {
                    range: markerAtPos,
                    contents: [
                      {
                        value: `[$(sparkle) Fix it (Agent)](command:agent.fixError?${args})`,
                        isTrusted: true,
                        supportThemeIcons: true,
                      },
                    ],
                  };
                }
                return null;
              },
            });
          }

          const domNode = ed.getDomNode();
          if (domNode) {
            domNode.addEventListener(
              "click",
              (e) => {
                let target = e.target as HTMLElement;
                while (target && target !== domNode) {
                  const href = target.getAttribute("data-href") || target.getAttribute("href");
                  if (href && href.startsWith("command:agent.fixError?")) {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                      const argsStr = href.substring("command:agent.fixError?".length);
                      const parsedArgs = JSON.parse(decodeURIComponent(argsStr));
                      if (parsedArgs.length === 5) {
                        const [filePath, message, text, startLine, endLine] = parsedArgs;
                        const prompt = `Please fix the following error in \`${filePath}\` (lines ${startLine}-${endLine}):\n\n**Error:**\n${message}\n\n**Code:**\n\`\`\`typescript\n${text}\n\`\`\`\n`;
                        window.vibe.send(prompt);
                      }
                    } catch (err) {
                      console.error("Agent quick fix parse error", err);
                    }
                    return;
                  }
                  target = target.parentElement as HTMLElement;
                }
              },
              true,
            ); // use capture to intercept before monaco
          }

          try {
            // Ensure type definitions (extraLibs + compiler options) are loaded
            // before the TS worker processes this file.
            if (cwd) {
              await loadTypeDefinitions(m, cwd);
            }

            // Preload imported files as Monaco models so the TS worker
            // can resolve them immediately.
            await preloadLocalImports(m, content, path);

            const uri = m.Uri.file(path);
            const model = m.editor.getModel(uri) ?? m.editor.createModel(content, getLanguage(path), uri);
            MODEL_CACHE.set(path, { model, originalContent: original });

            scg2Tracker.attach(ed, path, m);

            ed.onDidChangeModelContent(() => {
              setContent(ed.getValue());
            });

            // Navigate to line when opening from search results
            if (gotoLine !== undefined) {
              const col = gotoColumn ?? 1;
              ed.revealLineInCenter(gotoLine);
              ed.setPosition({ lineNumber: gotoLine, column: col });
              if (gotoColumn !== undefined && gotoMatchLength !== undefined) {
                ed.setSelection(new m.Range(gotoLine, col, gotoLine, col + gotoMatchLength));
              }
              ed.focus();
            }
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
