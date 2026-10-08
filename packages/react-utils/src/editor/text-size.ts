/**
 * Font-size helpers shared by the text size grip and the
 * Ctrl/Cmd+Shift+< / > shortcuts.
 */

export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 200;

/** Sizes the keyboard shortcuts step through. */
const FONT_SIZE_STEPS = [
  8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 112,
  128, 144, 160, 180, 200,
];

export function clampFontSize(fontSize: number): number {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize));
}

/**
 * Next size up (direction 1) or down (-1) on the step ladder. Off-ladder
 * sizes (e.g. after a free resize) snap to the nearest step that way.
 */
export function stepFontSize(fontSize: number, direction: 1 | -1): number {
  if (direction > 0) {
    return FONT_SIZE_STEPS.find((s) => s > fontSize + 0.5) ?? MAX_FONT_SIZE;
  }
  for (let i = FONT_SIZE_STEPS.length - 1; i >= 0; i--) {
    if (FONT_SIZE_STEPS[i] < fontSize - 0.5) return FONT_SIZE_STEPS[i];
  }
  return MIN_FONT_SIZE;
}

/**
 * Font size for a grip dragged from `gripStart` to `point`, scaling about
 * `anchor`. Only travel along the anchor→grip axis counts, so sideways
 * wobble doesn't change the size. Rounded to whole pixels.
 */
export function scaleFontSizeFromGrip(
  startFontSize: number,
  anchor: { x: number; y: number },
  gripStart: { x: number; y: number },
  point: { x: number; y: number },
): number {
  const ax = gripStart.x - anchor.x;
  const ay = gripStart.y - anchor.y;
  const lengthSq = ax * ax + ay * ay;
  if (lengthSq === 0) return startFontSize;

  const ratio =
    ((point.x - anchor.x) * ax + (point.y - anchor.y) * ay) / lengthSq;
  return Math.round(clampFontSize(startFontSize * ratio));
}
