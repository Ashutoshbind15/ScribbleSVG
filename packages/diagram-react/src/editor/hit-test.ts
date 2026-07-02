import {
  getElementBounds,
  getElementCenter,
  getElementConnectionPoints,
  type Bounds,
  type DiagramElement,
} from "@scribblesvg/core";

/**
 * Hit-test threshold for arrows (distance in canvas-space pixels).
 * The user's pointer must be within this distance of the arrow line segment.
 */
const ARROW_HIT_THRESHOLD = 5;

/**
 * Determine which element (if any) is under a given canvas-space point.
 * Returns the topmost element (last in array order) or null.
 */
export function hitTest(
  point: { x: number; y: number },
  elements: DiagramElement[],
): DiagramElement | null {
  // Iterate in reverse for topmost-first hit
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (hitTestElement(point, el)) {
      return el;
    }
  }
  return null;
}

/**
 * Test whether a point hits a single element.
 */
export function hitTestElement(
  point: { x: number; y: number },
  element: DiagramElement,
): boolean {
  switch (element.type) {
    case "rectangle":
    case "cylinder":
      return pointInRect(point, getElementBounds(element));

    case "circle":
      return pointInCircle(point, element.cx, element.cy, element.radius);

    case "text":
      return pointInRect(point, getElementBounds(element));

    case "arrow":
      return pointNearLineSegment(
        point,
        { x: element.startX, y: element.startY },
        { x: element.endX, y: element.endY },
        ARROW_HIT_THRESHOLD,
      );
  }
}

// ── Connection points (arrow attachment) ──

export interface ConnectionPointHit {
  elementId: string;
  point: { x: number; y: number };
}

/**
 * Find the nearest connection point within `threshold` canvas pixels of `point`.
 * Prefers topmost elements (last in array order).
 */
export function hitTestConnectionPoint(
  point: { x: number; y: number },
  elements: DiagramElement[],
  threshold: number,
): ConnectionPointHit | null {
  let best: ConnectionPointHit | null = null;
  let bestDistSq = threshold * threshold;

  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type === "arrow") continue;

    for (const conn of getElementConnectionPoints(el)) {
      const dx = point.x - conn.x;
      const dy = point.y - conn.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDistSq) {
        bestDistSq = distSq;
        best = { elementId: el.id, point: conn };
      }
    }
  }

  return best;
}

// ── Resize handle types ──

export type HandlePosition = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface HandleInfo {
  position: HandlePosition;
  x: number;
  y: number;
}

/**
 * Get the 8 resize handles for a bounding box.
 */
export function getResizeHandles(bounds: Bounds): HandleInfo[] {
  const { x, y, width, height } = bounds;
  const mx = x + width / 2;
  const my = y + height / 2;

  return [
    { position: "nw", x, y },
    { position: "n", x: mx, y },
    { position: "ne", x: x + width, y },
    { position: "e", x: x + width, y: my },
    { position: "se", x: x + width, y: y + height },
    { position: "s", x: mx, y: y + height },
    { position: "sw", x, y: y + height },
    { position: "w", x, y: my },
  ];
}

/**
 * Test if a point is over a resize handle.
 * Returns the handle position or null.
 * `handleSize` is the half-size of the handle in canvas coords.
 */
export function hitTestResizeHandle(
  point: { x: number; y: number },
  bounds: Bounds,
  handleSize: number,
): HandlePosition | null {
  const handles = getResizeHandles(bounds);
  for (const handle of handles) {
    if (
      Math.abs(point.x - handle.x) <= handleSize &&
      Math.abs(point.y - handle.y) <= handleSize
    ) {
      return handle.position;
    }
  }
  return null;
}

// ── Internal helpers ──

function pointInRect(point: { x: number; y: number }, bounds: Bounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

function pointInCircle(
  point: { x: number; y: number },
  cx: number,
  cy: number,
  radius: number,
): boolean {
  const dx = point.x - cx;
  const dy = point.y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Test if a point is within `threshold` distance of a line segment.
 */
function pointNearLineSegment(
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  threshold: number,
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Degenerate segment (start === end)
    const d = Math.sqrt((point.x - a.x) ** 2 + (point.y - a.y) ** 2);
    return d <= threshold;
  }

  // Project point onto the line, clamp t to [0, 1] for segment
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = a.x + t * dx;
  const closestY = a.y + t * dy;
  const dist = Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);

  return dist <= threshold;
}
