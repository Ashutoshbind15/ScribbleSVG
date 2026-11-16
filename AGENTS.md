# Agent notes

ScribbleSVG is a lightweight, low-dependency SVG diagramming library with a
hand-drawn look. Hosts embed it in their own pages; the first host is
VaryPane. It stays a diagramming library: shapes, arrows, text, icons, images
and freehand strokes on a pannable canvas. No whiteboard, collaboration or app
features.

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
  changes. Keep it working; don't remove or replace it.
- `docs/`: the Fumadocs site. Pages are `docs/content/docs/*.mdx`, including
  `changelog.mdx`.
- `tests/`: `node:test` unit tests for the pure modules.

## Always

- Size is a feature. Ask before adding a runtime dependency; Zod and
  lucide-react were removed to keep the packages small, and validation is hand
  written on purpose. Dev dependencies get exact versions (`pnpm add -E`).
- The editor runs inside other people's pages. Scope everything to one editor:
  shortcuts only fire while it has focus, new keys go in `keymap.ts`, no new
  `window` or `document` listeners for editor state, and CSS stays under
  `.scribblesvg-editor`.
- A document must render the same everywhere: keep it serializable, keep each
  element's `seed` stable, and validate anything from outside (load, paste,
  image `src`) in core.
- Before designing an interaction, check what tldraw and Excalidraw do and
  match it. Don't add behaviour nobody asked for; if you add an exception,
  name it in your reply.
- Extend the helper that exists instead of writing a copy per shape or per
  case. Keep special cases in one readable table or `switch`, with guards at
  the top, not spread across `if`s.
- When asked to discuss or write a spec, reply with it and wait for an explicit
  go. Split a scattered request into separately mergeable pieces and say how.
- Git: work in your own worktree off `main` (see below), one branch per PR.
  Each commit is one step that builds and typechecks. On a branch that already
  has a PR, push when you're done; review happens on GitHub.
- User-facing change: update the matching page in `docs/content/docs/` and add
  it under an "Unreleased" heading in `changelog.mdx`. Don't bump versions
  unless asked.
- Tests cover pure logic in `tests/*.test.ts`. Test behaviour, not constants or
  config.
- Comments are for public API contracts and browser quirks. Don't narrate what
  the code already says.
- Build and review by `PRINCIPLES.md`.

## Reporting back

- Lead with the outcome in a line or two. A page of explanation won't be read.
- After code changes, walk through the files in review order, then summarise
  the change in plain terms.
- Say what you ran and saw in the app, and what you didn't exercise.
- Open the change in a T3 preview tab, or give its port, so it can be tried.

## Worktrees and previews

Worktrunk gives each worktree its own ports, derived from the branch name, so
parallel agents don't collide.

- `wt switch --create <branch>` installs, builds the packages and starts the
  site and playground. In a worktree made any other way (T3, `git worktree
  add`), run `bash scripts/worktree/setup.sh` once, then start `wt dev` as a
  background command if you need the apps.
- `wt urls` prints the site, playground and docs URLs; `wt docs` starts the
  docs. Never `pnpm dev` or plain `vite`: they use shared default ports.
- If `wt` says the project's commands need approval, stop and ask the user to
  run `wt config approvals add`. Don't pass `--yes` yourself.
- Servers stay on localhost. Don't add `--host`, `host: true` or `0.0.0.0`.
- Open a preview with T3's `preview_open` and
  `target: { kind: "environment-port", port }`. It reaches localhost-only
  servers, and the user sees the tab in T3. Parallel subagents pass
  `reuseExistingTab: false` and use their own `tabId`.

## Checks

`pnpm test` and `pnpm typecheck`. Some tests load the packages' `dist`, which
`scripts/worktree/setup.sh` builds.

## E2E runs

Finish every editor change with a run in the real app, usually the playground.

- Open the playground port with `preview_open` (see above). Toolbar buttons
  have `aria-label`s (`button[aria-label=Rectangle]`) and `aria-pressed` marks
  the active tool; click them with `preview_act`. Keys work with
  `preview_act` press.
- Canvas gestures: from `preview_evaluate`, dispatch `PointerEvent`s at points
  on `svg.scribblesvg-editor__svg`, targeting `document.elementFromPoint`. A
  drag is `pointerdown`, a few `pointermove`s, then `pointerup`. Stub
  `Element.prototype.setPointerCapture` and `releasePointerCapture` first;
  they throw for synthetic pointers.
- Read state from the DOM: each element is `[data-element-id]` with
  `data-element-type`, the selection is `.selection-overlay`, and the
  playground's renderer pane is `[aria-label="Renderer"]`.
- Close your tab when done. Report that the run used synthetic pointer
  events, not a real mouse.
