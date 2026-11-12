import type { Bounds } from "@scribblesvg/core";
import type { HandlePosition } from "./hit-test";

/** Corner handles change both axes, so they can scale an element uniformly. */
export function isCornerHandle(handle: HandlePosition): boolean {
  return handle.length === 2;
}

/**
 * Reshape a corner resize so the box keeps the aspect ratio of `start`.
 *
 * The axis the pointer stretched further wins, neither side drops below
 * `minSize`, and the corner opposite `handle` stays where it was.
 */
export function lockAspectRatio(
  start: Bounds,
  resized: Bounds,
  handle: HandlePosition,
  minSize: number,
): Bounds {
  const scale = Math.max(
    resized.width / start.width,
    resized.height / start.height,
    minSize / start.width,
    minSize / start.height,
  );
  const width = start.width * scale;
  const height = start.height * scale;
  return {
    x: handle.includes("w") ? start.x + start.width - width : start.x,
    y: handle.includes("n") ? start.y + start.height - height : start.y,
    width,
    height,
  };
}
