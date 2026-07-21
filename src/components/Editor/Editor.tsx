import { Editor as MonacoEditor, loader } from "@monaco-editor/react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import type * as monaco from "monaco-editor";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { InlinePromptPanel, InlineActionPill } from "./InlineVibePanel.js";
import "./Editor.css";
import { getLanguage } from "../Icons/utils.js";
import { useTheme } from "../../hooks/useTheme.js";
import { makeMonacoTheme } from "../Themes/monacoThemes.js";
import { useI18n } from "../../hooks/useI18n.js";
import { scg2Tracker } from "../../services/scg2Tracker.js";
import { connectMonacoLsp, type MonacoLspSession } from "../../services/monacoLspClient.js";

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
  const initialCached = MODEL_CACHE.get(path);
  const [content, setContent] = useState<string | null>(() => (initialCached ? initialCached.model.getValue() : null));
  const isContentLoading = content === null;
  const [original, setOriginal] = useState<string>(() => (initialCached ? initialCached.originalContent : ""));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoInstanceRef = useRef<typeof monaco | null>(null);
  const lspSessionRef = useRef<MonacoLspSession | null>(null);

  useEffect(() => {
    if (isContentLoading || !cwd) return;
    const m = monacoInstanceRef.current;
    const model = editorRef.current?.getModel();
    if (!m || !model) return;

    let cancelled = false;
    let disposable: MonacoLspSession | null = null;
    void connectMonacoLsp(m, model, cwd)
      .then((result) => {
        if (cancelled) result?.dispose();
        else {
          disposable = result;
          lspSessionRef.current = result;
        }
      })
      .catch((error) => console.error(`Failed to connect Monaco to LSP for ${model.getLanguageId()}:`, error));

    return () => {
      cancelled = true;
      disposable?.dispose();
      if (lspSessionRef.current === disposable) lspSessionRef.current = null;
    };
  }, [isContentLoading, cwd, path]);

  const [editorOptions, setEditorOptions] = useState<any>({
    fontSize: 13,
    lineHeight: 19.5,
    fontLigatures: false,
    cursorStyle: "line",
    cursorBlinking: "blink",
  });

  useEffect(() => {
    Promise.all([
      window.vibe.state.get("settings:editorFontSize"),
      window.vibe.state.get("settings:editorLineHeight"),
      window.vibe.state.get("settings:editorLigatures"),
      window.vibe.state.get("settings:editorCursorStyle"),
      window.vibe.state.get("settings:editorCursorBlink"),
    ]).then(([size, lh, lig, cs, cb]) => {
      setEditorOptions((prev: any) => {
        const fontSize = size ? parseInt(size, 10) : 13;
        const lineHeightMult = lh ? parseFloat(lh) : 1.5;
        return {
          ...prev,
          fontSize,
          lineHeight: fontSize * lineHeightMult,
          fontLigatures: lig === "true",
          cursorStyle: cs || "line",
          cursorBlinking: cb || "blink",
        };
      });
    });

    const onSettingsChanged = (e: any) => {
      const { key, value } = e.detail;
      setEditorOptions((prev: any) => {
        const next = { ...prev };
        if (key === "editorFontSize") {
          next.fontSize = parseInt(value, 10);
          next.lineHeight = next.fontSize * (prev.lineHeight / prev.fontSize || 1.5);
        }
        if (key === "editorLineHeight") {
          next.lineHeight = parseFloat(value) * (next.fontSize || 13);
        }
        if (key === "editorLigatures") next.fontLigatures = value;
        if (key === "editorCursorStyle") next.cursorStyle = value;
        if (key === "editorCursorBlink") next.cursorBlinking = value;
        return next;
      });
    };

    window.addEventListener("settings-changed", onSettingsChanged);
    return () => window.removeEventListener("settings-changed", onSettingsChanged);
  }, []);

  // --- Inline Vibe states & refs ---
  const inlineZoneIdRef = useRef<string | null>(null);
  const inlineZoneDescriptorRef = useRef<monaco.editor.IViewZone | null>(null);
  const inlineDecorationsRef = useRef<string[]>([]);
  const ghostDecorationsRef = useRef<string[]>([]);
  const lastGhostStateRef = useRef<{ lineNumber: number; column: number; text: string } | null>(null);
  const lastTriggerTimeRef = useRef<number>(0);
  const inlineLoadingRef = useRef<boolean>(false);

  const [inlineZoneNode, setInlineZoneNode] = useState<HTMLDivElement | null>(null);
  const [inlineLoading, setInlineLoading] = useState(false);
  const [hasInlineDiff, setHasInlineDiff] = useState(false);

  const inlineSessionRef = useRef<{
    startLine: number;
    endLine: number;
    originalText: string;
    selection: monaco.Selection;
  } | null>(null);

  const updateGhostText = useCallback(() => {
    const ed = editorRef.current;
    const m = monacoInstanceRef.current;
    if (!ed || !m) return;

    if (inlineZoneNode !== null || inlineSessionRef.current !== null) {
      if (ghostDecorationsRef.current.length > 0) {
        ghostDecorationsRef.current = ed.deltaDecorations(ghostDecorationsRef.current, []);
        lastGhostStateRef.current = null;
      }
      return;
    }

    const pos = ed.getPosition();
    const model = ed.getModel();
    if (!pos || !model) {
      if (ghostDecorationsRef.current.length > 0) {
        ghostDecorationsRef.current = ed.deltaDecorations(ghostDecorationsRef.current, []);
        lastGhostStateRef.current = null;
      }
      return;
    }

    const lineContent = model.getLineContent(pos.lineNumber);
    if (lineContent.trim() === "") {
      if (
        ghostDecorationsRef.current.length > 0 &&
        lastGhostStateRef.current?.lineNumber === pos.lineNumber &&
        lastGhostStateRef.current?.column === pos.column &&
        lastGhostStateRef.current?.text === lineContent
      ) {
        return;
      }

      const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const shortcutText = isMac ? "⌘K" : "Ctrl+K";
      ghostDecorationsRef.current = ed.deltaDecorations(ghostDecorationsRef.current, [
        {
          range: new m.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
          options: {
            after: {
              content: `  ${shortcutText} to generate or edit with Inline Vibe`,
              inlineClassName: "inline-vibe-ghost-text",
            },
          },
        },
      ]);
      lastGhostStateRef.current = { lineNumber: pos.lineNumber, column: pos.column, text: lineContent };
    } else {
      if (ghostDecorationsRef.current.length > 0) {
        ghostDecorationsRef.current = ed.deltaDecorations(ghostDecorationsRef.current, []);
        lastGhostStateRef.current = null;
      }
    }
  }, [inlineZoneNode]);

  const updateGhostTextRef = useRef(updateGhostText);
  useEffect(() => {
    updateGhostTextRef.current = updateGhostText;
  }, [updateGhostText]);

  useEffect(() => {
    updateGhostText();
  }, [updateGhostText]);

  const cleanupInlineSession = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;

    if (inlineZoneIdRef.current !== null) {
      ed.changeViewZones((changeAccessor) => {
        changeAccessor.removeZone(inlineZoneIdRef.current!);
      });
      inlineZoneIdRef.current = null;
    }
    inlineZoneDescriptorRef.current = null;
    setInlineZoneNode(null);

    if (inlineDecorationsRef.current.length > 0) {
      ed.deltaDecorations(inlineDecorationsRef.current, []);
      inlineDecorationsRef.current = [];
    }

    inlineLoadingRef.current = false;
    inlineSessionRef.current = null;
    setHasInlineDiff(false);
    setInlineLoading(false);
    if (ed) setContent(ed.getValue());

    setTimeout(() => {
      updateGhostTextRef.current();
    }, 10);
  }, []);

  const handleAcceptInlineChanges = useCallback(() => {
    cleanupInlineSession();
  }, [cleanupInlineSession]);

  const handleRejectInlineChanges = useCallback(() => {
    const ed = editorRef.current;
    const m = monacoInstanceRef.current;
    const session = inlineSessionRef.current;
    if (!ed || !m || !session) {
      cleanupInlineSession();
      return;
    }

    const replaceRange = new m.Range(
      session.startLine,
      1,
      session.endLine,
      ed.getModel()!.getLineMaxColumn(session.endLine),
    );

    ed.executeEdits("inline-vibe-reject", [
      {
        range: replaceRange,
        text: session.originalText,
        forceMoveMarkers: true,
      },
    ]);

    cleanupInlineSession();
  }, [cleanupInlineSession]);

  const handleNavDiff = useCallback((direction: "next" | "prev") => {
    const ed = editorRef.current;
    const session = inlineSessionRef.current;
    if (!ed || !session) return;

    // With direct replacement, we can just jump to the start or end of the modified block
    if (direction === "next") {
      ed.revealLineInCenter(session.endLine);
      ed.setPosition({ lineNumber: session.endLine, column: 1 });
    } else {
      ed.revealLineInCenter(session.startLine);
      ed.setPosition({ lineNumber: session.startLine, column: 1 });
    }
    ed.focus();
  }, []);

  const handleInlineStreamUpdate = useCallback(
    (generatedText: string) => {
      const ed = editorRef.current;
      const m = monacoInstanceRef.current;
      const session = inlineSessionRef.current;
      if (!ed || !m || !session) return;

      let cleanedText = generatedText.trim();
      if (cleanedText.startsWith("```")) {
        const lines = cleanedText.split("\n");
        if (lines[0].startsWith("```")) lines.shift();
        if (lines.length > 0 && lines[lines.length - 1].startsWith("```")) lines.pop();
        cleanedText = lines.join("\n");
      }

      const generatedLinesCount = cleanedText.split("\n").length;
      const newEndLine = session.startLine + generatedLinesCount - 1;

      const replaceRange = new m.Range(
        session.startLine,
        1,
        session.endLine,
        ed.getModel()!.getLineMaxColumn(session.endLine),
      );

      ed.executeEdits("inline-vibe", [
        {
          range: replaceRange,
          text: cleanedText,
          forceMoveMarkers: true,
        },
      ]);

      session.endLine = newEndLine;

      const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
      for (let i = session.startLine; i <= session.endLine; i++) {
        newDecorations.push({
          range: new m.Range(i, 1, i, 1),
          options: {
            isWholeLine: true,
            className: "inline-diff-added",
            linesDecorationsClassName: "inline-diff-added-gutter",
          },
        });
      }

      inlineDecorationsRef.current = ed.deltaDecorations(inlineDecorationsRef.current, newDecorations);

      // Reposition the ViewZone right below newEndLine only if line count changed or zone isn't created yet
      const zoneDiv = inlineZoneNode || document.createElement("div");
      if (!inlineZoneNode) {
        zoneDiv.className = "inline-vibe-zone-container";
        setInlineZoneNode(zoneDiv);
      }
      if (!hasInlineDiff) {
        setHasInlineDiff(true);
      }

      const currentDescriptor = inlineZoneDescriptorRef.current;
      if (inlineZoneIdRef.current === null || !currentDescriptor || currentDescriptor.afterLineNumber !== newEndLine) {
        const currentHeight =
          currentDescriptor?.heightInPx ||
          Math.max(40, (zoneDiv.querySelector(".inline-vibe-portal-root") as HTMLElement)?.scrollHeight + 16 || 76);
        const descriptor: monaco.editor.IViewZone = {
          afterLineNumber: newEndLine,
          heightInPx: currentHeight,
          domNode: zoneDiv,
        };

        ed.changeViewZones((changeAccessor) => {
          if (inlineZoneIdRef.current !== null) {
            changeAccessor.removeZone(inlineZoneIdRef.current);
          }
          const zoneId = changeAccessor.addZone(descriptor);
          inlineZoneIdRef.current = zoneId;
        });

        inlineZoneDescriptorRef.current = descriptor;
        ed.revealLineInCenterIfOutsideViewport(newEndLine);
      }
    },
    [inlineZoneNode, hasInlineDiff],
  );

  const handleSendPrompt = useCallback(
    async (promptText: string) => {
      const ed = editorRef.current;
      const m = monacoInstanceRef.current;
      const session = inlineSessionRef.current;
      if (!ed || !m || !session) return;

      if (hasInlineDiff) {
        const replaceRange = new m.Range(
          session.startLine,
          1,
          session.endLine,
          ed.getModel()!.getLineMaxColumn(session.endLine),
        );
        const currentText = ed.getModel()!.getValueInRange(replaceRange);
        session.originalText = currentText;

        if (inlineDecorationsRef.current.length > 0) {
          ed.deltaDecorations(inlineDecorationsRef.current, []);
          inlineDecorationsRef.current = [];
        }
        setHasInlineDiff(false);

        if (inlineZoneIdRef.current !== null && inlineZoneDescriptorRef.current && inlineZoneNode) {
          inlineZoneDescriptorRef.current.afterLineNumber = session.endLine;
          const descriptor = inlineZoneDescriptorRef.current;
          ed.changeViewZones((changeAccessor) => {
            if (inlineZoneIdRef.current !== null) {
              changeAccessor.removeZone(inlineZoneIdRef.current);
              inlineZoneIdRef.current = changeAccessor.addZone(descriptor);
            }
          });
        }
      }

      inlineLoadingRef.current = true;
      setInlineLoading(true);

      const sessionId = `inline-vibe-${Date.now()}`;
      let accumulatedText = "";

      const { listen } = await import("@tauri-apps/api/event");
      let rafId: number | null = null;
      const unlistenDelta = await listen<any>("vibe:llm:delta", (e) => {
        if (e.payload.sessionId === sessionId) {
          accumulatedText += e.payload.content;
          if (rafId === null) {
            rafId = requestAnimationFrame(() => {
              handleInlineStreamUpdate(accumulatedText);
              rafId = null;
            });
          }
        }
      });

      const unlistenDone = await listen<any>("vibe:llm:done", (e) => {
        if (e.payload.sessionId === sessionId) {
          if (rafId !== null) cancelAnimationFrame(rafId);
          unlistenDelta();
          unlistenDone();
          unlistenError();
          inlineLoadingRef.current = false;
          setInlineLoading(false);
          handleInlineStreamUpdate(accumulatedText);
          if (editorRef.current) {
            setContent(editorRef.current.getValue());
          }
        }
      });

      const unlistenError = await listen<any>("vibe:llm:error", (e) => {
        if (e.payload.sessionId === sessionId) {
          if (rafId !== null) cancelAnimationFrame(rafId);
          unlistenDelta();
          unlistenDone();
          unlistenError();
          inlineLoadingRef.current = false;
          setInlineLoading(false);
          if (editorRef.current) {
            setContent(editorRef.current.getValue());
          }
          alert("Error generating inline edits: " + e.payload.error);
          cleanupInlineSession();
        }
      });

      try {
        const rawConfig = await invoke<any>("read_config");
        if (!rawConfig) {
          throw new Error("No configuration found. Please set up your API key and model.");
        }
        const systemPrompt = `You are an expert programmer. The user has selected a block of code in a file and requested an inline modification.
Your task is to rewrite/modify the selected code block according to the user's instructions.
Return ONLY the modified code that should replace the selected code.
Do NOT wrap the code in markdown formatting (like \`\`\`typescript ... \`\`\`), and do NOT add any conversational explanation.
Only output the raw code replacements. Ensure the indentation is correct for the selected block context.`;

        const userPrompt = `File Path: ${path}
File Language: ${getLanguage(path)}

--- SELECT CONTEXT ---
${session.originalText}
----------------------

User Instruction: ${promptText}`;

        const messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ];

        await invoke("llm_stream", {
          sessionId,
          config: {
            apiKey: rawConfig.apiKey,
            baseUrl: rawConfig.baseUrl,
            model: rawConfig.model,
            apiUrl: rawConfig.apiUrl || null,
            providerId: rawConfig.providerId || null,
          },
          messages,
          tools: [],
        });
      } catch (err: any) {
        unlistenDelta();
        unlistenDone();
        unlistenError();
        inlineLoadingRef.current = false;
        setInlineLoading(false);
        alert("Failed to start stream: " + err.message);
        cleanupInlineSession();
      }
    },
    [path, handleInlineStreamUpdate, cleanupInlineSession, inlineZoneNode],
  );

  const handleTriggerInlineVibe = useCallback(() => {
    const now = Date.now();
    if (now - lastTriggerTimeRef.current < 300) return;
    lastTriggerTimeRef.current = now;

    const ed = editorRef.current;
    const m = monacoInstanceRef.current;
    if (!ed || !m) return;

    if (inlineZoneIdRef.current !== null || inlineZoneNode !== null) {
      const existingTextarea =
        inlineZoneNode?.querySelector("textarea") || ed.getDomNode()?.querySelector(".inline-vibe-textarea");
      if (existingTextarea && document.body.contains(existingTextarea) && document.activeElement !== existingTextarea) {
        (existingTextarea as HTMLElement).focus();
        return;
      }
      // If zone was detached, stale or already focused, clean it up and continue to create fresh session
      cleanupInlineSession();
    }

    cleanupInlineSession();

    let selection = ed.getSelection();
    if (!selection || selection.isEmpty()) {
      const position = ed.getPosition();
      if (position) {
        selection = new m.Selection(
          position.lineNumber,
          1,
          position.lineNumber,
          ed.getModel()!.getLineMaxColumn(position.lineNumber),
        );
        ed.setSelection(selection);
      }
    }

    if (!selection) return;

    const originalText = ed.getModel()!.getValueInRange(selection);
    inlineSessionRef.current = {
      startLine: selection.startLineNumber,
      endLine: selection.endLineNumber,
      originalText,
      selection: new m.Selection(
        selection.startLineNumber,
        selection.startColumn,
        selection.endLineNumber,
        selection.endColumn,
      ),
    };

    const zoneDiv = document.createElement("div");
    zoneDiv.className = "inline-vibe-zone-container";

    const descriptor: monaco.editor.IViewZone = {
      afterLineNumber: selection.endLineNumber,
      heightInPx: 42,
      domNode: zoneDiv,
    };

    ed.changeViewZones((changeAccessor) => {
      const zoneId = changeAccessor.addZone(descriptor);
      inlineZoneIdRef.current = zoneId;
    });

    inlineZoneDescriptorRef.current = descriptor;
    setInlineZoneNode(zoneDiv);
    setHasInlineDiff(false);

    if (ghostDecorationsRef.current.length > 0) {
      ed.deltaDecorations(ghostDecorationsRef.current, []);
      ghostDecorationsRef.current = [];
      lastGhostStateRef.current = null;
    }

    // Improve auto-scroll so the inline vibe zone is clearly visible
    ed.revealLineInCenterIfOutsideViewport(selection.endLineNumber);
    // Force a small scroll down to ensure the prompt is not cut off by the bottom edge
    setTimeout(() => {
      const top = ed.getScrollTop();
      ed.setScrollTop(top + 80);
    }, 50);
  }, [cleanupInlineSession, inlineZoneNode]);

  useEffect(() => {
    if (!inlineZoneNode || inlineZoneIdRef.current === null) return;
    const ed = editorRef.current;
    if (!ed) return;

    const observer = new ResizeObserver(() => {
      const portalRoot = inlineZoneNode.querySelector(".inline-vibe-portal-root") as HTMLElement;
      if (!portalRoot) return;
      const contentHeight = portalRoot.scrollHeight;
      const targetHeightInPx = Math.max(40, contentHeight + 16);

      const descriptor = inlineZoneDescriptorRef.current;
      if (descriptor && descriptor.heightInPx !== targetHeightInPx) {
        descriptor.heightInPx = targetHeightInPx;
        ed.changeViewZones((accessor) => {
          if (inlineZoneIdRef.current !== null) {
            accessor.layoutZone(inlineZoneIdRef.current);
          }
        });
      }
    });

    const portalRoot = inlineZoneNode.querySelector(".inline-vibe-portal-root");
    if (portalRoot) observer.observe(portalRoot);
    observer.observe(inlineZoneNode);

    return () => observer.disconnect();
  }, [inlineZoneNode, inlineLoading, hasInlineDiff]);

  const triggerRef = useRef(handleTriggerInlineVibe);
  triggerRef.current = handleTriggerInlineVibe;

  const handleAcceptRef = useRef(handleAcceptInlineChanges);
  handleAcceptRef.current = handleAcceptInlineChanges;

  const handleRejectRef = useRef(handleRejectInlineChanges);
  handleRejectRef.current = handleRejectInlineChanges;

  const handleNavDiffRef = useRef(handleNavDiff);
  handleNavDiffRef.current = handleNavDiff;

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

  // Load content from disk when path changes (with instant cache switching)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      cleanupInlineSession();
      const cached = MODEL_CACHE.get(path);

      // Instant in-memory tab switch if model is already cached
      if (cached) {
        setContent(cached.model.getValue());
        setOriginal(cached.originalContent);
        const ed = editorRef.current;
        if (ed && ed.getModel() !== cached.model) {
          ed.setModel(cached.model);
        }
      }

      const res = await window.vibe.fs.read(path);
      if (cancelled) return;

      if (!res.ok) {
        if (!cached) setError(res.error);
        return;
      }

      const m = monacoInstanceRef.current;
      const uriStr = "file://" + path.replace(/\\/g, "/");
      let model = m
        ? m.editor.getModel(m.Uri.parse(uriStr)) || m.editor.getModel(m.Uri.file(path.replace(/\\/g, "/")))
        : null;

      if (m && !model) {
        try {
          model = m.editor.createModel(res.content, getLanguage(path), m.Uri.file(path.replace(/\\/g, "/")));
        } catch {
          model = m.editor.getModel(m.Uri.file(path.replace(/\\/g, "/")));
        }
      }

      if (model) {
        MODEL_CACHE.set(path, { model, originalContent: res.content });
        const ed = editorRef.current;
        if (ed && ed.getModel() !== model) {
          ed.setModel(model);
        }
      }

      if (!cached) {
        setContent(res.content);
        setOriginal(res.content);
      } else {
        // If cached and user hasn't modified it, sync if disk content changed
        if (cached.model.getValue() === cached.originalContent && cached.originalContent !== res.content) {
          cached.originalContent = res.content;
          cached.model.setValue(res.content);
          setContent(res.content);
          setOriginal(res.content);
        }
      }

      // Preload type definitions and local imports asynchronously (non-blocking)
      if (m && cwd) {
        void loadTypeDefinitions(m, cwd);
        void preloadLocalImports(m, res.content, path);
      }
      scg2Tracker.updateActivePath(path);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [path, cwd]);

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
        lspSessionRef.current?.didSave();
      }
    } catch (e: any) {
      setSaving(false);
      setError(e.message || "Failed to save file");
    }
  }, [content, dirty, path, saving, updateCacheOriginal]);

  // Ctrl/Cmd+S
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "s" || e.code === "KeyS")) {
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
        value={inlineLoading ? undefined : content}
        loading={<div className="editor" />}
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

          // Inline Vibe keyboard shortcuts
          ed.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyK, () => {
            triggerRef.current();
          });
          ed.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter, () => {
            if (inlineSessionRef.current) handleAcceptRef.current();
          });
          ed.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Backspace, () => {
            if (inlineSessionRef.current) handleRejectRef.current();
          });
          ed.addCommand(m.KeyCode.Escape, () => {
            if (inlineSessionRef.current) handleRejectRef.current();
          });
          ed.addCommand(m.KeyMod.Alt | m.KeyCode.KeyK, () => {
            if (inlineSessionRef.current) handleNavDiffRef.current("next");
          });
          ed.addCommand(m.KeyMod.Alt | m.KeyCode.KeyJ, () => {
            if (inlineSessionRef.current) handleNavDiffRef.current("prev");
          });

          // Layer 2: DOM capture-phase listener on the editor's own DOM node
          const handleInlineVibeKeyDown = (be: KeyboardEvent) => {
            const ctrl = be.ctrlKey || be.metaKey;

            // Ctrl+K — open / focus Inline Vibe (supports English & Russian layout)
            if (ctrl && (be.code === "KeyK" || be.key?.toLowerCase() === "k" || be.key?.toLowerCase() === "л")) {
              be.preventDefault();
              be.stopPropagation();
              be.stopImmediatePropagation();
              triggerRef.current();
              return;
            }

            // Session-only shortcuts
            if (!inlineSessionRef.current) return;

            if (ctrl && be.code === "Enter") {
              be.preventDefault();
              be.stopPropagation();
              be.stopImmediatePropagation();
              handleAcceptRef.current();
            } else if (ctrl && be.code === "Backspace") {
              be.preventDefault();
              be.stopPropagation();
              be.stopImmediatePropagation();
              handleRejectRef.current();
            } else if (be.code === "Escape") {
              be.preventDefault();
              be.stopPropagation();
              be.stopImmediatePropagation();
              handleRejectRef.current();
            } else if (be.altKey && be.code === "KeyK") {
              be.preventDefault();
              be.stopPropagation();
              be.stopImmediatePropagation();
              handleNavDiffRef.current("next");
            } else if (be.altKey && be.code === "KeyJ") {
              be.preventDefault();
              be.stopPropagation();
              be.stopImmediatePropagation();
              handleNavDiffRef.current("prev");
            }
          };

          const editorDomNode = ed.getDomNode();
          if (editorDomNode) {
            editorDomNode.addEventListener("keydown", handleInlineVibeKeyDown, true);
          }

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
            const uri = m.Uri.file(path.replace(/\\/g, "/"));
            let model = m.editor.getModel(uri);
            if (!model && content !== null) {
              model = m.editor.createModel(content, getLanguage(path), uri);
            }
            if (model) {
              ed.setModel(model);
              MODEL_CACHE.set(path, { model, originalContent: original });
            }

            if (cwd) {
              void loadTypeDefinitions(m, cwd);
            }
            if (content !== null) {
              void preloadLocalImports(m, content, path);
            }

            scg2Tracker.attach(ed, path, m);

            ed.onDidChangeModelContent(() => {
              if (!inlineLoadingRef.current) {
                setContent(ed.getValue());
              }
              updateGhostTextRef.current();
            });

            ed.onDidChangeCursorPosition(() => {
              updateGhostTextRef.current();
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

            setTimeout(() => {
              updateGhostTextRef.current();
            }, 50);
          } catch (e) {
            console.error("Error mounting editor:", e);
          }
        }}
        options={{
          fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
          fontSize: editorOptions.fontSize,
          lineHeight: editorOptions.lineHeight,
          fontLigatures: editorOptions.fontLigatures,
          cursorStyle: editorOptions.cursorStyle,
          cursorBlinking: editorOptions.cursorBlinking,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderLineHighlight: "line",
          smoothScrolling: true,
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
      {inlineZoneNode &&
        ReactDOM.createPortal(
          <div className="inline-vibe-portal-root">
            {hasInlineDiff && (
              <InlineActionPill
                onAccept={handleAcceptInlineChanges}
                onReject={handleRejectInlineChanges}
                onNextDiff={() => handleNavDiff("next")}
                onPrevDiff={() => handleNavDiff("prev")}
              />
            )}
            <InlinePromptPanel
              onSend={handleSendPrompt}
              onClose={cleanupInlineSession}
              loading={inlineLoading}
              placeholder={hasInlineDiff ? t("inlineRefineCode") : t("inlineEditCode")}
            />
          </div>,
          inlineZoneNode,
        )}
      {inlineZoneNode && inlineSessionRef.current && (
        <InlineVibeConnector
          editor={editorRef.current}
          monacoInstance={monacoInstanceRef.current}
          session={inlineSessionRef.current}
          zoneNode={inlineZoneNode}
          hasDiff={hasInlineDiff}
          loading={inlineLoading}
        />
      )}
    </div>
  );
}

