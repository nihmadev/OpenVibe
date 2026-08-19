type NativeUnlistenFn = () => void;

let unlistenFns: NativeUnlistenFn[] = [];
let beforeUnloadCleanupRegistered = false;

/** Registers a native event unsubscriber for coordinated shutdown and HMR cleanup. */
export function addTauriUnlistenFn(fn: NativeUnlistenFn): void {
  unlistenFns.push(fn);
}

/** Releases every currently registered native listener exactly once. */
export function cleanupTauriListeners(): void {
  const pending = unlistenFns;
  unlistenFns = [];
  for (const unlisten of pending) {
    unlisten();
  }
}

/** Installs the browser lifecycle cleanup hook once for the current module instance. */
export function addBeforeUnloadCleanup(): void {
  if (beforeUnloadCleanupRegistered) return;
  beforeUnloadCleanupRegistered = true;
  window.addEventListener("beforeunload", cleanupTauriListeners);
}
