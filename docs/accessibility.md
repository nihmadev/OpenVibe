# OpenVibe accessibility: WCAG 2.2 Level AA

## Target and scope

OpenVibe targets **WCAG 2.2 Level AA** across the renderer: onboarding, workbench, editor, chat, settings, panels, dialogs, and error states. Level AA includes every Level A and AA success criterion. Embedded Monaco, xterm.js, and isolated Chromium experiences are tested as part of complete workflows even when a third-party library creates part of the DOM.

This is an engineering target, not a certification claim. Public conformance claims require a complete audit across all states and supported platforms.

Normative reference: [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/). Practical checklist: [How to Meet WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/).

## Four principles

| Principle | Meaning in OpenVibe |
| --- | --- |
| Perceivable | Text and state are legible, images have alternatives, and color is not the only signal |
| Operable | Every workflow works from a keyboard, focus is visible, and there are no traps or essential complex gestures |
| Understandable | Names and order are predictable; errors explain recovery without losing input |
| Robust | Semantics, names, roles, and states reach platform accessibility APIs correctly |

## Implementation requirements

### Semantics and accessible names

- Use the native element for the native action: `<button>`, `<a>`, `<input>`, `<select>`.
- Every field has a persistent `<label>` or programmatic name. Placeholder text is only a format example.
- An icon button has a localized `aria-label`; a visible text button normally does not need one.
- Preserve a logical heading hierarchy. Use CSS, not an incorrect heading level, for visual size.
- Lists, tabs, menus, trees, and dialogs implement the complete ARIA pattern, preferably through an existing Radix primitive.
- Hide decorative SVGs with `aria-hidden="true"`; give informative graphics a text alternative.

```tsx
<button type="button" aria-label={t("closeTerminal")} onClick={onClose}>
  <CloseIcon aria-hidden="true" />
</button>
```

### Keyboard and focus

- Every action works without a mouse. Drag-and-drop has a button or keyboard alternative.
- Tab order follows visual and logical order. Positive `tabIndex` is prohibited.
- Enter and Space activate buttons; Escape closes temporary surfaces and returns focus to the trigger.
- A dialog contains focus only while open and restores it when closed.
- After deleting the focused item, move focus to a predictable neighbor or the region heading.
- Never suppress the global `:focus-visible` treatment without an equally visible, high-contrast replacement.
- A keyboard shortcut is never the only way to perform an action.
- Focus must not be fully hidden by sticky or overlapping content (WCAG 2.2 Focus Not Obscured).

### Contrast and color

Minimum contrast ratios:

- normal text: **4.5:1**;
- large text (at least 24 CSS px, or 18.66 px bold): **3:1**;
- meaningful control boundaries, states, focus indicators, and informative graphics: **3:1** against adjacent colors.

Test computed colors, including `opacity`, `color-mix`, hover, selected, light themes, and translucent backgrounds. Do not assume `--fg-muted` is suitable for every small label.

Success, warning, and error use text or icons in addition to green, yellow, or red.

### Target size and pointer input

- A standalone pointer target is at least **24 × 24 CSS px** unless a WCAG-defined exception applies.
- Prefer 32–44 px for frequent and destructive actions.
- Small SVGs do not reduce their enclosing button target.
- Do not complete an action on `pointerdown` when users need to cancel by moving away.
- Every complex gesture has a simple alternative. Resize handles must support keyboard control or an alternative size setting.

### Zoom, reflow, and text

- At **200% zoom**, primary content and controls remain available and do not overlap.
- Panels wrap, scroll, or adapt; truncated text has a way to expose its full value.
- User-selected UI font size and long translations do not break layout.
- Do not fix the height of controls that can contain multi-line messages.
- Horizontal scrolling is acceptable for code, terminals, and other two-dimensional content, but not as a requirement for ordinary forms.

### Motion, flashing, and timing

- Respect `prefers-reduced-motion` and the OpenVibe animation multiplier.
- Do not flash content more than three times per second.
- Time limits that risk data loss require warning and extension.
- Background agent activity must not unexpectedly steal focus.
- Indeterminate progress includes text such as “Connecting…”, not animation alone.

### Errors, status, and live updates

- Associate field errors with `aria-describedby` or `aria-errormessage`; set `aria-invalid="true"`.
- Explain the problem and recovery action while preserving entered data.
- Announce agent completion, stop, and failure through a carefully scoped `aria-live` region. Never place the entire token stream in it.
- Use `aria-live="polite"` for frequent status; reserve `assertive` for urgent information.
- Loading skeletons have a text status and contain no fake focus targets.

```tsx
<section aria-busy={loading} aria-labelledby="models-heading">
  <h2 id="models-heading">{t("models")}</h2>
  <p className="sr-only" aria-live="polite">
    {loading ? t("loadingModels") : statusMessage}
  </p>
  {/* content */}
</section>
```

## OpenVibe-specific guidance

### Editor and terminal

- Switching between chat, Monaco, and terminal works without a mouse.
- The active file and terminal tab have programmatically determinable names.
- Do not intercept system shortcuts unnecessarily; document conflicts and provide remapping.
- Diagnostics use text and severity in addition to visual underlines.

### Agent output and file changes

- Reasoning, tool calls, and results have distinct headings, not merely different colors.
- Long-running work can be stopped from the keyboard.
- Accept/reject controls identify the file and state; bulk actions state the number of objects.
- New messages do not move focus or prevent reading earlier content.

### Popovers, tooltips, and context menus

- Tooltips never contain the only critical information and appear on keyboard focus.
- Popovers close with Escape, have predictable Tab order, and restore trigger focus.
- Context menus have a keyboard opening mechanism where applicable.

## Verification

Automated tests help with roles, names, states, and keyboard events, but do not prove AA conformance. Prefer queries that match user perception:

```tsx
expect(screen.getByRole("button", { name: /stop/i })).toBeEnabled();
```

Do not use `data-testid` as the primary selector for interactive controls.

For every changed user-facing area, manually:

1. complete the flow with Tab, Shift+Tab, Enter, Space, arrows, and Escape;
2. check visible focus and focus restoration after dialogs/popovers;
3. check 200% zoom, a narrow window, and long translated text;
4. check dark/light themes and hover/focus/selected/error contrast;
5. enable reduced motion;
6. inspect accessible name, role, and state in the accessibility tree;
7. test the key flow with NVDA, VoiceOver, or Orca on at least one target platform.

Record significant accessibility review results in the pull request, including scenario, environment, known limitations, and follow-up issues.
