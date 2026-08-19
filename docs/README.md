# OpenVibe developer documentation

This directory is the source of truth for OpenVibe product and engineering conventions. It describes both how the code is organized and the criteria by which a change is considered ready.

## Start here

| Document | Read it when |
| --- | --- |
| [Strict design philosophy](design-principles.md) | Designing UI or changing the visual language |
| [Accessibility: WCAG 2.2 AA](accessibility.md) | Creating or reviewing any user-facing workflow |
| [Architecture](architecture.md) | Choosing a layer, module, or state owner |
| [Development workflow](development-workflow.md) | Starting a task or preparing a pull request |
| [Adding features](adding-features.md) | Implementing frontend-only or React → Tauri → Rust changes |
| [Testing and quality](testing-and-quality.md) | Planning verification and deciding whether work is done |
| [Security and privacy](security-and-privacy.md) | Working with files, processes, networks, credentials, or chat data |

## Priority order

When requirements conflict, decide in this order:

1. data safety and explicit user intent;
2. accessibility of the primary workflow;
3. correctness and state preservation;
4. architectural boundaries and maintainability;
5. visual discipline and interaction speed;
6. decorative expression.

A decorative improvement never justifies worse readability, keyboard access, or predictability.

## Maintaining these documents

- Update documentation in the same pull request that changes the corresponding rule, command, or boundary.
- Describe current behavior in the present tense. Future behavior belongs in an issue or a clearly marked proposal.
- Use relative links between files in `docs/` and repository-root paths when referring to code.
- Keep examples aligned with the actual layers: `base`, `platform`, `workbench`, `src-tauri`, and `crates`.
- Interpret normative words literally: **must** blocks merge; **should** requires an explanation when ignored; **may** describes an acceptable option.

## Short definition of done

A change is done when it lives in the correct layer, handles loading/empty/error/success states, works with a keyboard, does not rely on color alone, localizes user-facing text, tests critical logic, and passes the checks in the [quality guide](testing-and-quality.md).
