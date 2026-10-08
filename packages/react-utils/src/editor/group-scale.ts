import {
  DEFAULT_SHAPE_LABEL_FONT_SIZE,
  DEFAULT_TEXT_FONT_SIZE,
  getElementBounds,
  isConnector,
  type Bounds,
  type DiagramElement,
} from "@scribblesvg/core";
import type { HandlePosition } from "./hit-test";
import { measureDomTextSize } from "./measureDomText";

/** Smallest box edge a shape may shrink to during a group scale. */
const MIN_SHAPE_SIZE = 20;
/** Smallest font size a group scale may produce. */
const MIN_FONT_SIZE = 8;

/** Corner of `bounds` opposite the dragged corner handle; it stays fixed. */
export function getScaleAnchor(
  bounds: Bounds,
  handle: HandlePosition,
): { x: number; y: number } {
  return {
    x: handle.includes("w") ? bounds.x + bounds.width : bounds.x,
    y: handle.includes("n") ? bounds.y + bounds.height : bounds.y,
  };
}

/**
 * Lowest uniform scale that keeps every shape at least MIN_SHAPE_SIZE on its
 * short edge and every font at least MIN_FONT_SIZE. Never above 1, so a group
 * that already holds something tiny can still be scaled up.
 */
export function getMinGroupScale(elements: DiagramElement[]): number {
  let min = 0.05;
  for (const el of elements) {
    if (isConnector(el)) continue;
    if (el.type === "text") {
      const fontSize = el.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
      min = Math.max(min, MIN_FONT_SIZE / fontSize);
      continue;
    }
    const { width, height } = getElementBounds(el);
    const shortEdge = Math.min(width, height);
    if (shortEdge > 0) min = Math.max(min, MIN_SHAPE_SIZE / shortEdge);
  }
  return Math.min(1, min);
}

/**
 * Uniform scale factor for dragging a corner handle of `bounds` by (dx, dy).
 * Whichever axis was pulled further wins, so the group keeps its proportions.
 */
export function computeGroupScale(
  bounds: Bounds,
  handle: HandlePosition,
  dx: number,
  dy: number,
  minScale: number,
): number {
  const signX = handle.includes("w") ? -1 : 1;
  const signY = handle.includes("n") ? -1 : 1;
  const sx = bounds.width > 0 ? (bounds.width + signX * dx) / bounds.width : null;
  const sy =
    bounds.height > 0 ? (bounds.height + signY * dy) / bounds.height : null;
  const scale = sx === null ? (sy ?? 1) : sy === null ? sx : Math.max(sx, sy);
  return Math.max(minScale, scale);
}

/**
 * Patches that scale each element uniformly about `anchor`: positions,
 * sizes, connector endpoints and font sizes all scale by `scale`.
 */
export function getGroupScalePatches(
  elements: DiagramElement[],
  anchor: { x: number; y: number },
  scale: number,
): { id: string; patch: Partial<DiagramElement> }[] {
  const sx = (x: number) => anchor.x + (x - anchor.x) * scale;
  const sy = (y: number) => anchor.y + (y - anchor.y) * scale;
  const scaleFont = (fontSize: number) =>
    Math.max(MIN_FONT_SIZE, fontSize * scale);

  return elements.map((el): { id: string; patch: Partial<DiagramElement> } => {
    switch (el.type) {
      case "rectangle":
      case "cylinder":
      case "diamond":
      case "icon": {
        const patch: Partial<DiagramElement> = {
          x: sx(el.x),
          y: sy(el.y),
          width: el.width * scale,
          height: el.height * scale,
        };
        if (el.text) {
          patch.fontSize = scaleFont(
            el.fontSize ?? DEFAULT_SHAPE_LABEL_FONT_SIZE,
          );
        }
        return { id: el.id, patch };
      }

      case "circle": {
        const patch: Partial<DiagramElement> = {
          cx: sx(el.cx),
          cy: sy(el.cy),
          radius: el.radius * scale,
        };
        if (el.text) {
          patch.fontSize = scaleFont(
            el.fontSize ?? DEFAULT_SHAPE_LABEL_FONT_SIZE,
          );
        }
        return { id: el.id, patch };
      }

      case "text": {
        // Scale the top-left with the group, then hug the resized glyphs.
        const fontSize = scaleFont(el.fontSize ?? DEFAULT_TEXT_FONT_SIZE);
        const size = measureDomTextSize(el.text, fontSize);
        return {
          id: el.id,
          patch: {
            x: sx(el.x),
            y: sy(el.y),
            width: size.width,
            height: size.height,
            fontSize,
          },
        };
      }

      case "arrow":
      case "line":
        return {
          id: el.id,
          patch: {
            startX: sx(el.startX),
            startY: sy(el.startY),
            endX: sx(el.endX),
            endY: sy(el.endY),
          },
        };
    }
  });
}
