import type { Viewport } from "@scribblesvg/core";

/**
 * Convert screen (pixel) coordinates to canvas (SVG) coordinates.
 *
 * The viewport defines the canvas-space origin (x, y) that maps to the
 * center of the SVG element, and a zoom level.
 *
 *   canvasX = viewport.x + (screenX - svgRect.width / 2) / zoom
 *   canvasY = viewport.y + (screenY - svgRect.height / 2) / zoom
 *
 * `screenX`/`screenY` are relative to the SVG element's top-left
 * (i.e. clientX - svgRect.left).
 */
export function screenToCanvas(
  screenX: number,
  screenY: number,
  viewport: Viewport,
  svgRect: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: viewport.x + (screenX - svgRect.width / 2) / viewport.zoom,
    y: viewport.y + (screenY - svgRect.height / 2) / viewport.zoom,
  };
}

/**
 * Convert canvas (SVG) coordinates to screen (pixel) coordinates.
 * Inverse of `screenToCanvas`.
 *
 * Returns coordinates relative to the SVG element's top-left.
 */
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  viewport: Viewport,
  svgRect: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: (canvasX - viewport.x) * viewport.zoom + svgRect.width / 2,
    y: (canvasY - viewport.y) * viewport.zoom + svgRect.height / 2,
  };
}

/**
 * Compute the SVG `viewBox` string from a viewport and container dimensions.
 *
 * The viewBox represents the visible canvas-space rectangle:
 * - origin: viewport center minus half the visible area
 * - size:   container dimensions divided by zoom
 */
export function getViewBox(
  viewport: Viewport,
  width: number,
  height: number,
): string {
  const vw = width / viewport.zoom;
  const vh = height / viewport.zoom;
  const vx = viewport.x - vw / 2;
  const vy = viewport.y - vh / 2;
  return `${vx} ${vy} ${vw} ${vh}`;
}
