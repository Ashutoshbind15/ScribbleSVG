/** A sampled stroke point in canvas coordinates. */
export type StrokePoint = [number, number];

/** Stroke width of freehand pencil strokes, in canvas units. */
export const FREEDRAW_STROKE_WIDTH = 2;

// ── Tuning (all distances are multiples of `tolerance`) ──

/** Samples closer than this to the previous one carry no shape information. */
const DEDUPE_DISTANCE = 0.5;
/** Arc length looked back/ahead when measuring how sharply the stroke turns. */
const CORNER_WINDOW = 8;
/** Turn (radians) over the corner window that counts as a deliberate corner. */
const CORNER_ANGLE = Math.PI / 3;
/** Spacing the smoothing pass resamples each run to. */
const RESAMPLE_SPACING = 2;
/** Neighbor-averaging passes; more passes iron out larger wobbles. */
const SMOOTHING_PASSES = 10;
/** Lighter passes on the copy used to find corners, so wobble isn't a corner. */
const DETECTION_PASSES = 3;
/** Max deviation allowed when dropping redundant points after smoothing. */
const SIMPLIFY_EPSILON = 0.4;
/** Vertex turn (radians) the path builder keeps as a sharp join, not a curve. */
const SHARP_JOIN_ANGLE = (65 * Math.PI) / 180;

/**
 * Drop samples that sit on top of the previous one. The final sample is
 * always kept so the stroke ends exactly under the pointer.
 */
export function dedupeStroke(
  points: StrokePoint[],
  tolerance = 1,
): StrokePoint[] {
  if (points.length < 2) return points.map(roundPoint);
  const minDistance = tolerance * DEDUPE_DISTANCE;
  const result: StrokePoint[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const point = points[i]!;
    if (distance(point, result[result.length - 1]!) >= minDistance) {
      result.push(point);
    } else if (i === points.length - 1 && result.length > 1) {
      result[result.length - 1] = point;
    }
  }
  return result.map(roundPoint);
}

/**
 * Even out hand jitter in a freehand stroke while keeping its intent.
 *
 * The stroke is split at deliberate corners (sharp turns sustained over a
 * stretch of the stroke, not single-sample jitter), each run between corners
 * is smoothed on its own, and the corners themselves are kept exactly. So
 * curves come out clean and boxes, zig-zags, and letters keep their points.
 *
 * `tolerance` is one screen pixel in canvas units (`1 / zoom`), so smoothing
 * feels the same at any zoom level.
 */
export function smoothStroke(
  points: StrokePoint[],
  tolerance = 1,
): StrokePoint[] {
  const deduped = dedupeStroke(points, tolerance);
  if (deduped.length < 3) return deduped;

  const even = resample(deduped, tolerance * RESAMPLE_SPACING);
  if (even.length < 3) return even.map(roundPoint);

  const corners = findCorners(
    relax(even, DETECTION_PASSES),
    tolerance * CORNER_WINDOW,
  );
  const result: StrokePoint[] = [];
  let start = 0;
  for (const end of [...corners, even.length - 1]) {
    const run = smoothRun(even.slice(start, end + 1), tolerance);
    // Runs share their corner point; skip the duplicate.
    result.push(...(result.length > 0 ? run.slice(1) : run));
    start = end;
  }
  return result.map(roundPoint);
}

/**
 * SVG path data through every stroke point: curves where the stroke flows,
 * sharp joins where it turns hard. A single point renders as a dot.
 */
export function getStrokePathData(points: StrokePoint[]): string {
  if (points.length === 0) return "";
  const [x0, y0] = points[0]!;
  if (points.length === 1) {
    // Zero-length segments may not paint; a hair of length shows the round cap.
    return `M${fmt(x0)} ${fmt(y0)}L${fmt(x0 + 0.01)} ${fmt(y0)}`;
  }

  let d = `M${fmt(x0)} ${fmt(y0)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const length = distance(p1, p2);
    const out = tangentAt(points, i);
    const into = tangentAt(points, i + 1);
    const c1: StrokePoint = out
      ? [p1[0] + (out[0] * length) / 3, p1[1] + (out[1] * length) / 3]
      : p1;
    const c2: StrokePoint = into
      ? [p2[0] - (into[0] * length) / 3, p2[1] - (into[1] * length) / 3]
      : p2;
    d += `C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d;
}

