import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createStroke,
  type StrokePoint,
} from "../packages/react-utils/src/editor/stroke-smoothing.ts";

function draw(points: StrokePoint[], tolerance = 1, smoothing = true): StrokePoint[] {
  const stroke = createStroke(points[0]!, tolerance, smoothing);
  for (const point of points.slice(1)) stroke.add(point);
  return stroke.points();
}
const smoothStroke = (points: StrokePoint[], tolerance?: number) => draw(points, tolerance);
const dedupeStroke = (points: StrokePoint[]) => draw(points, 1, false);

/** Deterministic jitter in [-0.5, 0.5). */
function jitter(seed = 1) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647 - 0.5;
}

function wobblyCircle(radius: number, amount: number, turns = 1): StrokePoint[] {
  const rnd = jitter();
  const points: StrokePoint[] = [];
  const count = 200 * turns;
  for (let i = 0; i <= count; i++) {
    const a = (i / 200) * Math.PI * 2;
    points.push([
      radius * Math.cos(a) + rnd() * amount,
      radius * Math.sin(a) + rnd() * amount,
    ]);
  }
  return points;
}

function wobblySquare(size: number, amount: number): StrokePoint[] {
  const rnd = jitter(7);
  const corners: StrokePoint[] = [[0, 0], [size, 0], [size, size], [0, size], [0, 0]];
  const points: StrokePoint[] = [];
  for (let c = 0; c < 4; c++) {
    const [ax, ay] = corners[c]!;
    const [bx, by] = corners[c + 1]!;
    for (let t = 0; t < 50; t++) {
      points.push([
        ax + ((bx - ax) * t) / 50 + rnd() * amount,
        ay + ((by - ay) * t) / 50 + rnd() * amount,
      ]);
    }
  }
  points.push([0, 0]);
  return points;
}

describe("stroke smoothing", () => {
  test("irons out jitter on curves", () => {
    const raw = wobblyCircle(60, 3);
    const smoothed = smoothStroke(raw);
    const radialError = (points: StrokePoint[]) =>
      Math.sqrt(
        points.reduce((sum, [x, y]) => sum + (Math.hypot(x, y) - 60) ** 2, 0) /
          points.length,
      );
    assert.ok(radialError(smoothed) < radialError(raw) * 0.6);
    assert.ok(smoothed.length < raw.length / 3, "stores far fewer points");
  });

  test("keeps deliberate corners sharp and straight sides straight", () => {
    const smoothed = smoothStroke(wobblySquare(100, 2));
    for (const [cx, cy] of [[100, 0], [100, 100], [0, 100]]) {
      const nearest = Math.min(
        ...smoothed.map(([x, y]) => Math.hypot(x - cx!, y - cy!)),
      );
      assert.ok(nearest < 1.5, `corner ${cx},${cy} kept (off by ${nearest})`);
    }
    const topSide = smoothed.filter(([x, y]) => x > 10 && x < 90 && y < 50);
    assert.ok(topSide.every(([, y]) => Math.abs(y) < 1));
  });

  test("starts and ends exactly where the pointer did", () => {
    const raw: StrokePoint[] = [[0, 0], [5, 3], [10, -2], [15, 4], [20, 1], [25, 0]];
    const smoothed = smoothStroke(raw);
    assert.deepEqual(smoothed[0], [0, 0]);
    assert.deepEqual(smoothed[smoothed.length - 1], [25, 0]);
  });

  test("scales its sense of jitter with tolerance (zoom)", () => {
    const raw = wobblyCircle(60, 3);
    // Zoomed in 4x: the same canvas wobble is 4x bigger on screen, so it's detail.
    const zoomedIn = smoothStroke(raw, 0.25);
    assert.ok(zoomedIn.length > smoothStroke(raw, 1).length);
  });

  test("points behind the pointer settle and stop changing", () => {
    const raw = wobblyCircle(200, 3, 5);
    const stroke = createStroke(raw[0]!);
    let previous: StrokePoint[] = [];
    for (const point of raw.slice(1)) {
      stroke.add(point);
      const current = stroke.points();
      // Only a bounded window near the pointer may still move.
      const settled = Math.max(0, previous.length - 40);
      assert.deepEqual(current.slice(0, settled), previous.slice(0, settled));
      previous = current;
    }
    assert.ok(previous.length > 100);
  });

  test("dedupe drops stacked samples but keeps the final point", () => {
    assert.deepEqual(
      dedupeStroke([[0, 0], [0.1, 0], [5, 5], [5.2, 5]]),
      [[0, 0], [5.2, 5]],
    );
    assert.deepEqual(dedupeStroke([[1, 1]]), [[1, 1]]);
  });
});
