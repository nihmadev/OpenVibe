# Migration to @zazaru/ui 0.1

## Breaking changes

1. Import compiled assets from package exports. `package.json` no longer exposes `src` files.
2. Replace every unprefixed customization token (`--bg`, `--fg`, `--line`, `--accent`, `--space-*`, and similar) with a `--z-*` primitive, semantic, or component token. Application tokens are not read by the library.
3. Move `ControlRow` imports to `@zazaru/ui/recipes`. It now clones its single control child to connect label and description IDs.
4. `Surface` supports only `transparent`, `canvas`, `panel`, and `raised`. Application `composer` and `bubble` styling moved to `recipeSurfaceClassName` in `@zazaru/ui/recipes`.
5. `Select` no longer moves the selected option to the top. It uses listbox/option semantics, supports groups and disabled options, restores focus, flips at viewport boundaries, and accepts `portalContainer`. Its trigger role is `combobox`.
6. `IconButton` requires `aria-label`. `Button` defaults to `type="button"`; use `leadingIcon` and `trailingIcon` (`icon` remains deprecated for one transition release).
7. `NumberInput` is ref-forwarding and string-controlled. Invalid input is never coerced to zero. Its `onChange` receives the raw string and an optional native change event.
8. Collapsed `ListGroup` content uses `hidden`, so descendants leave the accessibility and tab trees. Headers expose `aria-controls`; active items use `aria-current="page"` unless explicitly overridden.
9. `SelectOption` may contain `children`. Hierarchical selects use accessible menu/submenu semantics (`menuitemradio`) instead of pretending that a tree is a flat ARIA listbox; ArrowRight/ArrowLeft, hover intent, collision handling and focus restoration are provided by Radix.

## OpenVibe adapter

OpenVibe maps its existing theme variables to semantic library tokens in `src/shared/themes/zazaru-ui.css`. Independent consumers should define the `--z-color-*` tokens directly or import a packaged theme.
