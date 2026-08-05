import {
  measureTextSize,
  TEXT_LINE_HEIGHT,
} from "@scribblesvg/core";

/** Must match TextRenderer / InlineTextEditor font stack. */
const FONT_FAMILY = "'Segoe UI', system-ui, sans-serif";

let canvas: HTMLCanvasElement | null = null;

/**
 * Measure standalone text with the real UI font (canvas), so editor and
 * selection boxes match rendered glyphs better than the core approximation.
 * Falls back to `measureTextSize` when canvas is unavailable (e.g. tests).
 */
export function measureDomTextSize(
  text: string,
  fontSize: number,
): { width: number; height: number } {
  if (typeof document === "undefined") {
    return measureTextSize(text, fontSize);
  }

  canvas ??= document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return measureTextSize(text, fontSize);
  }

  ctx.font = `${fontSize}px ${FONT_FAMILY}`;
  const lines = text.split("\n");
  const lineCount = Math.max(lines.length, 1);
  let width = 0;
  for (const line of lines) {
    width = Math.max(width, ctx.measureText(line || " ").width);
  }

  return {
    width: Math.max(1, Math.ceil(width)),
    height: Math.ceil(fontSize * TEXT_LINE_HEIGHT * lineCount),
  };
}
