/**
 * Turns pointer samples into the points a freedraw element stores, while the
 * stroke is drawn. Every distance is a multiple of `tolerance`: one screen
 * pixel in canvas units (`1 / zoom`), so smoothing feels the same at any zoom.
 *
 * The stages stream: dedupe → resample every 2 px → find deliberate corners
 * → smooth each run between corners → simplify. Each stage looks only a fixed
 * number of points ahead, so the points well behind the pointer are final:
 * they are computed once and kept. Adding a sample costs amortized O(1), and
 * `points()` costs O(output), however long the stroke gets.
 */

/** A stroke point in canvas coordinates. */
export type StrokePoint = [number, number];

export interface Stroke {
  add(point: StrokePoint): void;
  /** The points to store if the stroke ended now. */
  points(): StrokePoint[];
}

// ── Tuning (distances are multiples of `tolerance`) ──

/** Samples closer than this to the previous one carry no shape information. */
const DEDUPE_DISTANCE = 0.5;
/** Spacing the stroke is resampled to, so later stages count in arc length. */
const RESAMPLE_SPACING = 2;
/** Resampled points looked back and ahead when measuring a turn (8 px). */
const CORNER_SPAN = 4;
/** A turn sharper than 60° over the span is a deliberate corner. */
const CORNER_COS = Math.cos(Math.PI / 3);
/** Neighbour-averaging passes on each run; more passes iron out larger wobbles. */
const SMOOTHING_PASSES = 10;
/** Lighter passes on the copy used to find corners, so wobble isn't a corner. */
const DETECTION_PASSES = 3;
/** Max deviation allowed when dropping redundant points after smoothing. */
const SIMPLIFY_EPSILON = 0.4;
/** Final points are settled in batches, so the windowed work is amortized. */
const CHUNK = 16;

/**
 * A stroke that smooths as it grows. With `smoothing` off, samples are only
 * de-duplicated. Corners are kept exactly, so boxes and letters keep their
 * points while curves come out clean. The stroke starts and ends exactly
 * under the pointer.
 */
export function createStroke(start: StrokePoint, tolerance = 1, smoothing = true): Stroke {
  const minGap = tolerance * DEDUPE_DISTANCE;
  const spacing = tolerance * RESAMPLE_SPACING;
  const epsilon = tolerance * SIMPLIFY_EPSILON;

  const samples: StrokePoint[] = [start];
  let tip = start;

  // Settled state. Indices are into `even`, the resampled stroke.
  const even: StrokePoint[] = [start];
  let carry = 0;
  const detect: StrokePoint[] = [];
  const scan: CornerScan = { next: CORNER_SPAN, best: null };
  /** Run starts: the stroke start, then each confirmed corner. */
  const corners = [0];
  const cone = openCone(start);
  const kept: StrokePoint[] = [roundPoint(start)];
  let smoothed = 1;

  function settle() {
    // A relaxed point is final once its window stops short of the moving end.
    const detectEnd = even.length - 1 - DETECTION_PASSES;
    if (detectEnd - detect.length >= CHUNK) {
      detect.push(...relaxRange(even, detect.length, detectEnd, DETECTION_PASSES, 0, even.length - 1));
    }
    for (; scan.next < detect.length - CORNER_SPAN; scan.next++) {
      scanCorner(scan, detect, scan.next, corners);
    }
    // Every corner below `decided` is known; an open turn may still move.
    const decided = scan.best ? scan.best.index : scan.next;
    const smoothEnd = decided - SMOOTHING_PASSES;
    if (smoothEnd - smoothed >= CHUNK) {
      smoothInto(even, smoothed, smoothEnd, corners, cone, epsilon, kept);
      smoothed = smoothEnd;
    }
  }

  function deduped(): StrokePoint[] {
    const result = samples.map(roundPoint);
    if (samples.length > 1) result[result.length - 1] = roundPoint(tip);
    return result;
  }

  return {
    add(point) {
      tip = point;
      const last = samples[samples.length - 1]!;
      if (distance(point, last) < minGap) return;
      samples.push(point);
      if (!smoothing) return;
      carry = walk(last, point, carry, spacing, even);
      settle();
    },

    points() {
      if (!smoothing || samples.length < 3) return deduped();

      // Everything from `base` on is provisional, worked out as if the stroke
      // ended at `tip`. It is a bounded window behind the pointer.
      const base = Math.max(0, smoothed - SMOOTHING_PASSES);
      const tail = even.slice(base);
      const last = samples[samples.length - 1]!;
      walk(last, tip, carry, spacing, tail);
      const end = tail[tail.length - 1]!;
      if (end[0] !== tip[0] || end[1] !== tip[1]) tail.push(tip);
      if (base === 0 && tail.length < 3) return tail.map(roundPoint);
      const lastIndex = tail.length - 1;

      const settledDetect = detect.length - base;
      const tailDetect = detect
        .slice(base)
        .concat(relaxRange(tail, settledDetect, tail.length, DETECTION_PASSES, -base, lastIndex));
      const tailScan: CornerScan = {
        next: scan.next - base,
        best: scan.best && { ...scan.best, index: scan.best.index - base },
      };
      const runStarts = [corners[upperBound(corners, smoothed) - 1]! - base];
      for (const corner of corners) if (corner > smoothed) runStarts.push(corner - base);
      for (; tailScan.next <= lastIndex - CORNER_SPAN; tailScan.next++) {
        scanCorner(tailScan, tailDetect, tailScan.next, runStarts);
      }
      if (tailScan.best) runStarts.push(tailScan.best.index);

      const out = kept.slice();
      smoothInto(tail, smoothed - base, tail.length, runStarts, { ...cone }, epsilon, out);
      return out;
    },
  };
}

