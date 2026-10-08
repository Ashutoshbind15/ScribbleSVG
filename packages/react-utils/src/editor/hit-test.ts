import {
  getElementBounds,
  getElementCenter,
  getElementConnectionPoints,
  isConnector,
  type Bounds,
  type CylinderElement,
  type DiagramElement,
} from "@scribblesvg/core";

/**
 * Hit-test threshold for connectors (distance in canvas-space pixels).
 * The user's pointer must be within this distance of the line segment.
 */
const CONNECTOR_HIT_THRESHOLD = 5;

/** Prefer contained hits, preserving stacking order between unrelated elements. */
export function hitTest(
  point: { x: number; y: number },
  elements: DiagramElement[],
): DiagramElement | null {
  const hits = elements.filter((element) => hitTestElement(point, element));
  for (let i = hits.length - 1; i >= 0; i--) {
    const element = hits[i];
    if (!hits.some((other) => other !== element && strictlyContains(element, other))) {
      return element;
    }
  }
  return null;
}

function strictlyContains(outer: DiagramElement, inner: DiagramElement): boolean {
  if (isConnector(outer)) return false;
  const a = getElementBounds(outer);
  const b = getElementBounds(inner);
  if (
    b.x < a.x || b.y < a.y ||
    b.x + b.width > a.x + a.width || b.y + b.height > a.y + a.height ||
    (a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height)
  ) return false;

  if (inner.type === "circle") {
    const center = getElementCenter(outer);
    if (outer.type === "circle") {
      return Math.hypot(inner.cx - center.x, inner.cy - center.y) + inner.radius <= outer.radius;
    }
    if (outer.type === "diamond") {
      const hw = a.width / 2;
      const hh = a.height / 2;
      return Math.abs(inner.cx - center.x) / hw + Math.abs(inner.cy - center.y) / hh +
        inner.radius * Math.hypot(1 / hw, 1 / hh) <= 1;
    }
    return true;
  }
  const points = isConnector(inner)
    ? [{ x: inner.startX, y: inner.startY }, { x: inner.endX, y: inner.endY }]
    : inner.type === "diamond"
      ? [{ x: b.x + b.width / 2, y: b.y }, { x: b.x + b.width, y: b.y + b.height / 2 },
         { x: b.x + b.width / 2, y: b.y + b.height }, { x: b.x, y: b.y + b.height / 2 }]
      : [{ x: b.x, y: b.y }, { x: b.x + b.width, y: b.y },
         { x: b.x, y: b.y + b.height }, { x: b.x + b.width, y: b.y + b.height }];
  return points.every((point) => hitTestElement(point, outer));
}

export function hitTestTextTarget(
  point: { x: number; y: number },
  elements: DiagramElement[],
  zoom: number,
): Exclude<DiagramElement, { type: "arrow" | "line" }> | null {
  const target = hitTest(point, elements);
  if (!target || isConnector(target)) return null;
  if (target.type === "text") return target;
  const bounds = getElementBounds(target);
  const center = getElementCenter(target);
  const radius = Math.min(16 / zoom, bounds.width / 2, bounds.height / 2);
  return Math.hypot(point.x - center.x, point.y - center.y) <= radius ? target : null;
}

/** Screen-space distance from a shape's outline that still counts as a select hit. */
export const OUTLINE_HIT_TOLERANCE_PX = 6;

/**
 * Select-tool targeting: shapes are picked only near their outline, so
 * clicking inside a large (possibly off-screen) shape falls through to the
 * canvas. Text, icons, and connectors keep their normal hit areas. The body
 * of an already-selected element still hits so it can be dragged.
 */
export function hitTestSelection(
  point: { x: number; y: number },
  elements: DiagramElement[],
  zoom: number,
  selectedIds: ReadonlySet<string> = new Set(),
): DiagramElement | null {
  const tolerance = OUTLINE_HIT_TOLERANCE_PX / zoom;
  for (let i = elements.length - 1; i >= 0; i--) {
    if (hitTestOutline(point, elements[i], tolerance)) return elements[i];
  }
  return hitTest(point, elements.filter((element) => selectedIds.has(element.id)));
}

