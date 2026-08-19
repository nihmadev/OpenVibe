# OpenVibe strict design philosophy

## Why strict design

OpenVibe is a working tool in which people spend long periods reading code, observing agent actions, and making decisions that affect files and processes. The interface must reduce cognitive noise and make system state obvious.

**Strict design** means discipline: every element has a purpose, every accent has a reason, and every state has a distinguishable representation. It does not reject beauty; beauty comes from proportion, typography, consistency, and precise feedback.

## Core principles

### 1. Content comes before chrome

Code, conversation, diffs, terminals, and results occupy the visual center. Application chrome stays quiet.

- Use one primary accent within a local area.
- Make secondary actions quieter than the primary action.
- Do not add nesting for decoration alone.
- Keep an element permanently visible only when it is permanently useful.

### 2. Build hierarchy with a limited vocabulary

Prefer, in order: position, spacing, weight, text tone, surface, then color. Do not amplify size, weight, color, shadow, and border simultaneously.

Use tokens from `src/platform/theme/globalStyles.css`:

- surfaces: `--surface-canvas`, `--surface-panel`, `--surface-raised`;
- text: `--fg`, `--fg-dim`, `--fg-muted`, and `--workspace-panel-text-*`;
- spacing: `--space-1` through `--space-13`;
- radii: `--radius-xs` through `--radius-2xl` and semantic radii;
- interaction: `--hover-*`, `--active-subtle`, `--selected-bg`;
- status: `--color-success`, `--color-warning`, `--color-error`, `--color-info`;
- motion: `--duration-*` and `--ease-*`.

Do not copy raw color, shadow, or spacing values into a component when a token already expresses the meaning. Add a global token only for a repeated semantic purpose, not a one-off pixel value.

### 3. Density is controlled, not cramped

OpenVibe supports compact panels, but density must not reduce target size, merge independent actions, or harm scanning.

- Group related elements by proximity and separate independent ones.
- Follow `--space-*`: 2 px for micro-adjustments, 4 px and above for composition.
- Use `--text-2xs` only for genuinely secondary metadata; never introduce smaller text.
- The interactive target may be larger than its visible icon.
- Preserve distinctions between similar file, model, and command names.

### 4. State is visible before and after an action

Design default, hover, focus-visible, active/pressed, selected, disabled, loading, and error states for every interactive control. Design loading, empty, partial, ready, and failure states for data containers.

Never communicate state by color alone. Pair it with text, an icon, shape, `aria-pressed`, `aria-selected`, progress, or a changed accessible name.

A destructive action:

- uses a concrete label such as “Delete chat,” not “Continue”;
- differs visibly from an ordinary confirmation;
- names the affected object and consequences;
- offers undo or confirmation when loss is irreversible;
- is not the default keyboard action without a strong reason.

### 5. Motion explains change

Animation may explain where a panel came from, connect states, or confirm completion. It must not delay input, conceal loading, or repeat without user action.

- Use `--duration-*` and the global animation multiplier.
- Respect `prefers-reduced-motion` and the disabled-animation setting.
- Avoid persistent blur or scale animation over large areas.
- Late content must not move an already available primary action.

### 6. Words are interface

Labels answer “what will happen?” Avoid implementation terms, exclamation marks, and marketing language inside working flows.

- Button: verb + object — “Open project,” “Stop task.”
- Heading: object or state — “Connected providers.”
- Error: what happened, what remains safe, and what to do next.
- A tooltip supplements a label; it does not replace an accessible name.
- All user-facing text goes through localization. Update Russian fallback, English, and other catalogs with the feature.

### 7. Native behavior beats imitation

Use semantic elements (`button`, `input`, `nav`, `dialog`) and accessible Radix primitives. A clickable `div` is acceptable only when native semantics cannot express the interaction, and then requires complete keyboard behavior.

## Workspace composition

- `surface-canvas` is the primary working plane.
- `surface-panel` is a persistent adjacent area.
- `surface-raised` is a temporary popover, menu, or dialog.
- A border marks an interaction boundary; it does not decorate every container.
- A shadow represents real overlap. Nested cards at the same elevation do not receive shadows.
- Radius comes from the global scale; do not turn every row into a pill.

## Icons

- Search `src/base/browser/ui/icons/iconRegistry` before adding an icon.
- An icon-only button must have a localized `aria-label`.
- A decorative icon uses `aria-hidden="true"`.
- Do not mix stroke weights within one panel.
- Do not use emoji as system icons; rendering varies by OS and assistive technology behavior is unpredictable.

## Anti-patterns

- a new local hex color instead of a semantic token;
- `outline: none` without an equivalent `:focus-visible` treatment;
- hover as the only way to discover an action;
- placeholder text used as a field label;
- a disabled button with no explanation of how to enable it;
- a modal for information that fits in context;
- an endless spinner with no status or cancellation;
- multiple competing primary buttons;
- reporting an error only to the console;
- showing irreversible success before the host confirms it.

## Design review

Before merge, the author and reviewer ask:

1. Can any element be removed without losing meaning or function?
2. Is the primary action clear without a tooltip?
3. Are focus, selection, disabled, and error states distinguishable?
4. Does it work at 200% zoom, with long translations, and in a narrow panel?
5. Does any state rely only on color or animation?
6. Does it reuse existing tokens, icons, and primitives?
7. Do primary actions remain stable through loading and error states?
8. Does the workflow meet the [WCAG 2.2 AA guide](accessibility.md)?
