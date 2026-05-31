import type { Viewport, DiagramDocument } from "./types";

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

/** Default font size for labels inside shapes (rectangle, circle, cylinder) */
export const DEFAULT_SHAPE_LABEL_FONT_SIZE = 14;

export const EMPTY_DOCUMENT: DiagramDocument = {
  version: 1,
  viewport: DEFAULT_VIEWPORT,
  elements: [],
};
