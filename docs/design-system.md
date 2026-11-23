# MovSat OS Design System

The shared visual foundation for MovSat OS lives in `src/index.css`, `src/lib/theme.ts`, and `tailwind.config.js`. Existing module-specific layouts and business behavior are intentionally unchanged; migrate modules incrementally rather than redesigning them together.

## Brand and tokens

The institutional palette uses MovSat red for primary actions, supported by neutral white, slate, and near-black surfaces. Semantic colors communicate success, warning, danger, and information; never use color alone to convey status.

CSS custom properties prefixed with `--ms-` are the source of truth for semantic color, control and panel radii, focus rings, and panel elevation. They are defined for both light and dark themes. Tailwind exposes the frequently used semantic colors under `movsat-*`; the existing `primary-*` scale remains available for compatibility.

Typography uses Inter with system sans-serif fallbacks. Use the existing Tailwind type scale and weights consistently: body copy at `text-sm`/`text-base`, labels and metadata at `text-xs`, and progressively stronger headings. Prefer spacing steps from Tailwind's default spacing scale; use the shared control and panel radii rather than introducing one-off shapes.

## Themes and interaction

`useTheme()` resolves a valid saved `movsat-theme` preference first, then the operating-system preference, and otherwise uses light mode. It synchronizes the `.dark` class and `data-theme` attribute on the document root and persists subsequent choices.

Use `:focus-visible` states for keyboard access, retain visible disabled states, and keep transitions short and limited to color/transform changes. Respect reduced-motion preferences when adding animated UI. Shared classes currently include `.card`, `.btn` variants, `.input`, `.select`, `.textarea`, `.label`, semantic `.badge-*` variants, and `.table-row`.

## Adoption roadmap

1. Apply shared button, form-control, and badge classes when editing module screens; avoid changing workflows or business rules as part of visual adoption.
2. Move module surfaces and text toward the `movsat-*` semantic tokens, removing conflicting light/dark utility pairs as each screen is touched.
3. Standardize modal, drawer, navigation, dropdown, table, notification, skeleton, empty, and error patterns in their shared components before migrating individual modules.
4. Verify keyboard focus, contrast in both themes, narrow-screen behavior, and loading/empty/error states for each adopted module.

Iconography should use the repository's existing icon library and consistent sizing/stroke; do not add a second icon dependency for this foundation.