// ── Resampling ──

/**
 * Append a point every `spacing` along a→b, `carry` past the last one, and
 * return the new carry.
 */
function walk(a: StrokePoint, b: StrokePoint, carry: number, spacing: number, out: StrokePoint[]): number {
  const length = distance(a, b);
  let at = spacing - carry;
  for (; at <= length; at += spacing) {
    const t = at / length;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return length - (at - spacing);
}

// ── Relaxing ──

/**
 * `relax(points[lo..hi], passes)` at indices [from, to), reading only
 * `passes` points either side. `lo` and `hi` are the run's pinned ends. A
 * cut anywhere else only disturbs the values within `passes` of it, which
 * the padding keeps outside [from, to).
 */
function relaxRange(
  points: StrokePoint[],
  from: number,
  to: number,
  passes: number,
  lo: number,
  hi: number,
): StrokePoint[] {
  if (to <= from) return [];
  const first = Math.max(lo, from - passes, 0);
  const last = Math.min(hi, to - 1 + passes);
  return relax(points.slice(first, last + 1), passes).slice(from - first, to - first);
}

/** Repeated [1, 2, 1] neighbour averaging with both ends pinned. */
function relax(input: StrokePoint[], passes: number): StrokePoint[] {
  let points = input;
  for (let pass = 0; pass < passes && points.length > 2; pass++) {
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

// ── Corners ──

type CornerScan = { next: number; best: { index: number; cos: number } | null };

/**
 * Look at the turn through `points[i]`. A corner is the sharpest point of a
 * sustained turn; it is confirmed once the scan is `CORNER_SPAN` past it,
 * since no later point can belong to the same turn.
 */
function scanCorner(scan: CornerScan, points: StrokePoint[], i: number, corners: number[]): void {
  const cos = turnCos(points[i - CORNER_SPAN]!, points[i]!, points[i + CORNER_SPAN]!);
  if (cos < CORNER_COS && (!scan.best || cos < scan.best.cos)) scan.best = { index: i, cos };
  if (scan.best && i - scan.best.index >= CORNER_SPAN) {
    corners.push(scan.best.index);
    scan.best = null;
  }
}

// ── Smoothing runs ──

/**
 * Smooth `points` at indices [from, to) and feed them to the simplifier.
 * Each run between corners is relaxed on its own with its ends pinned; a run
 * with no corner after it runs to the last point.
 */
function smoothInto(
  points: StrokePoint[],
  from: number,
  to: number,
  runStarts: number[],
  cone: Cone,
  epsilon: number,
  out: StrokePoint[],
): void {
  let run = upperBound(runStarts, from) - 1;
  for (let start = from; start < to; ) {
    const lo = runStarts[run]!;
    const hi = run + 1 < runStarts.length ? runStarts[run + 1]! : points.length - 1;
    const stop = Math.min(to, hi + 1);
    const values = relaxRange(points, start, stop, SMOOTHING_PASSES, lo, hi);
    for (let j = 0; j < values.length; j++) {
      const i = start + j;
      simplifyStep(cone, values[j]!, epsilon, out, i === lo || i === hi);
    }
    if (stop === hi + 1) run++;
    start = stop;
  }
}

// ── Simplifying ──

/**
 * Streaming simplification (Sklansky–Gonzalez cone intersection). From the
 * last kept point, `lo..hi` is the range of directions (relative to `ref`)
 * a segment can take and still pass within epsilon of every point since.
 */
type Cone = { anchor: StrokePoint; last: StrokePoint; ref: number; lo: number; hi: number; open: boolean };

function openCone(anchor: StrokePoint): Cone {
  return { anchor, last: anchor, ref: 0, lo: 0, hi: 0, open: false };
}

function simplifyStep(cone: Cone, point: StrokePoint, epsilon: number, out: StrokePoint[], keep: boolean): void {
  const d = distance(cone.anchor, point);
  if (d > epsilon) {
    const angle = Math.atan2(point[1] - cone.anchor[1], point[0] - cone.anchor[0]);
    const half = Math.asin(epsilon / d);
    if (!cone.open) {
      Object.assign(cone, { ref: angle, lo: -half, hi: half, open: true });
    } else {
      const theta = wrapAngle(angle - cone.ref);
      if (theta < cone.lo || theta > cone.hi) {
        emit(cone, cone.last, out);
        simplifyStep(cone, point, epsilon, out, keep);
        return;
      }
      cone.lo = Math.max(cone.lo, theta - half);
      cone.hi = Math.min(cone.hi, theta + half);
    }
  }
  cone.last = point;
  if (keep) emit(cone, point, out);
}

function emit(cone: Cone, point: StrokePoint, out: StrokePoint[]): void {
  out.push(roundPoint(point));
  Object.assign(cone, openCone(point));
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

function wrapAngle(a: number): number {
  return a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a;
}

/** Index of the first value greater than `value` in a sorted array. */
function upperBound(sorted: number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Two decimals keeps documents compact with no visible loss. */
function roundPoint([x, y]: StrokePoint): StrokePoint {
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}
