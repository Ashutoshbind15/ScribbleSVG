/** A stroke point in canvas coordinates. */
export type StrokePoint = [number, number];

/** Stroke width of freehand pencil strokes, in canvas units. */
export const FREEDRAW_STROKE_WIDTH = 2;

/** Turns sharper than 65° get a sharp join instead of a curve. */
const SHARP_JOIN_COS = Math.cos((65 * Math.PI) / 180);

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
  let out: StrokePoint | null = null;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const length = distance(p1, p2);
    const into = tangentAt(points, i + 1);
    const c1: StrokePoint = out
      ? [p1[0] + (out[0] * length) / 3, p1[1] + (out[1] * length) / 3]
      : p1;
    const c2: StrokePoint = into
      ? [p2[0] - (into[0] * length) / 3, p2[1] - (into[1] * length) / 3]
      : p2;
    d += `C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
    out = into;
  }
  return d;
}

type StrokeBounds = { x: number; y: number; width: number; height: number };

const boundsCache = new WeakMap<readonly StrokePoint[], StrokeBounds>();

/**
 * Axis-aligned box around the stroke's points. Cached per points array, so
 * an edited stroke must get a new array rather than be changed in place.
 */
export function getStrokeBounds(points: StrokePoint[]): StrokeBounds {
  let bounds = boundsCache.get(points);
  if (!bounds) {
    bounds = measureStroke(points);
    boundsCache.set(points, bounds);
  }
  return { ...bounds };
}

function measureStroke(points: StrokePoint[]): StrokeBounds {
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
  if (turnCos(prev, point, next) < SHARP_JOIN_COS) return null;
  const dx = next[0] - prev[0];
  const dy = next[1] - prev[1];
  const length = Math.hypot(dx, dy);
  return length === 0 ? null : [dx / length, dy / length];
}

// ── Geometry helpers ──

function distance(a: StrokePoint, b: StrokePoint): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Cosine of the turn at `b` going from `a` to `c`: 1 is straight on. */
function turnCos(a: StrokePoint, b: StrokePoint, c: StrokePoint): number {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const vx = c[0] - b[0];
  const vy = c[1] - b[1];
  const lengths = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  return lengths === 0 ? 1 : (ux * vx + uy * vy) / lengths;
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}
