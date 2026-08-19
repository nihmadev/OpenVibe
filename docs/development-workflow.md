# Development workflow

## 1. Prepare the environment

OpenVibe requires Node.js 18+, a stable Rust toolchain, and the Tauri system dependencies for your operating system.

```bash
npm install
npm run dev
```

Useful focused modes:

```bash
npm run dev:src       # Vite renderer
npm run dev:tauri     # desktop runtime
npm test -- --watch   # Vitest feedback loop
```

Do not commit generated `dist/`, local runtimes, credentials, `.env` files, or machine-specific settings.

## 2. Before writing code

Write a short feature contract:

- the user problem;
- entry point and expected outcome;
- loading, empty, partial, success, error, and cancellation states;
- owner of authoritative state;
- required filesystem, process, or network capabilities;
- keyboard and screen-reader behavior;
- behavior that can be verified by a test.

Then select a layer using the [architecture guide](architecture.md). Start from state ownership and capability boundaries, not a component or command name.

## 3. Branch and change scope

Use a small, clearly named branch such as `feat/diagnostics-panel` or `fix/chat-focus`. A pull request should represent one coherent reason for change.

Separate where practical:

- mechanical moves from behavior changes;
- refactoring from new functionality;
- accessibility correction from broad visual redesign when they cannot be reviewed as one unit.

Do not repair unrelated files “while here.” Use another issue or pull request.

## 4. Implement a vertical slice

Preferred order:

1. contracts and pure domain logic in `common`;
2. domain tests;
3. service contract and environment adapter;
4. Rust crate logic and tests when host support is required;
5. thin Tauri command and registration;
6. React orchestration and view;
7. localization, UI states, and accessibility;
8. integration and manual verification;
9. documentation and changelog for changed user behavior.

This order exposes boundary mistakes early and keeps views simple.

## 5. Code rules

### TypeScript and React

- Do not use `any` to bypass a contract. Fix the key, payload, or boundary type.
- Components render state and translate user intent into callbacks; IPC, persistence, and protocol logic belong in services.
- Compute derived state instead of synchronizing a second `useState`.
- Every effect has one reason to exist and correct cleanup.
- Subscriptions return an unsubscribe function; Tauri listeners use the existing lifecycle registry.
- User-facing text comes from `useI18n()`.
- CSS uses [design tokens](design-principles.md), and interactions follow the [accessibility guide](accessibility.md).

### Rust

- Domain and resource logic lives in the focused crate; `src-tauri/src/commands` adapts IPC.
- Errors preserve useful context without exposing secrets.
- Long-lived processes have one manager owner and explicit shutdown.
- Validate path, URL, and command input next to the capability.
- Do not run blocking work directly on an asynchronous executor.
- Keep public serialized payloads aligned with their TypeScript types.

### Go API

- The proxy does not become an owner of desktop state.
- Handle timeout, cancellation, and upstream status explicitly.
- Never log credential-bearing headers or bodies.
- Protocol changes remain backward compatible or include a documented migration.

## 6. Localization

1. Add the key and Russian fallback to `src/platform/localization/ru.ts`.
2. Add English to `en.ts` and update the other catalogs where possible.
3. Use parameters such as `{count}` and `{name}` instead of sentence concatenation.
4. Follow existing `_one` and `_few` plural forms.
5. Test a long translation, changed word order, and text scaling.

Fallback behavior is not a reason to add `as any` to new keys. If the catalog type rejects a key, update the type source.

## 7. Errors and observability

Errors travel through three levels:

- the domain returns a typed or contextual cause;
- the adapter translates it without losing useful context;
- the UI presents a clear recovery action.

Do not use an empty `.catch(() => {})` when users expect an outcome. Silent suppression is acceptable only for clearly best-effort cleanup or prewarming.

Logs must not contain API keys, authorization headers, full prompts, private file contents, or terminal environments.

## 8. Checks before a pull request

```bash
npm run check
npm test
cargo fmt --all -- --check
cargo clippy --workspace -- -D warnings
cargo test --workspace
```

For build or IPC changes, also run:

```bash
npm run build:src
cargo check --workspace
```

Check Go code from `api/` with `go test ./...` and `go vet ./...`.

Supplement automation with the manual scenarios in [testing and quality](testing-and-quality.md). Do not format the entire repository for a small pull request.

## 9. Pull requests

The description includes:

- problem and resulting behavior;
- solution boundaries and intentionally excluded work;
- screenshot or video for UI states;
- automated and manual checks performed;
- accessibility review;
- security and privacy impact;
- migration and rollback notes for persisted state or protocol changes.

Review the user workflow and risk first, then architecture and code detail. A happy path is insufficient: error, cancellation, retry, and restart recovery belong in review when applicable.

## Definition of done

- acceptance criteria are satisfied;
- the architecture checker passes;
- no new hardcoded UI strings or secrets exist;
- critical logic and regressions have tests;
- keyboard, focus, zoom, themes, and reduced motion are checked for UI work;
- cleanup and cancellation are checked for processes and streams;
- documentation and changelog are updated for public behavior changes;
- CI commands pass without new warnings.
