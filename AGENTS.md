# Agent notes

Build and review by [`PRINCIPLES.md`](PRINCIPLES.md).

ScribbleSVG is a lightweight, low-dependency SVG diagramming library with a
hand-drawn look, made to be embedded in other apps. It stays a diagramming
library: shapes, arrows, text, icons, images and freehand strokes on a
pannable canvas.

## Layout

- `packages/core` (`@scribblesvg/core`): the `DiagramDocument` model, geometry,
  validation and Rough.js rendering. Its only runtime dependency is `roughjs`.
- `packages/react-utils` (`@scribblesvg/react-utils`): the `DiagramCanvas`
  editor (`src/editor/`) and the read-only `DiagramRenderer`. Depends only on
  core; React is a peer dependency. Pointer gestures live in
  `useCanvasInteraction.ts`, what a click picks in `hit-test.ts`, and every
  keyboard shortcut in the `keymap.ts` table.
- `apps/site`: the public editor with SVG export.
- `apps/playground`: the editor and renderer side by side, for trying package
  changes.
- `docs/`: the Fumadocs site. Pages are `docs/content/docs/*.mdx`, including
  `changelog.mdx`.
- `tests/`: `node:test` unit tests for the pure modules.

## Always

- Size is a feature. Ask before adding a runtime dependency; validation is
  hand written on purpose. Dev dependencies get exact versions
  (`pnpm add -E`).
- A document must render the same everywhere: keep it serializable, keep each
  element's `seed` stable, and validate anything from outside (load, paste,
  image `src`) in core.
- Git: one branch per change, off `main`. For parallel work, use a Worktrunk
  worktree, which gets its own ports (see `scripts/worktree/README.md`). Each
  commit builds and typechecks on its own.
- User-facing change: update the matching page in `docs/content/docs/` and add
  it under an "Unreleased" heading in `changelog.mdx`. Versions are bumped at
  release.
- Tests cover pure logic in `tests/*.test.ts`. Test behaviour, not constants or
  config.
- Comments are for public API contracts and browser quirks. Don't narrate what
  the code already says.

## Running and checking

- `pnpm install`, then `pnpm build:packages` once: some tests load the
  packages' `dist`.
- `pnpm test` and `pnpm typecheck` before every commit.
- `pnpm dev` (site), `pnpm dev:playground` or `pnpm dev:docs`.
- If you can drive a browser, try editor changes in the playground before
  calling them done.

## Reporting back

- Lead with the outcome in a line or two.
- After code changes, walk through the files in review order, then summarise
  the change in plain terms.
- Say what you ran and saw in the app, and what you didn't exercise.
