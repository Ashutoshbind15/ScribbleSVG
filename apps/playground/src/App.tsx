import { useState } from "react";
import { EMPTY_DOCUMENT, type DiagramDocument } from "@scribblesvg/core";
import { DiagramCanvas } from "@scribblesvg/react-utils/editor";
import { DiagramRenderer } from "@scribblesvg/react-utils/renderer";
import type { DiagramIcon } from "@scribblesvg/react-utils/icons";
import "@scribblesvg/react-utils/editor.css";
import "./styles.css";

/** Demo geometry icons for examples. */
const PLAYGROUND_ICONS: DiagramIcon[] = [
  {
    iconId: "box",
    label: "Box",
    defaultWidth: 72,
    defaultHeight: 72,
    svg: `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"/><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2"/><line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" stroke-width="2"/></svg>`,
  },
  {
    iconId: "wedge",
    label: "Wedge",
    defaultWidth: 72,
    defaultHeight: 64,
    svg: `<svg viewBox="0 0 24 24"><polygon points="12,3 21,20 3,20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  },
  // Invalid entry — should be skipped and surface a floating warn
  { iconId: "broken", svg: "" },
];

const App = () => {
  const [document, setDocument] = useState<DiagramDocument>(EMPTY_DOCUMENT);

  return (
    <div className="playground">
      <h1>ScribbleSVG Playground</h1>
      <div className="playground-panes">
        <section className="playground-pane" aria-label="Editor">
          <h2>Editor</h2>
          <DiagramCanvas
            initialDocument={document}
            onChange={setDocument}
            icons={PLAYGROUND_ICONS}
          />
        </section>
        <section className="playground-pane" aria-label="Renderer">
          <h2>Renderer</h2>
          <div className="playground-renderer">
            <DiagramRenderer document={document} icons={PLAYGROUND_ICONS} />
          </div>
        </section>
      </div>
    </div>
  );
};

export default App;
