import { useEffect, useRef, useState } from "react";
import type { KeyCombo } from "@/platform/keybinding/browser/useKeybindings";
import { setRecording } from "@/platform/keybinding/browser/useKeybindings";

const MODIFIER_CODES = new Set([
  "ControlLeft",
  "ControlRight",
  "ShiftLeft",
  "ShiftRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
]);

export function useShortcutRecording(open: boolean, onUpdateBinding?: (id: string, combo: KeyCombo) => Promise<void>) {
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!open) {
      setRecordingId(null);
      setErrorMsg(null);
    }
  }, [open]);

  useEffect(() => {
    setRecording(recordingId);
  }, [recordingId]);

  useEffect(() => {
    if (!recordingId) return;
    function onKey(event: KeyboardEvent) {
      if (MODIFIER_CODES.has(event.code)) return;
      if (event.code === "Escape") {
        setRecordingId(null);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const combo: KeyCombo = {
        code: event.code,
        ctrl: event.ctrlKey || event.metaKey,
        shift: event.shiftKey,
        alt: event.altKey,
      };
      if (!onUpdateBinding || !recordingId) return;
      onUpdateBinding(recordingId, combo)
        .then(() => {
          setRecordingId(null);
          setErrorMsg(null);
        })
        .catch((error: Error) => {
          setRecordingId(null);
          setErrorMsg(error.message);
          if (errorTimer.current) clearTimeout(errorTimer.current);
          errorTimer.current = setTimeout(() => setErrorMsg(null), 3000);
        });
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recordingId, onUpdateBinding]);

  return { recordingId, setRecordingId, errorMsg, setErrorMsg };
}
