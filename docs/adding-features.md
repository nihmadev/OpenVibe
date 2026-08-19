# Adding new features

This guide turns the architecture rules into implementation steps. Examples are abbreviated but follow current OpenVibe boundaries.

## Choose the location first

| Change | Location |
| --- | --- |
| Pure reusable helper without DOM | `src/base/common` |
| Reusable UI primitive | `src/base/browser/ui` or `packages/zazaru-ui` |
| Shared configuration, theme, i18n, keybinding, native adapter | `src/platform` |
| Visible product feature | `src/workbench/contrib/<feature>` |
| Capability shared by multiple features | `src/workbench/services/<domain>` |
| Domain or native logic | focused crate in `crates/<domain>` |
| IPC adapter | `src-tauri/src/commands/<domain>.rs` |
| Optional upstream proxy | `api/` |

Within a feature or service:

- `common` contains contracts, serializable payloads, and pure logic;
- `browser` contains React, DOM, and renderer state;
- `tauri` contains typed `invoke` calls and native event bridges;
- `data` contains static or generated catalogs.

## Example 1: renderer-only feature

Task: add an “Errors only” filter to an existing diagnostics view. The data already lives in the renderer, so no Tauri command is needed.

### 1. Add a pure model

```ts
// src/workbench/contrib/diagnostics/common/diagnosticsFilter.ts
export type DiagnosticFilter = "all" | "errors";

export function filterDiagnostics(items: Diagnostic[], filter: DiagnosticFilter): Diagnostic[] {
  return filter === "errors" ? items.filter((item) => item.severity === "error") : items;
}
```

Add `diagnosticsFilter.test.ts` beside it. Cover an empty list, mixed severity, and stable ordering.

### 2. Add the view control

Use a native toggle button with programmatic state:

```tsx
<button
  type="button"
  aria-pressed={filter === "errors"}
  onClick={() => setFilter(filter === "errors" ? "all" : "errors")}
>
  {t("diagnosticsOnlyErrors")}
</button>
```

Keep state local if no other view consumes it and it does not need restoration. If it must survive restart, use the platform key-value contract rather than direct `localStorage` in the feature.

### 3. Complete the slice

- add the i18n key;
- use tokens for selected and focus states;
- test accessible name and `aria-pressed`;
- distinguish “No errors” from “No diagnostics available.”

## Example 2: React → Tauri → Rust

Task: expose workspace diagnostics calculated by the native host.

### 1. Define the contract

```ts
// src/workbench/services/diagnostics/common/diagnostics.ts
export interface WorkspaceDiagnostic {
  path: string;
  line: number;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface DiagnosticsService {
  list(cwd: string): Promise<WorkspaceDiagnostic[]>;
}
```

Payloads must be JSON-compatible. Agree on field casing in Rust and TypeScript; never hide a mismatch with a cast.

### 2. Implement the domain in a crate

If the logic belongs to LSP, extend `crates/lsp`. If it is an independent capability, justify a focused crate. The domain owns collection, normalization, limits, and tests. It does not import Tauri.

```rust
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDiagnostic {
    pub path: String,
    pub line: u32,
    pub severity: Severity,
    pub message: String,
}
```

Test invalid paths, cancellation or timeout, empty results, and partial upstream failure.

### 3. Add a thin Tauri command

```rust
// src-tauri/src/commands/diagnostics.rs
#[tauri::command]
pub async fn diagnostics_list(
    state: tauri::State<'_, AppState>,
    cwd: String,
) -> Result<Vec<WorkspaceDiagnostic>, String> {
    state.diagnostics.list(&cwd).await.map_err(|error| error.to_string())
}
```

The command reads state, adapts payload/error, and calls the capability owner. File traversal, caching, and policy do not belong in the handler.

Then:

1. export the module from `src-tauri/src/commands/mod.rs`;
2. add the command to `tauri::generate_handler!` in `src-tauri/src/lib.rs`;
3. create a new manager once in `AppState` if needed;
4. review Tauri capabilities without widening permission beyond the operation.

### 4. Create the typed adapter

```ts
// src/workbench/services/diagnostics/tauri/diagnosticsService.ts
import { invoke } from "@tauri-apps/api/core";
import type { DiagnosticsService, WorkspaceDiagnostic } from "../common/diagnostics";

export const diagnosticsService: DiagnosticsService = {
  list: (cwd) => invoke<WorkspaceDiagnostic[]>("diagnostics_list", { cwd }),
};
```

React components do not call `invoke` directly. The adapter allows browser preview and tests to replace the runtime.

### 5. Add the contribution

```text
src/workbench/contrib/diagnostics/
├── common/
│   └── diagnostics.ts
└── browser/
    ├── diagnosticsView.tsx
    ├── diagnosticsView.css
    └── diagnosticsView.test.tsx
```

The view obtains data through a service or hook and explicitly renders:

- loading with `aria-busy`;
- empty state;
- a list with accessible severity and file navigation;
- error with retry;
- stale or partial data when applicable.

### 6. Compose at the edge

If the feature belongs in the shell, extend `WorkbenchContributions`, accept the component through props, and register the concrete implementation in `src/openvibe.desktop.main.tsx`.

Do not import a concrete feature view into `base`, `platform`, or a reusable shell primitive. The composition root is where implementations meet contracts.

### 7. Events and streaming

When the native side emits updates:

- define a serializable event type in `common`;
- let the Tauri bridge listen and normalize it;
- expose subscribe/unsubscribe from the browser service;
- register the listener once and guarantee cleanup;
- treat the stream as a projection, not the only store of authoritative state.

Follow the existing namespace, for example `vibe:diagnostics:changed`.

## Example 3: adding a setting

A form component must not directly mutate global CSS or configuration.

1. Add type, default, and validation to the platform configuration contract.
2. Add a storage migration if the persisted format changes.
3. Create one hook or service that applies the value.
4. Add the control to the preferences contribution.
5. Localize label, description, and error.
6. Test keyboard use, reset-to-default, and startup with an old value.

If the setting belongs only to one product feature, its contract may live in `workbench/services/<domain>` instead.

## Data migrations

- Version persisted shapes or make legacy decoding explicit.
- Make migrations idempotent.
- Do not remove old data until new data is written successfully.
- Test fresh install, current version, at least one supported old format, and corrupt input.
- Document rollback limitations in the pull request.

## Feature checklist

- [ ] User contract and authoritative state owner are clear.
- [ ] The correct contribution, service, and crate boundaries are used.
- [ ] IPC is typed and the command remains thin.
- [ ] Views do not call `invoke` directly.
- [ ] Loading, empty, error, cancel, and retry are handled.
- [ ] User-facing text is localized.
- [ ] Existing design tokens, icons, and primitives are reused.
- [ ] Keyboard, focus, zoom, and reduced motion are checked.
- [ ] Pure/domain logic and regressions have tests.
- [ ] Path, URL, credential, and permission boundaries are validated.
- [ ] Listeners and processes clean up on view or app shutdown.
- [ ] Documentation and changelog are updated.
