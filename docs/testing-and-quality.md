# Testing and quality control

## Principle

A test protects observable behavior at the lowest reasonable level. Test a pure function with a unit test, an adapter boundary with a contract or integration test, and a critical user journey with a component or desktop smoke test. Large snapshot suites do not replace behavioral assertions.

## Verification matrix

| Change | Minimum verification |
| --- | --- |
| Pure TypeScript logic | Vitest: normal, boundary, and invalid input |
| React view | Testing Library: role/name/state, keyboard, empty/error |
| CSS/layout | dark/light, 200% zoom, narrow panel, long text, focus |
| Typed Tauri adapter | payload name/shape and error propagation |
| Rust domain | unit/integration tests, invalid input, cleanup/cancel |
| Tauri command | state wiring, serialization, permission boundary |
| Stream/listener | ordering, duplicate registration, unsubscribe, reconnect |
| Persistence/migration | fresh, previous, corrupt/partial data, idempotency |
| Go proxy | `go test`, timeout, cancellation, upstream failure |
| Security-sensitive action | negative tests and manual approval-flow verification |

## Frontend

```bash
npm run check:architecture
npm run typecheck
npm run lint
npm run format:check
npm test
```

`npm run check` combines architecture, type checking, linting, and formatting. Tests run separately through `npm test`.

### Test style

- Arrange only the data the scenario needs.
- Act as one clear user intention.
- Assert the result and meaningful state, not hook implementation order.
- Name the condition and expected behavior.
- For a regression, first create a test that fails against the old behavior.

Prefer `getByRole` with an accessible name. Assert disabled, pressed, selected, busy, and invalid through semantics. Do not test a class name unless it is a public component contract.

## Rust workspace

```bash
cargo fmt --all -- --check
cargo clippy --workspace -- -D warnings
cargo test --workspace
cargo check --workspace
```

For resource managers, test start twice, stop before start, normal stop, child crash, and app shutdown. For filesystem and network code, test size limits, path policy, timeout, and cancellation.

## Builds

```bash
npm run build:src
npm run build:tauri
```

A full Tauri build is expensive and platform-dependent. It is mandatory before release and for changes to capabilities, bundling, native dependencies, updater, or host initialization. For an ordinary UI pull request, a renderer build plus CI is sufficient when the native boundary did not change.

## Manual smoke test

Record and run a short scenario for each user-facing feature:

1. clean start and feature entry;
2. happy path;
3. empty and invalid input;
4. upstream/native error and retry;
5. cancellation or closing during work;
6. reopen without duplicated listeners;
7. application restart and persisted-state restoration;
8. keyboard-only and accessibility pass;
9. dark/light theme and 200% zoom.

Check platform-specific behavior on the affected OS. Before release, cover Windows, macOS, and Linux through the CI/release matrix.

## Non-functional verification

### Performance

- Large chat and file trees should use existing virtualization rather than rendering every row.
- Batch token and event updates to avoid unnecessary full-workbench renders.
- Measure before optimizing and preserve readability.
- Loading in one region must not block unrelated regions.

### Reliability

- Repeated clicks do not duplicate irreversible operations.
- Abort stops host/upstream work, not merely the spinner.
- Failure does not discard the last valid projection without reason.
- Cleanup runs on unmount, workspace change, and shutdown.

### Accessibility

Automated checks do not replace the manual pass in [accessibility.md](accessibility.md). Pay particular attention to dialogs, menus, resize handles, virtualized lists, Monaco, xterm, and live agent output.

## CI and local differences

CI is the final guard, not the first place to discover type or lint errors. If local and CI results differ:

1. compare Node and Rust versions;
2. reinstall dependencies without changing the lockfile outside task scope;
3. run the exact failing CI command;
4. inspect platform-specific branches;
5. describe reproducible differences in the pull request.

Never weaken lint, clippy, or a test assertion merely to make CI green without preserving and explaining the original guarantee.
