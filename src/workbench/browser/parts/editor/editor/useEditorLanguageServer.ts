import { useEffect } from "react";
import {
  connectMonacoLsp,
  type MonacoLspSession,
} from "../../../../services/languageServer/browser/monacoLanguageServerClient";
import type { EditorRefs } from "./editorState";

export function useEditorLsp(
  refs: EditorRefs,
  sessionRef: React.MutableRefObject<MonacoLspSession | null>,
  isContentLoading: boolean,
  cwd?: string,
): void {
  useEffect(() => {
    if (isContentLoading || !cwd) return;
    const m = refs.monaco.current;
    const model = refs.editor.current?.getModel();
    if (!m || !model) return;

    let cancelled = false;
    let session: MonacoLspSession | null = null;
    void connectMonacoLsp(m, model, cwd)
      .then((result) => {
        if (cancelled) result?.dispose();
        else {
          session = result;
          sessionRef.current = result;
        }
      })
      .catch((error) => {
        const language = model.isDisposed() ? "unknown" : model.getLanguageId();
        console.error(`Failed to connect Monaco to LSP for ${language}:`, error);
      });

    return () => {
      cancelled = true;
      session?.dispose();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [isContentLoading, cwd, refs, sessionRef]);
}