/** Canvas-space padding between a multi-selection's members and its group box. */
export const GROUP_SELECTION_PADDING = 8;

/**
 * Padded box enclosing every selected element, or null unless two or more
 * are selected. The whole box acts as one drag target for the group.
 */
export function getGroupSelectionBounds(
  elements: DiagramElement[],
  selectedIds: ReadonlySet<string>,
): Bounds | null {
  if (selectedIds.size < 2) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const element of elements) {
    if (!selectedIds.has(element.id)) continue;
    const { x, y, width, height } = getElementBounds(element);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }
  if (minX === Infinity) return null;
  return {
    x: minX - GROUP_SELECTION_PADDING,
    y: minY - GROUP_SELECTION_PADDING,
    width: maxX - minX + GROUP_SELECTION_PADDING * 2,
    height: maxY - minY + GROUP_SELECTION_PADDING * 2,
  };
}

/** True if the point is inside the group box of a multi-selection. */
export function hitTestGroupSelection(
  point: { x: number; y: number },
  elements: DiagramElement[],
  selectedIds: ReadonlySet<string>,
): boolean {
  const bounds = getGroupSelectionBounds(elements, selectedIds);
  return bounds !== null && pointInRect(point, bounds);
}

/** Test whether a point lies within `tolerance` of an element's visible outline. */
export function hitTestOutline(
  point: { x: number; y: number },
  element: DiagramElement,
  tolerance: number,
): boolean {
  switch (element.type) {
    case "icon":
    case "text":
      return hitTestElement(point, element);

    case "arrow":
    case "line":
      return pointNearLineSegment(
        point,
        { x: element.startX, y: element.startY },
        { x: element.endX, y: element.endY },
        Math.max(tolerance, CONNECTOR_HIT_THRESHOLD),
      );

    case "circle":
      return Math.abs(Math.hypot(point.x - element.cx, point.y - element.cy) - element.radius) <= tolerance;

    case "rectangle":
      return pointNearPolygon(point, rectCorners(getElementBounds(element)), tolerance);

    case "diamond":
      return pointNearPolygon(point, diamondVertices(getElementBounds(element)), tolerance);

    case "cylinder": {
      const { sides, caps } = cylinderOutline(element);
      return (
        sides.some(([a, b]) => pointNearLineSegment(point, a, b, tolerance)) ||
        caps.some((cap) => pointNearEllipse(point, cap.cx, cap.cy, cap.rx, cap.ry, tolerance))
      );
    }
  }
}

function diamondVertices({ x, y, width, height }: Bounds): { x: number; y: number }[] {
  return [
    { x: x + width / 2, y }, { x: x + width, y: y + height / 2 },
    { x: x + width / 2, y: y + height }, { x, y: y + height / 2 },
  ];
}

interface Ellipse { cx: number; cy: number; rx: number; ry: number }

