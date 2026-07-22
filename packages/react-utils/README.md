# @scribblesvg/react-utils

React components for diagram display and editing with a hand-drawn scribble style.

Part of [ScribbleSVG](https://github.com/Ashutoshbind15/ScribbleSVG). `DiagramCanvas` is the editor; `DiagramRenderer` draws a diagram as SVG. Both take a `DiagramDocument` from [@scribblesvg/core](https://github.com/Ashutoshbind15/ScribbleSVG/tree/main/packages/core).

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

`DiagramRenderer` outputs a single `<svg>`. Wrap and style it in your own markup. Diagram colors are set via `colors` / `colorPreset`. No CSS import required.

```tsx
import { DiagramRenderer } from "@scribblesvg/react-utils/renderer";
import type { DiagramDocument } from "@scribblesvg/core";
import type { DiagramIcon } from "@scribblesvg/react-utils/icons";

function Preview({
  document,
  icons,
}: {
  document: DiagramDocument;
  icons?: DiagramIcon[];
}) {
  return (
    <article className="my-site-card">
      <DiagramRenderer
        document={document}
        icons={icons}
        colors={{ stroke: "#111", text: "#111" }}
        className="w-full"
      />
    </article>
  );
}
```

Color presets: `inherit` (follows `currentColor`), `light`, `dark`, and `darkBlue`. Override individual colors with the `colors` prop.

## DiagramCanvas

Interactive editor: pan, zoom, shapes, arrows/lines, resize, text. Import the bundled CSS once in your CMS or admin app.

```tsx
import "@scribblesvg/react-utils/editor.css";
import { useState } from "react";
import { DiagramCanvas } from "@scribblesvg/react-utils/editor";
import type { DiagramIcon } from "@scribblesvg/react-utils/icons";
import { EMPTY_DOCUMENT, type DiagramDocument } from "@scribblesvg/core";

const icons: DiagramIcon[] = [
  {
    iconId: "server",
    label: "Server",
    svg: `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="6" /></svg>`,
  },
];

function Editor() {
  const [document, setDocument] = useState<DiagramDocument>(EMPTY_DOCUMENT);

  return (
    <div className="diagram-editor-panel">
      <DiagramCanvas
        initialDocument={document}
        onChange={setDocument}
        icons={icons}
      />
    </div>
  );
}
```

Documents store only `iconId` on icon elements. Pass the matching `icons` array to `DiagramCanvas` / `DiagramRenderer` so artwork can resolve. Unresolved ids render a dashed “Missing icon” placeholder.

Treat catalog SVG as trusted host input (your bundled pack or admin-curated markup). Diagram JSON cannot carry SVG, so normal save/load is not an XSS path; do not put end-user-uploaded SVG strings into `icons` without sanitizing first.

The editor fills its container (`height: 100%`). Give it a bounded height with your own class - on a wrapper or on `DiagramCanvas` via `className`:

```css
/* main.css */
.diagram-editor-panel {
  height: 600px;
}
```

```tsx
<div className="diagram-editor-panel">
  <DiagramCanvas onChange={save} />
</div>

<DiagramCanvas className="diagram-editor-panel" onChange={save} />
```

Use `onChange` to keep the document in sync (e.g. save to your backend).

## Subpath exports

| Import | Contents |
| --- | --- |
| `@scribblesvg/react-utils/editor.css` | Built-in styles for `DiagramCanvas` (toolbar, layout, controls) |
| `@scribblesvg/react-utils/renderer` | `DiagramRenderer`, color presets and helpers |
| `@scribblesvg/react-utils/editor` | `DiagramCanvas`, toolbar, hooks, hit-testing, and lower-level building blocks |
| `@scribblesvg/react-utils/icons` | `DiagramIcon`, `resolveDiagramIcon`, catalog helpers |
| `@scribblesvg/react-utils/colors` | `DiagramColors`, `resolveDiagramColors`, `DIAGRAM_COLOR_PRESETS` |

The editor entry also exports lower-level pieces if you want to build your own UI: `useCanvasReducer`, interaction hooks, coordinate utils, hit testing.

## License

MIT
