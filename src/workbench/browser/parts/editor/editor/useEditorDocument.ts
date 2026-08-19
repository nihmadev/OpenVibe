import type * as monaco from "monaco-editor";
import { useCallback, useEffect, useRef, useState } from "react";
import { getLanguage } from "@/base/browser/ui/icons/iconResolver";
import { fileService } from "@/workbench/services/files/tauri/fileService";
import type { MonacoLspSession } from "../../../../services/languageServer/browser/monacoLanguageServerClient";
import type { EditorRefs } from "./editorState";
import { loadTypeDefinitions, MODEL_CACHE, preloadLocalImports } from "./monacoModels";

function isUsableModel(model: monaco.editor.ITextModel | null | undefined): model is monaco.editor.ITextModel {
  return !!model && !model.isDisposed();
}

interface DocumentOptions {
  path: string;
  cwd?: string;
  onDirtyChange?: (dirty: boolean) => void;
  cleanupInlineSession: () => void;
  refs: EditorRefs;
  lspSessionRef: React.MutableRefObject<MonacoLspSession | null>;
}

export function useEditorDocument({
  path,
  cwd,
  onDirtyChange,
  cleanupInlineSession,
  refs,
  lspSessionRef,
}: DocumentOptions) {
  const initialCached = MODEL_CACHE.get(path);
  const [content, setContent] = useState<string | null>(() =>
    isUsableModel(initialCached?.model) ? initialCached.model.getValue() : null,
  );
  const [original, setOriginal] = useState(() =>
    isUsableModel(initialCached?.model) ? (initialCached.originalContent ?? "") : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = content !== null && content !== original;

  useEffect(() => {
    MODEL_CACHE.pin(path);
    return () => MODEL_CACHE.unpin(path);
  }, [path]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      cleanupInlineSession();
      const cached = MODEL_CACHE.get(path);
      const cachedModel = isUsableModel(cached?.model) ? cached : undefined;
      if (cached && !cachedModel) MODEL_CACHE.delete(path);

      if (cachedModel) {
        setContent(cachedModel.model.getValue());
        setOriginal(cachedModel.originalContent);
        if (refs.editor.current && refs.editor.current.getModel() !== cachedModel.model) {
          refs.editor.current.setModel(cachedModel.model);
        }
      }

      const result = await fileService.read(path);
      if (cancelled) return;
      if (!result.ok) {
        if (!cachedModel) setError(result.error);
        return;
      }

      const m = refs.monaco.current;
      const uri = m?.Uri.file(path.replace(/\\/g, "/"));
      let model = uri ? m?.editor.getModel(uri) : null;
      if (m && uri && !model) {
        try {
          model = m.editor.createModel(result.content, getLanguage(path), uri);
        } catch {
          model = m.editor.getModel(uri);
        }
      }

      if (cancelled) return;
      if (isUsableModel(model)) {
        MODEL_CACHE.set(path, { model, originalContent: result.content, workspace: cwd });
        if (refs.editor.current && refs.editor.current.getModel() !== model) refs.editor.current.setModel(model);
      }

      if (!cachedModel) {
        setContent(result.content);
        setOriginal(result.content);
      } else if (
        isUsableModel(cachedModel.model) &&
        cachedModel.model.getValue() === cachedModel.originalContent &&
        cachedModel.originalContent !== result.content
      ) {
        cachedModel.originalContent = result.content;
        cachedModel.model.setValue(result.content);
        setContent(result.content);
        setOriginal(result.content);
      }

      if (m && cwd) {
        void loadTypeDefinitions(m, cwd);
        void preloadLocalImports(m, result.content, path, cwd);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [path, cwd, cleanupInlineSession, refs]);

  useEffect(() => {
    const handleAgentFileChanged = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== path) return;
      void fileService.read(path).then((result) => {
        if (!result.ok) return;
        const cached = MODEL_CACHE.get(path);
        if (cached && !isUsableModel(cached.model)) {
          MODEL_CACHE.delete(path);
          return;
        }
        if (cached && cached.model.getValue() !== cached.originalContent) return;
        if (cached && isUsableModel(cached.model)) {
          cached.originalContent = result.content;
          cached.model.setValue(result.content);
        }
        setContent(result.content);
        setOriginal(result.content);
      });
    };
    window.addEventListener("vibe:agent-file-changed", handleAgentFileChanged);
    return () => window.removeEventListener("vibe:agent-file-changed", handleAgentFileChanged);
  }, [path]);

  const previousDirty = useRef(false);
  useEffect(() => {
    if (previousDirty.current !== dirty) {
      previousDirty.current = dirty;
      onDirtyChange?.(dirty);
    }
  }, [dirty, onDirtyChange]);

  const save = useCallback(async () => {
    if (content === null || saving || !dirty) return;
    setSaving(true);
    try {
      const result = await fileService.write(path, content);
      if (!result.ok) setError(result.error);
      else {
        const cached = MODEL_CACHE.get(path);
        if (cached) cached.originalContent = content;
        setOriginal(content);
        lspSessionRef.current?.didSave();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to save file");
    } finally {
      setSaving(false);
    }
  }, [content, dirty, lspSessionRef, path, saving]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "s" || event.code === "KeyS")) {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [save]);

  const retry = useCallback(() => {
    setError(null);
    setContent(null);
  }, []);

  return { content, original, error, setContent, retry };
}

export function useEditorNavigation(
  refs: EditorRefs,
  gotoLine?: number,
  gotoColumn?: number,
  gotoMatchLength?: number,
): void {
  useEffect(() => {
    const editor = refs.editor.current;
    const m = refs.monaco.current;
    if (!editor || gotoLine === undefined) return;
    const column = gotoColumn ?? 1;
    editor.revealLineInCenter(gotoLine);
    editor.setPosition({ lineNumber: gotoLine, column });
    if (m && gotoColumn !== undefined && gotoMatchLength !== undefined) {
      editor.setSelection(new m.Range(gotoLine, column, gotoLine, column + gotoMatchLength));
    }
    editor.focus();
  }, [refs, gotoLine, gotoColumn, gotoMatchLength]);
}
