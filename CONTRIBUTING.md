# Contributing to OpenVibe

First off, thanks for taking the time to contribute!

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please check the existing issues to see if the problem has already been reported. If it hasn't, [open a new issue](.github/ISSUE_TEMPLATE/bug_report.md) using the bug report template.

### Suggesting Features

Open a [feature request](.github/ISSUE_TEMPLATE/feature_request.md) with a clear description of what you want and why.

### Pull Requests

1. Fork the repository.
2. Create a new branch: `git checkout -b feature/my-feature` or `fix/my-fix`.
3. Make your changes.
4. Run quality checks:
   ```bash
   npm run typecheck
   npm run lint
   npm run format:check
   npm test
   cargo clippy -- -D warnings   # in src-tauri/
   ```
5. Commit with a clear message (we use [Conventional Commits](https://www.conventionalcommits.org/)):
   - `feat: add new feature`
   - `fix: resolve issue with X`
   - `docs: update README`
   - `refactor: restructure Y`
   - `chore: update dependencies`
6. Push and open a PR against `main`.

## Development Setup

```bash
git clone https://github.com/nihmadev/OpenVibe
cd OPenVibe
npm install
npm run dev:tauri
```

### Project Structure

- `src/` — React + TypeScript frontend (Vite)
- `src-tauri/` — Rust backend (Tauri 2)
- `crates/` — Rust workspace crates (agent, config, search, terminal, chats, db)

### Code Style

- **Frontend:** Prettier with 120 print width, single quotes for JSX, no trailing commas.
- **Rust:** `rustfmt` with 120 max width, 4-space tabs, edition 2021.
- Run `npm run format` before committing.

## License

By contributing, you agree that your contributions will be licensed under the [OpenVibe License](LICENSE).