/** Axis-aligned box around the stroke's points. */
export function getStrokeBounds(points: StrokePoint[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ── Corner detection ──

/**
 * Indices where the stroke turns by more than CORNER_ANGLE between the
 * stretch `window` before and the stretch `window` after. Only the sharpest
 * point of each turn is kept, and the ends of the stroke never count.
 */
function findCorners(points: StrokePoint[], window: number): number[] {
  const arc = cumulativeLengths(points);
  const total = arc[arc.length - 1]!;
  if (total < window * 2) return [];

  const candidates: { index: number; turn: number }[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    if (arc[i]! < window || arc[i]! > total - window) continue;
    const before = pointAtLength(points, arc, arc[i]! - window);
    const after = pointAtLength(points, arc, arc[i]! + window);
    const turn = turnAngle(before, points[i]!, after);
    if (turn > CORNER_ANGLE) candidates.push({ index: i, turn });
  }

  // Non-maximum suppression: one corner per sustained turn.
  const corners: number[] = [];
  let best: { index: number; turn: number } | null = null;
  for (const candidate of candidates) {
    if (best && arc[candidate.index]! - arc[best.index]! > window) {
      corners.push(best.index);
      best = null;
    }
    if (!best || candidate.turn > best.turn) best = candidate;
  }
  if (best) corners.push(best.index);
  return corners;
}

// ── Run smoothing ──

/** Relax and simplify one evenly sampled, corner-free run; its ends stay put. */
function smoothRun(run: StrokePoint[], tolerance: number): StrokePoint[] {
  if (run.length < 3) return run;
  return simplify(relax(run, SMOOTHING_PASSES), tolerance * SIMPLIFY_EPSILON);
}

/** Repeated [1, 2, 1] neighbor averaging with both ends pinned. */
function relax(input: StrokePoint[], passes: number): StrokePoint[] {
  let points = input;
  for (let pass = 0; pass < passes; pass++) {
    const next: StrokePoint[] = [points[0]!];
    for (let i = 1; i < points.length - 1; i++) {
      const [ax, ay] = points[i - 1]!;
      const [bx, by] = points[i]!;
      const [cx, cy] = points[i + 1]!;
      next.push([(ax + 2 * bx + cx) / 4, (ay + 2 * by + cy) / 4]);
    }
    next.push(points[points.length - 1]!);
    points = next;
  }
  return points;
}

/** Evenly spaced points along the polyline, keeping both ends exactly. */
function resample(points: StrokePoint[], spacing: number): StrokePoint[] {
  const arc = cumulativeLengths(points);
  const total = arc[arc.length - 1]!;
  const steps = Math.max(1, Math.round(total / spacing));
  const result: StrokePoint[] = [];
  for (let step = 0; step <= steps; step++) {
    result.push(pointAtLength(points, arc, (total * step) / steps));
  }
  result[result.length - 1] = points[points.length - 1]!;
  return result;
}

/** Ramer–Douglas–Peucker: drop points within `epsilon` of the kept outline. */
function simplify(points: StrokePoint[], epsilon: number): StrokePoint[] {
  if (points.length < 3) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let farthest = -1;
    let farthestDistance = epsilon;
    for (let i = first + 1; i < last; i++) {
      const d = distanceToSegment(points[i]!, points[first]!, points[last]!);
      if (d > farthestDistance) {
        farthest = i;
        farthestDistance = d;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = true;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// ── Path tangents ──

/**
 * Unit tangent for the curve through point `i`, or null to make a sharp
 * join (stroke ends and hard turns).
 */
function tangentAt(points: StrokePoint[], i: number): StrokePoint | null {
  const prev = points[i - 1];
  const point = points[i]!;
  const next = points[i + 1];
  if (!prev || !next) return null;
  if (turnAngle(prev, point, next) > SHARP_JOIN_ANGLE) return null;
  const dx = next[0] - prev[0];
  const dy = next[1] - prev[1];
  const length = Math.hypot(dx, dy);
  return length === 0 ? null : [dx / length, dy / length];
}

// ── Geometry helpers ──

function distance(a: StrokePoint, b: StrokePoint): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function cumulativeLengths(points: StrokePoint[]): number[] {
  const arc = [0];
  for (let i = 1; i < points.length; i++) {
    arc.push(arc[i - 1]! + distance(points[i - 1]!, points[i]!));
  }
  return arc;
}

/** Point at arc length `target` along the polyline (clamped to its ends). */
function pointAtLength(
  points: StrokePoint[],
  arc: number[],
  target: number,
): StrokePoint {
  if (target <= 0) return points[0]!;
  let lo = 0;
  let hi = arc.length - 1;
  if (target >= arc[hi]!) return points[hi]!;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arc[mid]! <= target) lo = mid;
    else hi = mid;
  }
  const span = arc[hi]! - arc[lo]!;
  const t = span === 0 ? 0 : (target - arc[lo]!) / span;
  const [ax, ay] = points[lo]!;
  const [bx, by] = points[hi]!;
  return [ax + (bx - ax) * t, ay + (by - ay) * t];
}

/** Angle (radians, 0..π) the path turns at `b` going from `a` to `c`. */
function turnAngle(a: StrokePoint, b: StrokePoint, c: StrokePoint): number {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const vx = c[0] - b[0];
  const vy = c[1] - b[1];
  const lengths = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (lengths === 0) return 0;
  const cos = (ux * vx + uy * vy) / lengths;
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

function distanceToSegment(
  p: StrokePoint,
  a: StrokePoint,
  b: StrokePoint,
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq),
  );
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Two decimals keeps documents compact with no visible loss. */
function roundPoint([x, y]: StrokePoint): StrokePoint {
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}
