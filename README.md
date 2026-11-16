# ScribbleSVG

A lightweight, low-dependency SVG toolkit for basic diagrams and sketches with a hand-drawn scribble style.

## Packages

| Package | Description |
| --- | --- |
| **[@scribblesvg/core](https://github.com/Ashutoshbind15/ScribbleSVG/tree/main/packages/core)** | Diagram types, geometry, validation, and rendering primitives |
| **[@scribblesvg/react-utils](https://github.com/Ashutoshbind15/ScribbleSVG/tree/main/packages/react-utils)** | React components for display and editing |

## Canvas & renderer

`DiagramCanvas` is the interactive editor: pan, zoom, draw shapes, connect arrows, and edit text.

`DiagramRenderer` is a read-only view that turns the same document into SVG - useful anywhere you need to display a diagram without the editor chrome.

Both work from a serializable `DiagramDocument`. Save it as JSON, load it later, and the diagram renders the same way every time. Each shape carries a seed so its hand-drawn strokes stay consistent across sessions and surfaces.

## Documentation

Docs: [https://scribblesvg-docs.ashutoshbind.com/](https://scribblesvg-docs.ashutoshbind.com/)

Source lives in [`docs/`](./docs). To run locally:

```bash
pnpm --filter docs dev
```

Open [http://localhost:4000](http://localhost:4000).

## Parallel work with worktrees

Install [Worktrunk](https://worktrunk.dev/) and its shell integration (`wt config shell install`). Create a worktree with `wt switch --create <branch>`; add `--base @` to stack it on the current branch. The first use asks you to approve the project hooks. They install dependencies, build the shared packages, and start the site and playground on branch-specific ports.

Run `wt urls` to see all three URLs, `wt dev` to start the site and playground again, or `wt docs` to start the docs server. Run `wt remove` when finished; tethered servers stop with the worktree.

## License

MIT
