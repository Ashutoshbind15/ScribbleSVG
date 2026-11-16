/**
 * Zoom math for the editor: limits, the log-scale slider mapping, preset
 * steps, zooming around a point, and fitting content. Pure (no DOM).
 */
import type { Bounds, Viewport } from "@scribblesvg/core";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;

/** Ctrl/⌘ +/- and the slider's arrow keys move between these. */
export const ZOOM_PRESETS: readonly number[] = [
  0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5,
];

/** Slider positions (0–1) this close to 100% snap to it. */
export const ZOOM_SNAP_TOLERANCE = 0.025;

/** Screen pixels kept around content by default when fitting. */
export const FIT_PADDING = 48;

/** Floating-point slack when comparing a zoom against a preset. */
const EPSILON = 1e-6;

const LOG_MIN = Math.log(MIN_ZOOM);
const LOG_RANGE = Math.log(MAX_ZOOM) - LOG_MIN;

/** `zoom` within [MIN_ZOOM, MAX_ZOOM]; a non-finite zoom becomes 1. */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Slider position (0–1) for `zoom`, on a log scale. 100% lands near 0.59. */
export function zoomToSliderPosition(zoom: number): number {
  return (Math.log(clampZoom(zoom)) - LOG_MIN) / LOG_RANGE;
}

/** Zoom for a slider position (0–1); inverse of `zoomToSliderPosition`. */
export function sliderPositionToZoom(position: number): number {
  if (!(position > 0)) return MIN_ZOOM; // also NaN
  if (position >= 1) return MAX_ZOOM;
  return clampZoom(Math.exp(LOG_MIN + position * LOG_RANGE));
}

/**
 * 1 when `zoom` sits within `tolerance` slider positions of 100%, else
 * `zoom` unchanged. Gives the slider a soft detent at 100%.
 */
export function snapZoomToHundred(
  zoom: number,
  tolerance = ZOOM_SNAP_TOLERANCE,
): number {
  const distance = Math.abs(
    zoomToSliderPosition(zoom) - zoomToSliderPosition(1),
  );
  return distance <= tolerance ? 1 : zoom;
}

/**
 * The next preset strictly above (`direction` 1) or below (-1) `zoom`,
 * clamped to the limits.
 */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const current = clampZoom(zoom);
  if (direction > 0) {
    return ZOOM_PRESETS.find((z) => z > current + EPSILON) ?? MAX_ZOOM;
  }
  for (let i = ZOOM_PRESETS.length - 1; i >= 0; i--) {
    const z = ZOOM_PRESETS[i]!;
    if (z < current - EPSILON) return z;
  }
  return MIN_ZOOM;
}

/**
 * The viewport at `zoom` (clamped) that keeps the canvas point `anchor` at
 * the same spot on screen. Without an anchor it zooms around the viewport
 * centre (`viewport.x/y` is the canvas point at the centre).
 */
export function zoomAround(
  viewport: Viewport,
  zoom: number,
  anchor?: { x: number; y: number },
): Viewport {
  const next = clampZoom(zoom);
  if (!anchor) return { ...viewport, zoom: next };
  const ratio = viewport.zoom / next;
  return {
    x: anchor.x - (anchor.x - viewport.x) * ratio,
    y: anchor.y - (anchor.y - viewport.y) * ratio,
    zoom: next,
  };
}

/**
 * Viewport that centres `bounds` in a viewport of `size` screen pixels,
 * zoomed out until it fits inside `padding`. Never zooms in past 100%.
 * No content (null) gives the default viewport.
 */
export function fitViewport(
  bounds: Bounds | null,
  size: { width: number; height: number },
  { padding = FIT_PADDING }: { padding?: number } = {},
): Viewport {
  if (!bounds) return { x: 0, y: 0, zoom: 1 };
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  if (!(size.width > 0 && size.height > 0)) return { x, y, zoom: 1 };

  const availableWidth = Math.max(size.width - padding * 2, 1);
  const availableHeight = Math.max(size.height - padding * 2, 1);
  // A zero-width or zero-height box (a straight line) fits on that axis.
  const zoom = Math.min(
    1,
    bounds.width > 0 ? availableWidth / bounds.width : 1,
    bounds.height > 0 ? availableHeight / bounds.height : 1,
  );
  return { x, y, zoom: clampZoom(zoom) };
}
