# @scribblesvg/react-utils

React components for diagram display and editing with a hand-drawn scribble style.

Part of [ScribbleSVG](https://github.com/Ashutoshbind15/ScribbleSVG). `DiagramCanvas` is the editor; `DiagramRenderer` draws a diagram as SVG. Both take a `DiagramDocument` from [@scribblesvg/core](../core).

## Install

```bash
# Using npm
npm install @scribblesvg/react-utils @scribblesvg/core

# Using pnpm
pnpm add @scribblesvg/react-utils @scribblesvg/core

# Using yarn
yarn add @scribblesvg/react-utils @scribblesvg/core

# Using bun
bun add @scribblesvg/react-utils @scribblesvg/core
```

Peer dependencies: React 18 or 19.

## DiagramRenderer

Read-only SVG output. Pass a `DiagramDocument`, get the diagram.

```tsx
import { DiagramRenderer } from "@scribblesvg/react-utils/renderer";
import type { DiagramDocument } from "@scribblesvg/core";

function Preview({ document }: { document: DiagramDocument }) {
  return (
    <DiagramRenderer
      document={document}
      colorPreset="inherit"
      className="max-w-full"
    />
  );
}
```

Color presets: `inherit` (follows `currentColor`), `light`, `dark`, and `darkBlue`. Override individual colors with the `colors` prop.

## DiagramCanvas

Interactive editor: pan, zoom, shapes, arrows, resize, text.

```tsx
import { useState } from "react";
import { DiagramCanvas } from "@scribblesvg/react-utils/editor";
import { EMPTY_DOCUMENT, type DiagramDocument } from "@scribblesvg/core";

function Editor() {
  const [document, setDocument] = useState<DiagramDocument>(EMPTY_DOCUMENT);

  return (
    <DiagramCanvas
      initialDocument={document}
      onChange={setDocument}
    />
  );
}
```

Use `onChange` to keep the document in sync (e.g. save to your backend).

## Subpath exports

| Import | Contents |
| --- | --- |
| `@scribblesvg/react-utils/renderer` | `DiagramRenderer`, color presets and helpers |
| `@scribblesvg/react-utils/editor` | `DiagramCanvas`, toolbar, hooks, hit-testing, and lower-level building blocks |
| `@scribblesvg/react-utils/colors` | `DiagramColors`, `resolveDiagramColors`, `DIAGRAM_COLOR_PRESETS` |

The editor entry also exports lower-level pieces if you want to build your own UI: `useCanvasReducer`, interaction hooks, coordinate utils, hit testing.

## License

MIT
