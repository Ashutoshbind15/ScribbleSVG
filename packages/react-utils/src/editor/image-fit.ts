import type { Bounds, Viewport } from "@scribblesvg/core";

/** Share of the visible canvas a newly inserted image may fill, per axis. */
const MAX_VIEWPORT_SHARE = 0.5;

/**
 * Box for a newly inserted image: centred in the viewport, scaled down (never
 * up) to fit half the visible area, keeping the image's aspect ratio.
 */
export function fitImageToViewport(
  natural: { width: number; height: number },
  viewport: Viewport,
  screen: { width: number; height: number },
): Bounds {
  const visibleWidth = screen.width / viewport.zoom;
  const visibleHeight = screen.height / viewport.zoom;
  const scale = Math.min(
    1,
    (visibleWidth * MAX_VIEWPORT_SHARE) / natural.width,
    (visibleHeight * MAX_VIEWPORT_SHARE) / natural.height,
  );
  const width = natural.width * scale;
  const height = natural.height * scale;
  return {
    x: viewport.x - width / 2,
    y: viewport.y - height / 2,
    width,
    height,
  };
}

/**
 * Loads `src` and resolves with its natural size, or `null` when it fails to
 * load or has no intrinsic size (e.g. an SVG without width/height).
 */
export async function measureImage(
  src: string,
): Promise<{ width: number; height: number } | null> {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const { naturalWidth: width, naturalHeight: height } = img;
  return width > 0 && height > 0 ? { width, height } : null;
}
