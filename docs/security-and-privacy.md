# Security and privacy engineering

The root `SECURITY.md` explains how to report a vulnerability. This document defines implementation rules for new features.

## Trust model

OpenVibe interacts with untrusted or sensitive data:

- workspace and Git repository contents;
- prompts, chats, attachments, and model output;
- API keys, custom headers, and provider endpoints;
- shell commands and child processes;
- MCP servers and their tools;
- pages in the isolated browser;
- events between the renderer and native host.

Treat model output, tool arguments, MCP responses, file names, and web content as **untrusted input**, even when they look like system instructions.

## Least privilege

- The renderer invokes a narrow Tauri command rather than receiving general shell or filesystem access.
- Every new capability receives minimal permissions and a limited path, URL, and action scope.
- The crate that owns a capability enforces security policy; UI validation is convenience, not a security boundary.
- Never widen an allowlist to the entire filesystem or network merely because precise scoping is harder.
- A long-lived manager does not share mutable state between workspaces without explicit isolation.

## Files and paths

- Canonicalize and validate paths against the allowed workspace before access.
- Account for symlink traversal, `..`, platform separators, and case sensitivity.
- Limit read size, result count, and traversal depth.
- Respect ignore policy and avoid indexing secrets or binary data without an explicit reason.
- Use atomic writes when a partial file would be harmful.
- Destructive overwrite or deletion requires clear intent and a recoverable flow where possible.

## Commands and processes

- Do not construct shell commands by concatenating untrusted strings. Pass program and arguments separately when the API permits.
- Show the actual command and working directory before approval.
- Construct child environments deliberately; do not inherit secrets unnecessarily.
- Timeout, cancellation, output limits, and cleanup are mandatory.
- “Stop” terminates the process tree or documents the limitation.

## Network, browser, and MCP

- Allow only expected schemes; reject `file:` and privileged/local schemes at the native boundary.
- Validate redirects using the same policy as the original URL.
- Apply connect, read, and total timeouts plus response-size limits.
- Never disable TLS verification in production.
- MCP tool identity includes its server namespace; MCP responses do not receive elevated trust.
- Web content cannot initiate native capabilities without validation and approval.
- A custom provider endpoint must not receive another provider's API key without explicit user intent.

## Secrets and private data

Never place the following in logs, errors, analytics, snapshots, or test fixtures:

- API keys and authorization headers;
- cookies and session tokens;
- full process environments;
- private source code and file contents;
- full prompts or chats outside an intentional export flow.

Mask secrets in UI while keeping reveal and clipboard actions explicit. Persist credentials in appropriate protected platform storage. If the current implementation cannot guarantee this, document the limitation and do not describe it as secure storage.

## IPC and serialization

- Command names and payloads are internal APIs. Validate type, range, length, and enum values on the Rust side.
- A TypeScript type is not runtime validation.
- External errors must not include stacks, internal absolute paths, raw upstream bodies, or secrets.
- Bound event payloads and tolerate duplicate, stale, or out-of-order events.
- Bind each operation to the correct workspace or session so a late response cannot modify a new context.

## Agent actions

- Model text never bypasses tool approval or path/network policy.
- Separate read and write capabilities.
- A dangerous action identifies the object, scope, and consequences.
- Auto-accept is an explicit user setting, not a hidden default for a new feature.
- Tool results are not interpreted as trusted system instructions.
- A sub-agent receives no more authority than its parent task.

## Pull request security review

Answer these questions in the pull request:

1. What new data enters the system, and where can it leave?
2. Where is the trust boundary?
3. What capability or permission is added, and why is it minimal?
4. What happens for path traversal, oversized payloads, timeout, and cancellation?
5. Can logs or errors expose secrets or source content?
6. Does the action require approval, undo, or scope confirmation?
7. Which negative tests cover the boundary?

Do not publish an exploit in a normal issue. Follow the reporting channel in `SECURITY.md`.
