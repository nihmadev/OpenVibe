import { useEffect, useRef, useState } from "react";

// ZCode ToolLayout keeps per-tool open/closed state in a module-level map so
// the choice survives list re-renders and virtualized remounts, and collapses
// the block automatically once a running tool completes.

const toolOpenStates = new Map<string, boolean>();

export interface ToolDisclosureOptions {
  /** Tool currently executing (pending). */
  isRunning: boolean;
  /** Open (and keep open) while running, e.g. to show the streaming preview. */
  autoOpen?: boolean;
  /** ZCode autoCollapseOnComplete: close when isRunning goes true → false. */
  autoCollapseOnComplete?: boolean;
  /** Initial state when nothing is persisted yet. */
  defaultOpen?: boolean;
}

export function useToolDisclosure(toolId: string, options: ToolDisclosureOptions) {
  const { isRunning, autoOpen = false, autoCollapseOnComplete = false, defaultOpen = false } = options;
  const [open, setOpenState] = useState(() => toolOpenStates.get(toolId) ?? defaultOpen);
  const wasRunning = useRef(isRunning);

  // Re-read persisted state when the same component instance is reused for a
  // different tool id.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a tool identity change should restore persisted disclosure state
  useEffect(() => {
    setOpenState(toolOpenStates.get(toolId) ?? defaultOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId]);

  const setOpen = (value: boolean) => {
    toolOpenStates.set(toolId, value);
    setOpenState(value);
  };

  const toggle = () => setOpen(!open);

  // biome-ignore lint/correctness/useExhaustiveDependencies: this transition is intentionally driven only by running-state inputs
  useEffect(() => {
    if (autoOpen && isRunning && !open) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, isRunning]);

  useEffect(() => {
    if (autoCollapseOnComplete && wasRunning.current && !isRunning) {
      toolOpenStates.set(toolId, false);
      setOpenState(false);
    }
    wasRunning.current = isRunning;
  }, [autoCollapseOnComplete, isRunning, toolId]);

  return { open, setOpen, toggle };
}
