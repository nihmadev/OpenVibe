import type * as monaco from "monaco-editor";
import { useCallback, useRef } from "react";
import { getLanguage } from "@/shared/icons/utils";
import type { ThemeVars } from "@/shared/themes/themes";
import { scg2Tracker } from "../../infrastructure/scg2Tracker";
import { makeMonacoTheme } from "../monacoThemes";
import { loadTypeDefinitions, MODEL_CACHE, preloadLocalImports } from "./editorModels";
import { attachAgentQuickFixClick, registerAgentQuickFix } from "./editorQuickFix";
import type { EditorRefs, InlineSession, SetContent } from "./editorTypes";
import { attachInlineVibeShortcuts } from "./inlineVibeShortcuts";

interface MountOptions {
  path: string;
  cwd?: string;
  content: string;
  original: string;
  gotoLine?: number;
  gotoColumn?: number;
  gotoMatchLength?: number;
  themeName: string;
  themeVars: ThemeVars;
  isDark: boolean;
  refs: EditorRefs;
  setContent: SetContent;
  loadingRef: React.MutableRefObject<boolean>;
  sessionRef: React.MutableRefObject<InlineSession | null>;
  updateGhostTextRef: React.MutableRefObject<() => void>;
  actions: {
    trigger: () => void;
    accept: () => void;
    reject: () => void;
    navigate: (direction: "next" | "prev") => void;
  };
}

export function useEditorMount(options: MountOptions) {
  const actionsRef = useRef(options.actions);
  actionsRef.current = options.actions;

  const beforeMount = useCallback(
    (m: typeof monaco) => {
      options.refs.monaco.current = m;
      m.editor.defineTheme(options.themeName, makeMonacoTheme(options.themeVars, options.isDark));
      if (options.cwd) void loadTypeDefinitions(m, options.cwd);
    },
    [options.cwd, options.isDark, options.refs, options.themeName, options.themeVars],
  );

  const onMount = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor, m: typeof monaco) => {
      options.refs.editor.current = editor;
      options.refs.monaco.current = m;
      attachInlineVibeShortcuts(editor, m, options.sessionRef, actionsRef);
      registerAgentQuickFix(m);
      attachAgentQuickFixClick(editor);

      try {
        const uri = m.Uri.file(options.path.replace(/\\/g, "/"));
        let model = m.editor.getModel(uri);
        if (!model) model = m.editor.createModel(options.content, getLanguage(options.path), uri);
        editor.setModel(model);
        MODEL_CACHE.set(options.path, { model, originalContent: options.original });
        if (options.cwd) void loadTypeDefinitions(m, options.cwd);
        void preloadLocalImports(m, options.content, options.path);
        scg2Tracker.attach(editor, options.path, m);

        editor.onDidChangeModelContent(() => {
          if (!options.loadingRef.current) options.setContent(editor.getValue());
          options.updateGhostTextRef.current();
        });
        editor.onDidChangeCursorPosition(() => options.updateGhostTextRef.current());

        if (options.gotoLine !== undefined) {
          const column = options.gotoColumn ?? 1;
          editor.revealLineInCenter(options.gotoLine);
          editor.setPosition({ lineNumber: options.gotoLine, column });
          if (options.gotoColumn !== undefined && options.gotoMatchLength !== undefined) {
            editor.setSelection(
              new m.Range(options.gotoLine, column, options.gotoLine, column + options.gotoMatchLength),
            );
          }
          editor.focus();
        }
        setTimeout(() => options.updateGhostTextRef.current(), 50);
      } catch (error) {
        console.error("Error mounting editor:", error);
      }
    },
    [options],
  );

  return { beforeMount, onMount };
}
