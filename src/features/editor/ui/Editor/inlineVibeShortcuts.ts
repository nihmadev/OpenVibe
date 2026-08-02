import type * as monaco from "monaco-editor";
import type { MutableRefObject } from "react";
import type { InlineSession } from "./editorTypes";

interface Actions {
  trigger: () => void;
  accept: () => void;
  reject: () => void;
  navigate: (direction: "next" | "prev") => void;
}

export function attachInlineVibeShortcuts(
  editor: monaco.editor.IStandaloneCodeEditor,
  m: typeof monaco,
  sessionRef: MutableRefObject<InlineSession | null>,
  actions: MutableRefObject<Actions>,
): void {
  editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyK, () => actions.current.trigger());
  editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter, () => sessionRef.current && actions.current.accept());
  editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Backspace, () => sessionRef.current && actions.current.reject());
  editor.addCommand(m.KeyCode.Escape, () => sessionRef.current && actions.current.reject());
  editor.addCommand(m.KeyMod.Alt | m.KeyCode.KeyK, () => sessionRef.current && actions.current.navigate("next"));
  editor.addCommand(m.KeyMod.Alt | m.KeyCode.KeyJ, () => sessionRef.current && actions.current.navigate("prev"));

  editor.getDomNode()?.addEventListener(
    "keydown",
    (event) => {
      const control = event.ctrlKey || event.metaKey;
      const stop = () => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      };
      if (control && (event.code === "KeyK" || event.key?.toLowerCase() === "k" || event.key?.toLowerCase() === "л")) {
        stop();
        actions.current.trigger();
        return;
      }
      if (!sessionRef.current) return;
      if (control && event.code === "Enter") {
        stop();
        actions.current.accept();
      } else if (control && event.code === "Backspace") {
        stop();
        actions.current.reject();
      } else if (event.code === "Escape") {
        stop();
        actions.current.reject();
      } else if (event.altKey && event.code === "KeyK") {
        stop();
        actions.current.navigate("next");
      } else if (event.altKey && event.code === "KeyJ") {
        stop();
        actions.current.navigate("prev");
      }
    },
    true,
  );
}
