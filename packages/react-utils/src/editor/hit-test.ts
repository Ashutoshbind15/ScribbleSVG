import {
  getElementBounds,
  getElementConnectionPoints,
  isConnector,
  type Bounds,
  type DiagramElement,
} from "@scribblesvg/core";

/**
 * Hit-test threshold for connectors (distance in canvas-space pixels).
 * The user's pointer must be within this distance of the line segment.
 */
const CONNECTOR_HIT_THRESHOLD = 5;

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
    case "icon":
    case "text":
      return pointInRect(point, getElementBounds(element));

    case "diamond":
      return pointInDiamond(point, getElementBounds(element));

    case "circle":
      return pointInCircle(point, element.cx, element.cy, element.radius);

    case "arrow":
    case "line":
      return pointNearLineSegment(
        point,
        { x: element.startX, y: element.startY },
        { x: element.endX, y: element.endY },
        CONNECTOR_HIT_THRESHOLD,
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
    if (isConnector(el)) continue;

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

// ── Marquee (box) selection ──

/** Normalize two corners into an axis-aligned bounds rect. */
export function boundsFromPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
): Bounds {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** True if two AABBs overlap (edges touching counts as intersection). */
export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

/**
 * Elements whose geometry intersects the marquee rectangle.
 * Shapes use AABB intersection; connectors use segment∩rect so thin
 * diagonals aren't selected via empty corner of their bounding box.
 */
export function hitTestMarquee(
  marquee: Bounds,
  elements: DiagramElement[],
): DiagramElement[] {
  if (marquee.width <= 0 && marquee.height <= 0) return [];

  const hits: DiagramElement[] = [];
  for (const el of elements) {
    if (elementIntersectsMarquee(el, marquee)) {
      hits.push(el);
    }
  }
  return hits;
}

/** Screen-space movement below this is treated as a click (not a drag-select). */
export const MARQUEE_CLICK_THRESHOLD_PX = 4;

export type MarqueeSelectionResult =
  | { type: "clear" }
  | { type: "keep" }
  | { type: "set"; ids: string[] };

/**
 * Resolve what the selection should become after a marquee gesture ends.
 * Pure: click-vs-drag, additive union, and intersection hit-testing.
 */
export function resolveMarqueeSelection(args: {
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  screenStart: { x: number; y: number };
  screenEnd: { x: number; y: number };
  additive: boolean;
  selectedIds: ReadonlySet<string>;
  elements: DiagramElement[];
  clickThresholdPx?: number;
}): MarqueeSelectionResult {
  const {
    startPoint,
    endPoint,
    screenStart,
    screenEnd,
    additive,
    selectedIds,
    elements,
    clickThresholdPx = MARQUEE_CLICK_THRESHOLD_PX,
  } = args;

  const screenDx = screenEnd.x - screenStart.x;
  const screenDy = screenEnd.y - screenStart.y;
  const isClick = Math.hypot(screenDx, screenDy) < clickThresholdPx;

  if (isClick) {
    return additive ? { type: "keep" } : { type: "clear" };
  }

  const hits = hitTestMarquee(boundsFromPoints(startPoint, endPoint), elements);
  if (additive) {
    const next = new Set(selectedIds);
    for (const el of hits) next.add(el.id);
    return { type: "set", ids: Array.from(next) };
  }

  return { type: "set", ids: hits.map((el) => el.id) };
}

function elementIntersectsMarquee(
  element: DiagramElement,
  marquee: Bounds,
): boolean {
  if (element.type === "arrow" || element.type === "line") {
    return lineSegmentIntersectsRect(
      { x: element.startX, y: element.startY },
      { x: element.endX, y: element.endY },
      marquee,
    );
  }

  // Circles / diamonds: AABB intersection is the usual diagram-editor
  // approximation and matches “select what the box touches.”
  return boundsIntersect(getElementBounds(element), marquee);
}

/**
 * True if segment AB intersects (or is contained by) axis-aligned `rect`.
 */
function lineSegmentIntersectsRect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  rect: Bounds,
): boolean {
  if (pointInRect(a, rect) || pointInRect(b, rect)) return true;

  const left = { x: rect.x, y: rect.y };
  const right = { x: rect.x + rect.width, y: rect.y };
  const bottomLeft = { x: rect.x, y: rect.y + rect.height };
  const bottomRight = { x: rect.x + rect.width, y: rect.y + rect.height };

  return (
    segmentsIntersect(a, b, left, right) ||
    segmentsIntersect(a, b, right, bottomRight) ||
    segmentsIntersect(a, b, bottomRight, bottomLeft) ||
    segmentsIntersect(a, b, bottomLeft, left)
  );
}

/** True if open/closed segments AB and CD properly intersect or touch. */
function segmentsIntersect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
): boolean {
  const orient = (
    p: { x: number; y: number },
    q: { x: number; y: number },
    r: { x: number; y: number },
  ) => (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);

  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);

  if (o1 === 0 && pointOnSegment(a, c, b)) return true;
  if (o2 === 0 && pointOnSegment(a, d, b)) return true;
  if (o3 === 0 && pointOnSegment(c, a, d)) return true;
  if (o4 === 0 && pointOnSegment(c, b, d)) return true;

  return (
    ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) &&
    ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))
  );
}

function pointOnSegment(
  a: { x: number; y: number },
  p: { x: number; y: number },
  b: { x: number; y: number },
): boolean {
  return (
    p.x <= Math.max(a.x, b.x) &&
    p.x >= Math.min(a.x, b.x) &&
    p.y <= Math.max(a.y, b.y) &&
    p.y >= Math.min(a.y, b.y)
  );
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

function pointInDiamond(
  point: { x: number; y: number },
  bounds: Bounds,
): boolean {
  const hw = bounds.width / 2;
  const hh = bounds.height / 2;
  if (hw <= 0 || hh <= 0) return false;
  const cx = bounds.x + hw;
  const cy = bounds.y + hh;
  const dx = Math.abs(point.x - cx);
  const dy = Math.abs(point.y - cy);
  return dx / hw + dy / hh <= 1;
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
