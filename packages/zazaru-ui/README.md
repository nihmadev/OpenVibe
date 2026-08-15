# @zazaru/ui

Accessible React components for dense application interfaces. The package has no Tailwind, CSS-in-JS, framework, OpenVibe runtime, or global application-token requirement. React and React DOM are peers.

```sh
npm add @zazaru/ui
```

From JSR:

```sh
npx jsr add @zazaru/ui
```

JSR currently accepts JavaScript and TypeScript entry points only, so its export map contains the component API and `@zazaru/ui/recipes`. CSS assets are included in the published package, while the named CSS subpath exports listed below are provided by the npm-compatible package metadata.

```tsx
import { Button, Field, Label, Description, Input, Select } from "@zazaru/ui";
import "@zazaru/ui/styles.css";

export function Profile() {
  return (
    <Field>
      <Label>Display name</Label>
      <Description>Shown to collaborators.</Description>
      <Input />
      <Button variant="primary">Save</Button>
    </Field>
  );
}
```

`styles.css` contains tokens, the default dark theme, and component styles. For explicit composition, import `tokens.css`, one theme, then `styles.css`; a later theme import overrides the default values.

```tsx
import "@zazaru/ui/styles.css";
import "@zazaru/ui/themes/light.css";

<main data-z-theme="light" data-z-density="comfortable">…</main>
```

Themes: `dark`, `light`, `high-contrast`. Density: `compact`, `comfortable`. Class aliases (`z-theme-light`, `z-density-compact`) are also supported. All public custom properties begin with `--z-`. Tokens are split into:

- primitive: `--z-primitive-space-*`, radii, font sizes, durations and the three elevation levels;
- semantic: `--z-color-*`, `--z-space-*`, control heights, typography and focus;
- component: `--z-button-radius`, `--z-field-radius`, `--z-overlay-*`, `--z-list-row-height`.

The library honors `prefers-reduced-motion: reduce`. Focus uses the semantic `--z-color-focus` token, and interactive states use semantic colors rather than filters.

## API

- Foundation: `Box`, `Stack`, `Inline`, `Grid`, `Separator`, `Text`, `Heading`, `Code`, `Kbd`, `VisuallyHidden`, `Spinner`.
- Forms: `Field`, `Label`, `Description`, `FieldError`, `Input`, `Textarea`, `Checkbox`, `RadioGroup`, `SearchField`, `NumberInput`, `Select`, `Toggle`.
- Overlays: `Dialog`, `AlertDialog`, `Popover`, `Tooltip`, `DropdownMenu`, `ContextMenu`, `ToastProvider`, `useToast`.
- Navigation/application: `Tabs`, `Toolbar`, `CommandMenu`, `TreeView`, `SplitPane`.
- Feedback/data: `Badge`, `Callout`, `Progress`, `Skeleton`, `EmptyState`, `Table`.
- Existing list primitives: `List`, `ListGroup`, `ListItem`, `InteractiveList`, `Surface`.
- Application-oriented patterns: `@zazaru/ui/recipes`.

Select and overlays use one headless foundation—Radix UI—for focus restoration, collision-aware portals, typeahead and keyboard behavior. `Select` preserves input option order, supports disabled items and adjacent option groups, retains generic string/number values, and accepts `portalContainer`.

Icon-only buttons require `aria-label`. Toggle requires an accessible name through `label`, `aria-label`, or `aria-labelledby`. NumberInput preserves empty/intermediate/invalid strings and only normalizes when a step action is requested.

## Showcase

Ladle is the component-state catalogue. Finished product compositions live as independently buildable React applications in the repository-level `examples/` directory: `observatory` is a dark operational dashboard with responsive canvas charts, while `settings-lab` is a dense inspector that demonstrates validation and nested Select menus.

Run `npm run showcase` for component stories, or use `npm run example:observatory` and `npm run example:settings` from the repository root for the full applications.

## Development

```sh
npm run typecheck
npm test
npm run build
npm run test:package
npm run showcase
npm run showcase:build
npm run test:visual
```

See [MIGRATION.md](./MIGRATION.md) for 0.1 breaking changes.

## License

The package is distributed under `GPL-3.0-or-later` (GPLv3+).
