import { useState } from "react";
import { EMPTY_DOCUMENT, type DiagramDocument } from "@scribblesvg/core";
import { DiagramCanvas } from "@scribblesvg/react-utils/editor";
import "@scribblesvg/react-utils/editor.css";
import "./styles.css";

const App = () => {
  const [document, setDocument] = useState<DiagramDocument>(EMPTY_DOCUMENT);

  return (
    <div className="playground">
      <h1>ScribbleSVG Playground</h1>
      <DiagramCanvas initialDocument={document} onChange={setDocument} />
    </div>
  );
};

export default App;
