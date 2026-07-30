import { useState } from "react";
import { EMPTY_DOCUMENT, type DiagramDocument } from "@scribblesvg/core";
import { DiagramCanvas } from "@scribblesvg/react-utils/editor";
import "@scribblesvg/react-utils/editor.css";
import { exportJson, exportSvg } from "./export";
import "./styles.css";

const App = () => {
  const [document, setDocument] = useState<DiagramDocument>(EMPTY_DOCUMENT);
  const hasContent = document.elements.length > 0;

  return (
    <div className="site">
      <header className="site-header">
        <div className="site-brand">
          <span className="site-logo">ScribbleSVG</span>
        </div>
        <div className="site-actions">
          <button
            type="button"
            className="site-btn"
            disabled={!hasContent}
            onClick={() => exportJson(document)}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="site-btn site-btn--primary"
            disabled={!hasContent}
            onClick={() => exportSvg(document)}
          >
            Export SVG
          </button>
        </div>
      </header>
      <main className="site-main">
        <DiagramCanvas
          initialDocument={document}
          onChange={setDocument}
        />
      </main>
    </div>
  );
};

export default App;
