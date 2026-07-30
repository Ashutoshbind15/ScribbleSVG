import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DiagramDocument } from "@scribblesvg/core";
import { DiagramRenderer } from "@scribblesvg/react-utils/renderer";
import type { DiagramIcon } from "@scribblesvg/react-utils/icons";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Download the diagram document as pretty-printed JSON. */
export function exportJson(document: DiagramDocument, filename = "diagram.json") {
  const json = JSON.stringify(document, null, 2);
  downloadBlob(new Blob([json], { type: "application/json" }), filename);
}

/**
 * Render the diagram to a standalone SVG file via DiagramRenderer.
 * Uses the light preset so strokes are concrete colors (not currentColor).
 */
export function exportSvg(
  document: DiagramDocument,
  icons: DiagramIcon[] = [],
  filename = "diagram.svg",
) {
  const markup = renderToStaticMarkup(
    createElement(DiagramRenderer, {
      document,
      icons,
      colorPreset: "light",
      "aria-label": "Diagram",
      style: {
        width: undefined,
        maxWidth: undefined,
        aspectRatio: undefined,
        color: "#1a1a1a",
      },
    }),
  );

  const withNs = markup.startsWith("<svg")
    ? markup.replace(
        /^<svg\b/,
        '<svg xmlns="http://www.w3.org/2000/svg"',
      )
    : markup;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n${withNs}\n`;
  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), filename);
}
