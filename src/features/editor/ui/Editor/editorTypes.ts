import type * as monaco from "monaco-editor";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

export interface EditorProps {
  path: string;
  cwd?: string;
  onDirtyChange?: (dirty: boolean) => void;
  /** @deprecated kept for backward compatibility, no longer used */
  onClose?: () => void;
  gotoLine?: number;
  gotoColumn?: number;
  gotoMatchLength?: number;
}

export interface EditorRefs {
  editor: MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>;
  monaco: MutableRefObject<typeof monaco | null>;
}

export interface InlineSession {
  startLine: number;
  endLine: number;
  originalText: string;
  selection: monaco.Selection;
}

export type SetContent = Dispatch<SetStateAction<string | null>>;
