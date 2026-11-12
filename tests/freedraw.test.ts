import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getElementBounds,
  getElementConnectionPoints,
  getElementRoughPaths,
  getStrokePathData,
  isBindable,
  isDiagramDocument,
  smoothStroke,
  dedupeStroke,
  type FreedrawElement,
  type StrokePoint,
} from "@scribblesvg/core";
import {
  hitTestMarquee,
  hitTestSelection,
} from "../packages/react-utils/src/editor/hit-test.ts";
import { translateElement } from "../packages/react-utils/src/editor/clipboard.ts";
import {
  getGroupScalePatches,
  getMinGroupScale,
} from "../packages/react-utils/src/editor/group-scale.ts";
import { canvasReducer } from "../packages/react-utils/src/editor/useCanvasReducer.ts";

/** Deterministic jitter in [-0.5, 0.5). */
function jitter(seed = 1) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647 - 0.5;
}

function wobblyCircle(radius: number, amount: number): StrokePoint[] {
  const rnd = jitter();
  const points: StrokePoint[] = [];
  for (let i = 0; i <= 200; i++) {
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

function stroke(points: StrokePoint[], id = "stroke"): FreedrawElement {
  return { id, type: "freedraw", seed: 1, points };
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

  test("dedupe drops stacked samples but keeps the final point", () => {
    assert.deepEqual(
      dedupeStroke([[0, 0], [0.1, 0], [5, 5], [5.2, 5]]),
      [[0, 0], [5.2, 5]],
    );
    assert.deepEqual(dedupeStroke([[1, 1]]), [[1, 1]]);
  });
});

describe("stroke path data", () => {
  test("a single point draws a dot", () => {
    assert.match(getStrokePathData([[10, 20]]), /^M10 20L10\.01 20$/);
  });

  test("curves through every point", () => {
    const d = getStrokePathData([[0, 0], [10, 5], [20, 0]]);
    assert.match(d, /^M0 0C/);
    assert.equal((d.match(/C/g) ?? []).length, 2);
    assert.ok(d.endsWith(" 20 0"));
  });

  test("rendered as an unfilled freehand path", () => {
    const [path] = getElementRoughPaths(stroke([[0, 0], [10, 10]]));
    assert.equal(path?.freehand, true);
    assert.equal(path?.fill, "none");
  });
});

describe("freedraw elements", () => {
  test("validates in documents", () => {
    const doc = (points: unknown) => ({
      version: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
      elements: [{ id: "s", type: "freedraw", seed: 1, points }],
    });
    assert.equal(isDiagramDocument(doc([[0, 0], [1, 2]])), true);
    assert.equal(isDiagramDocument(doc([])), false);
    assert.equal(isDiagramDocument(doc([[0, Number.NaN]])), false);
    assert.equal(isDiagramDocument(doc([[0, 1, 2]])), false);
  });

  test("bounds hug the points and connectors don't attach", () => {
    const el = stroke([[10, 20], [40, 5], [25, 60]]);
    assert.deepEqual(getElementBounds(el), { x: 10, y: 5, width: 30, height: 55 });
    assert.equal(isBindable(el), false);
    assert.deepEqual(getElementConnectionPoints(el), []);
  });

  test("selects on the ink, not the empty box around it", () => {
    const el = stroke([[0, 0], [100, 100]]);
    assert.equal(hitTestSelection({ x: 50, y: 52 }, [el], 1), el);
    assert.equal(hitTestSelection({ x: 90, y: 10 }, [el], 1), null);
  });

  test("marquee picks it only when the box touches the ink", () => {
    const el = stroke([[0, 0], [100, 100]]);
    assert.deepEqual(hitTestMarquee({ x: 40, y: 40, width: 20, height: 20 }, [el]), [el]);
    assert.deepEqual(hitTestMarquee({ x: 70, y: 0, width: 20, height: 20 }, [el]), []);
  });

  test("moves and scales with the rest of a selection", () => {
    const el = stroke([[0, 0], [10, 20]]);
    assert.deepEqual(translateElement(el, 5, -5).points, [[5, -5], [15, 15]]);
    const [update] = getGroupScalePatches([el], { x: 0, y: 0 }, 2);
    assert.deepEqual((update!.patch as FreedrawElement).points, [[0, 0], [20, 40]]);
  });

  test("a thin stroke doesn't block shrinking its group", () => {
    const flat = stroke([[0, 0], [200, 1]]);
    assert.ok(getMinGroupScale([flat]) < 0.1);
  });
});

describe("pencil smoothing setting", () => {
  test("toggles in the reducer", () => {
    const state = canvasReducer(
      {
        document: { version: 1, viewport: { x: 0, y: 0, zoom: 1 }, elements: [] },
        selectedIds: new Set(),
        tool: "pencil",
        activeIconId: null,
        pencilSmoothing: true,
        past: [],
        future: [],
        historyBatchDepth: 0,
      },
      { type: "SET_PENCIL_SMOOTHING", enabled: false },
    );
    assert.equal(state.pencilSmoothing, false);
    assert.equal(state.tool, "pencil");
  });
});