/** Mirrors getCylinderPaths: vertical sides plus top and bottom ellipses. */
function cylinderOutline({ x, y, width, height }: CylinderElement): {
  sides: [{ x: number; y: number }, { x: number; y: number }][];
  caps: Ellipse[];
} {
  const capHeight = Math.min(width * 0.25, height * 0.3);
  const cx = x + width / 2;
  const topCy = y + capHeight / 2;
  const bottomCy = y + height - capHeight / 2;
  return {
    sides: [
      [{ x, y: topCy }, { x, y: bottomCy }],
      [{ x: x + width, y: topCy }, { x: x + width, y: bottomCy }],
    ],
    caps: [
      { cx, cy: topCy, rx: width / 2, ry: capHeight / 2 },
      { cx, cy: bottomCy, rx: width / 2, ry: capHeight / 2 },
    ],
  };
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
 * Shapes count only when the marquee touches or encloses their outline —
 * matching select-tool clicks — so a box drawn inside a container picks
 * its children without the container. Connectors use segment∩rect so thin
 * diagonals aren't selected via the empty corner of their bounding box.
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
  switch (element.type) {
    case "arrow":
    case "line":
      return lineSegmentIntersectsRect(
        { x: element.startX, y: element.startY },
        { x: element.endX, y: element.endY },
        marquee,
      );

    case "icon":
    case "text":
      return boundsIntersect(getElementBounds(element), marquee);

    case "rectangle":
      return polygonOutlineIntersectsRect(rectCorners(getElementBounds(element)), marquee);

    case "diamond":
      return polygonOutlineIntersectsRect(diamondVertices(getElementBounds(element)), marquee);

    case "circle":
      return ellipseOutlineIntersectsRect(
        { cx: element.cx, cy: element.cy, rx: element.radius, ry: element.radius },
        marquee,
      );

    case "cylinder": {
      const { sides, caps } = cylinderOutline(element);
      return (
        sides.some(([a, b]) => lineSegmentIntersectsRect(a, b, marquee)) ||
        caps.some((cap) => ellipseOutlineIntersectsRect(cap, marquee))
      );
    }
  }
}

/** True if any edge of the closed polygon touches or lies inside `rect`. */
function polygonOutlineIntersectsRect(
  vertices: { x: number; y: number }[],
  rect: Bounds,
): boolean {
  return vertices.some((a, i) =>
    lineSegmentIntersectsRect(a, vertices[(i + 1) % vertices.length], rect));
}

/**
 * True if the ellipse outline touches or lies inside `rect`. Scaling by the
 * radii keeps the rect axis-aligned and turns the ellipse into a unit circle;
 * the (connected) rect meets the circle iff its nearest point is inside and
 * its farthest corner is outside.
 */
function ellipseOutlineIntersectsRect({ cx, cy, rx, ry }: Ellipse, rect: Bounds): boolean {
  if (rx <= 0 || ry <= 0) {
    return lineSegmentIntersectsRect({ x: cx - rx, y: cy - ry }, { x: cx + rx, y: cy + ry }, rect);
  }
  const left = (rect.x - cx) / rx;
  const right = (rect.x + rect.width - cx) / rx;
  const top = (rect.y - cy) / ry;
  const bottom = (rect.y + rect.height - cy) / ry;
  const nearX = Math.max(left, Math.min(0, right));
  const nearY = Math.max(top, Math.min(0, bottom));
  const farX = Math.max(Math.abs(left), Math.abs(right));
  const farY = Math.max(Math.abs(top), Math.abs(bottom));
  return Math.hypot(nearX, nearY) <= 1 && Math.hypot(farX, farY) >= 1;
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

function rectCorners({ x, y, width, height }: Bounds): { x: number; y: number }[] {
  return [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
}

function pointNearPolygon(
  point: { x: number; y: number },
  vertices: { x: number; y: number }[],
  threshold: number,
): boolean {
  return vertices.some((a, i) =>
    pointNearLineSegment(point, a, vertices[(i + 1) % vertices.length], threshold));
}

/** First-order (Sampson) distance to an ellipse outline; exact for circles. */
function pointNearEllipse(
  point: { x: number; y: number },
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  threshold: number,
): boolean {
  if (rx <= 0 || ry <= 0) {
    return pointNearLineSegment(point, { x: cx - rx, y: cy - ry }, { x: cx + rx, y: cy + ry }, threshold);
  }
  const dx = point.x - cx;
  const dy = point.y - cy;
  const f = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) - 1;
  const grad = 2 * Math.hypot(dx / (rx * rx), dy / (ry * ry));
  if (grad === 0) return Math.min(rx, ry) <= threshold;
  return Math.abs(f) / grad <= threshold;
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
