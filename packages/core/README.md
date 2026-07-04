# @scribblesvg/core

Diagram types, geometry, validation, and SVG rendering primitives with a hand-drawn scribble style.

Part of [ScribbleSVG](https://github.com/Ashutoshbind15/ScribbleSVG). Use this package when you need the data model and rendering logic without React - for example, validating saved JSON on the server or generating SVG paths elsewhere.

## Install

```bash
# Using npm
npm install @scribblesvg/core

# Using pnpm
pnpm add @scribblesvg/core

# Using yarn
yarn add @scribblesvg/core

# Using bun
bun add @scribblesvg/core
```

## What's included

- **Types** : `DiagramDocument`, shape and arrow elements, viewport
- **Validation** : parse and type-check diagram JSON
- **Geometry** : bounds, connection points, anchors
- **Rendering** : SVG path data for scribble-style shapes
- **Constants & seeds** : empty document defaults and deterministic stroke seeds

Diagrams are serializable JSON. Each shape carries a seed so its hand-drawn strokes stay consistent across sessions and renderers.

For interactive editing and read-only display in React, see [@scribblesvg/react-utils](https://github.com/Ashutoshbind15/ScribbleSVG/tree/main/packages/react-utils).

## License

MIT