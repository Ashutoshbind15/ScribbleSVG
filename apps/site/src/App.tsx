import { useState } from "react";
import { EMPTY_DOCUMENT, type DiagramDocument } from "@scribblesvg/core";
import { DiagramCanvas } from "@scribblesvg/react-utils/editor";
import "@scribblesvg/react-utils/editor.css";
import { exportSvg } from "./export";
import "./styles.css";

const DOCS_URL = "https://scribblesvg-docs.ashutoshbind.com/";

const App = () => {
  const [document, setDocument] = useState<DiagramDocument>(EMPTY_DOCUMENT);
  const hasContent = document.elements.length > 0;

  return (
    <div className="site">
      <header className="site-header">
        <div className="site-brand">
          <img
            className="site-mark"
            src="/brand/ssvg.svg"
            alt="ScribbleSVG"
            width={120}
            height={56}
          />
          <span className="site-brand__sep" aria-hidden="true" />
          <a
            className="site-docs-link"
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Developer docs
          </a>
        </div>
        <div className="site-actions">
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
        <div className="site-canvas">
          <DiagramCanvas
            initialDocument={document}
            onChange={setDocument}
          />
          {!hasContent && (
            <div className="site-empty" aria-hidden="true">
              <img
                className="site-empty__wordmark"
                src="/brand/scribblesvg.svg"
                alt=""
                width={280}
                height={54}
              />
              <p className="site-empty__hint">
                Start drawing on the lightweight canvas.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
