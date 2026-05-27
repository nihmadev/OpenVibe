import { useCallback } from "react";

// Simple global state for the active terminal ID
let lastActiveTerminalId: string | null = null;

export function setActiveTerminalId(id: string | null) {
  lastActiveTerminalId = id;
}

export function getActiveTerminalId() {
  return lastActiveTerminalId;
}

export function useTerminalActions() {
  const runCommand = useCallback(async (command: string) => {
    const id = getActiveTerminalId();
    if (id) {
      await window.vibe.term.write(id, command + "\r");
      // Optional: switch to terminal tab or toggle it open
      // This would require more global state or event bus
      window.dispatchEvent(new CustomEvent("vibe:open-terminal"));
    } else {
      console.warn("No active terminal to run command");
    }
  }, []);

  const insertCommand = useCallback(async (command: string) => {
    const id = getActiveTerminalId();
    if (id) {
      await window.vibe.term.write(id, command);
      window.dispatchEvent(new CustomEvent("vibe:open-terminal"));
    } else {
      console.warn("No active terminal to insert command");
    }
  }, []);

  return { runCommand, insertCommand };
}
