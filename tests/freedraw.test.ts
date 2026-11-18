import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getElementBounds,
  getElementConnectionPoints,
  getElementRoughPaths,
  isBindable,
  isDiagramDocument,
  type FreedrawElement,
} from "@scribblesvg/core";
import { getStrokePathData } from "../packages/core/freedraw.ts";
import {
  hitTestMarquee,
  hitTestSelection,
} from "../packages/react-utils/src/editor/hit-test.ts";
import { translateElement } from "../packages/react-utils/src/editor/clipboard.ts";
import {
  getGroupScalePatches,
  getMinGroupScale,
} from "../packages/react-utils/src/editor/group-scale.ts";
import { startDrag, dragPatches } from "../packages/react-utils/src/editor/drag.ts";
import { startResize, resizePatches } from "../packages/react-utils/src/editor/resize.ts";
import {
  canvasReducer,
  type CanvasState,
} from "../packages/react-utils/src/editor/useCanvasReducer.ts";
import { cancelOnEscape } from "../packages/react-utils/src/editor/gesture.ts";
import { drawPatch, startDraw } from "../packages/react-utils/src/editor/draw.ts";

function stroke(points: FreedrawElement["points"], id = "stroke"): FreedrawElement {
  return { id, type: "freedraw", seed: 1, points };
}

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

  test("bounds follow moved points and ignore changes to a returned box", () => {
    const el = stroke([[0, 0], [10, 20]]);
    const bounds = getElementBounds(el);
    bounds.width = 999;
    assert.deepEqual(getElementBounds(el), { x: 0, y: 0, width: 10, height: 20 });
    assert.deepEqual(getElementBounds(translateElement(el, 5, 5)), { x: 5, y: 5, width: 10, height: 20 });
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

  test("drags and resizes from its start snapshot", () => {
    const el = stroke([[0, 0], [10, 20]]);
    const drag = startDrag([el], [el.id], { x: 0, y: 0 });
    dragPatches(drag, { x: 50, y: 50 });
    assert.deepEqual(dragPatches(drag, { x: 5, y: -5 })[0]!.patch, { points: [[5, -5], [15, 15]] });

    const resize = startResize([el], el.id, "se", { x: 10, y: 20 })!;
    assert.deepEqual(resizePatches(resize, { x: 30, y: 60 })[0]!.patch, { points: [[0, 0], [30, 60]] });
  });

  test("a straight stroke moves along its flat side when resized", () => {
    const flat = stroke([[0, 10], [100, 10]]);
    const resize = startResize([flat], flat.id, "e", { x: 100, y: 10 })!;
    assert.deepEqual(resizePatches(resize, { x: 200, y: 10 })[0]!.patch, { points: [[0, 10], [200, 10]] });
  });

  test("a stroke smaller than the shape minimum doesn't jump when resized", () => {
    const tick = stroke([[0, 0], [6, 4]]);
    const se = startResize([tick], tick.id, "se", { x: 6, y: 4 })!;
    assert.deepEqual(resizePatches(se, { x: 6, y: 4 })[0]!.patch, { points: [[0, 0], [6, 4]] });
    assert.deepEqual(resizePatches(se, { x: 9, y: 6 })[0]!.patch, { points: [[0, 0], [9, 6]] });
    // Shrinking stops at its starting size, not at the shape minimum.
    assert.deepEqual(resizePatches(se, { x: 0, y: 0 })[0]!.patch, { points: [[0, 0], [6, 4]] });

    const dot = stroke([[5, 5]]);
    const nw = startResize([dot], dot.id, "nw", { x: 5, y: 5 })!;
    assert.deepEqual(resizePatches(nw, { x: 5, y: 5 })[0]!.patch, { points: [[5, 5]] });
  });

  test("a thin stroke doesn't block shrinking its group", () => {
    const flat = stroke([[0, 0], [200, 1]]);
    assert.ok(getMinGroupScale([flat]) < 0.1);
  });
});

describe("pencil", () => {
  const shape = { id: "r", type: "rectangle", seed: 1, x: 0, y: 0, width: 10, height: 10 } as const;
  const base: CanvasState = {
    document: { version: 1, viewport: { x: 0, y: 0, zoom: 1 }, elements: [shape] },
    selectedIds: new Set(["r"]),
    tool: "pencil",
    activeIconId: null,
    pencilSmoothing: true,
    past: [],
    future: [],
    historyBatchDepth: 0,
    size: { width: 800, height: 600 },
    fitPending: false,
  };

  // The dispatches the pencil makes: press, two moves, then release or Escape.
  function drawStroke(end: "END_HISTORY" | "CANCEL_HISTORY"): CanvasState {
    const element = stroke([[0, 0]], "s");
    const session = startDraw(element, 1, false);
    let state = canvasReducer(base, { type: "BEGIN_HISTORY" });
    state = canvasReducer(state, { type: "PLACE_ELEMENT", element, select: false });
    for (const point of [{ x: 5, y: 5 }, { x: 10, y: 0 }]) {
      state = canvasReducer(state, { type: "UPDATE_ELEMENT", id: "s", patch: drawPatch(session, [point]) });
    }
    return canvasReducer(state, { type: end });
  }

  test("a released stroke is one undo step", () => {
    let state = drawStroke("END_HISTORY");
    assert.deepEqual((state.document.elements[1] as FreedrawElement).points, [[0, 0], [5, 5], [10, 0]]);
    assert.equal(state.selectedIds.size, 0);

    state = canvasReducer(state, { type: "UNDO" });
    assert.deepEqual(state.document.elements, [shape]);
    assert.deepEqual([...state.selectedIds], ["r"]);
  });

  test("Escape drops the stroke and leaves nothing to undo", () => {
    const state = drawStroke("CANCEL_HISTORY");
    assert.deepEqual(state.document.elements, [shape]);
    assert.deepEqual([...state.selectedIds], ["r"]);
    assert.equal(state.past.length, 0);

    const drawing = { type: "drawing", ...startDraw(stroke([[0, 0]], "s"), 1, true) } as const;
    assert.deepEqual(cancelOnEscape(drawing), { type: "cancelled" });
  });
});