interface InlineVibeConnectorProps {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  monacoInstance: typeof monaco | null;
  session: { startLine: number; endLine: number } | null;
  zoneNode: HTMLDivElement | null;
  hasDiff: boolean;
  loading: boolean;
}

function InlineVibeConnector({
  editor,
  monacoInstance,
  session,
  zoneNode,
  hasDiff,
  loading,
}: InlineVibeConnectorProps) {
  const [coords, setCoords] = useState<{
    startX: number;
    startY: number;
    boxX: number;
    boxY: number;
  } | null>(null);

  useEffect(() => {
    if (!editor || !monacoInstance || !session || !zoneNode) {
      setCoords(null);
      return;
    }

    let animFrameId: number | null = null;

    const update = () => {
      if (!editor || !zoneNode || !session) {
        setCoords(null);
        return;
      }

      const editorDomNode = editor.getDomNode();
      if (!editorDomNode) {
        setCoords(null);
        return;
      }

      const editorRect = editorDomNode.getBoundingClientRect();
      const layoutInfo = editor.getLayoutInfo();

      const targetEl =
        (zoneNode.querySelector(".inline-vibe-action-pill") as HTMLElement) ||
        (zoneNode.querySelector(".inline-vibe-input-wrapper") as HTMLElement);

      if (!targetEl) {
        setCoords(null);
        return;
      }

      const targetRect = targetEl.getBoundingClientRect();
      if (targetRect.width === 0 || targetRect.height === 0) {
        setCoords(null);
        return;
      }

      const boxX = targetRect.left - editorRect.left;
      const boxY = targetRect.top - editorRect.top + Math.min(17, targetRect.height / 2);

      const lineNumStr = String(session.endLine);
      const digitEl = Array.from(editorDomNode.querySelectorAll(".line-numbers")).find(
        (el) => el.textContent?.trim() === lineNumStr,
      );

      const lineHeight = editor.getOption(monacoInstance.editor.EditorOption.lineHeight);
      const getLineBottomY = (lineNum: number): number => {
        const pos = editor.getScrolledVisiblePosition({ lineNumber: lineNum, column: 1 });
        if (pos) {
          return pos.top + pos.height;
        }
        const top = editor.getTopForLineNumber(lineNum) - editor.getScrollTop();
        return top + lineHeight;
      };

      let startX: number;
      let startY: number;

      if (digitEl) {
        const digitRect = digitEl.getBoundingClientRect();
        let exactCenter = digitRect.left - editorRect.left + digitRect.width / 2;

        try {
          const range = document.createRange();
          range.selectNodeContents(digitEl);
          const textRect = range.getBoundingClientRect();
          if (textRect && textRect.width > 0 && textRect.width < digitRect.width * 0.9) {
            exactCenter = textRect.left - editorRect.left + textRect.width / 2;
          } else {
            const numDigits = lineNumStr.length;
            const charWidth = 8;
            const rightPadding = 5;
            exactCenter = digitRect.right - editorRect.left - rightPadding - (numDigits * charWidth) / 2;
          }
        } catch (_e) {
          const numDigits = lineNumStr.length;
          const charWidth = 8;
          const rightPadding = 5;
          exactCenter = digitRect.right - editorRect.left - rightPadding - (numDigits * charWidth) / 2;
        }

        startX = exactCenter;
        startY = digitRect.bottom - editorRect.top;
      } else {
        const numDigits = lineNumStr.length;
        const rightEdge = layoutInfo.lineNumbersLeft + layoutInfo.lineNumbersWidth - 5;
        const charWidth = 8;
        startX = rightEdge - (numDigits * charWidth) / 2;
        startY = getLineBottomY(session.endLine);
      }

      setCoords((prev) => {
        if (
          prev &&
          Math.abs(prev.startX - startX) < 0.5 &&
          Math.abs(prev.startY - startY) < 0.5 &&
          Math.abs(prev.boxX - boxX) < 0.5 &&
          Math.abs(prev.boxY - boxY) < 0.5
        ) {
          return prev;
        }
        return { startX, startY, boxX, boxY };
      });
    };

    update();

    const scrollDisposable = editor.onDidScrollChange(() => update());
    const layoutDisposable = editor.onDidLayoutChange(() => update());
    const contentDisposable = editor.onDidChangeModelContent(() => update());

    const resizeObserver = new ResizeObserver(() => {
      update();
    });
    resizeObserver.observe(zoneNode);
    const portalRoot = zoneNode.querySelector(".inline-vibe-portal-root");
    if (portalRoot) resizeObserver.observe(portalRoot);
    const textarea = zoneNode.querySelector("textarea");
    if (textarea) resizeObserver.observe(textarea);

    let frameCount = 0;
    const loop = () => {
      update();
      if (frameCount < 30) {
        frameCount++;
        animFrameId = requestAnimationFrame(loop);
      }
    };
    animFrameId = requestAnimationFrame(loop);

    return () => {
      scrollDisposable.dispose();
      layoutDisposable.dispose();
      contentDisposable.dispose();
      resizeObserver.disconnect();
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);
    };
  }, [editor, monacoInstance, session, zoneNode, hasDiff, loading]);

  if (!coords) return null;

  const { startX, startY, boxX, boxY } = coords;
  const dropDistance = Math.max(10, boxY - startY);
  const cp1Y = startY + dropDistance * 0.82;
  const turnRadius = Math.min(24, Math.max(12, (boxX - startX) * 0.35));
  const cp2X = boxX - turnRadius;

  const pathD = `M ${startX} ${startY} C ${startX} ${cp1Y}, ${cp2X} ${boxY}, ${boxX} ${boxY}`;

  return (
    <svg className="inline-vibe-connector-svg">
      <path
        d={pathD}
        className={`inline-vibe-connector-path ${loading ? "inline-vibe-connector-path--loading" : ""}`}
      />
    </svg>
  );
}
