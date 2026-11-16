import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMPTY_DOCUMENT,
  getContentBounds,
  type DiagramDocument,
  type RectangleElement,
} from "@scribblesvg/core";
import {
  canvasReducer,
  type CanvasState,
} from "../packages/react-utils/src/editor/useCanvasReducer.ts";
import { fitViewport } from "../packages/react-utils/src/editor/zoom.ts";

const rect: RectangleElement = {
  type: "rectangle",
  id: "r",
  seed: 1,
  x: 0,
  y: 0,
  width: 2000,
  height: 1000,
};

function stateWith(
  overrides: Partial<CanvasState> = {},
  document: DiagramDocument = { ...EMPTY_DOCUMENT, elements: [rect] },
): CanvasState {
  return {
    document,
    selectedIds: new Set(),
    tool: "select",
    activeIconId: null,
    past: [],
    future: [],
    historyBatchDepth: 0,
    size: { width: 800, height: 600 },
    fitPending: false,
    ...overrides,
  };
}

test("RESIZE stores the size and keeps the viewport", () => {
  const state = stateWith();
  const next = canvasReducer(state, {
    type: "RESIZE",
    size: { width: 1024, height: 768 },
  });
  assert.deepEqual(next.size, { width: 1024, height: 768 });
  assert.equal(next.document.viewport, state.document.viewport);
});

test("RESIZE to the same size changes nothing", () => {
  const state = stateWith();
  assert.equal(
    canvasReducer(state, { type: "RESIZE", size: { width: 800, height: 600 } }),
    state,
  );
});

test("a pending fit waits for a non-empty size, then fits once", () => {
  let state = stateWith({ fitPending: true });
  const viewport = state.document.viewport;

  state = canvasReducer(state, { type: "RESIZE", size: { width: 0, height: 0 } });
  assert.equal(state.fitPending, true);
  assert.equal(state.document.viewport, viewport);

  const size = { width: 1000, height: 500 };
  state = canvasReducer(state, { type: "RESIZE", size });
  assert.equal(state.fitPending, false);
  assert.deepEqual(
    state.document.viewport,
    fitViewport(getContentBounds([rect]), size),
  );
  assert.ok(state.document.viewport.zoom < 1);

  // Later resizes keep whatever viewport the user has
  const fitted = state.document.viewport;
  state = canvasReducer(state, { type: "RESIZE", size: { width: 400, height: 300 } });
  assert.equal(state.document.viewport, fitted);
});

test("a pending fit still runs when the first size matches the initial guess", () => {
  const state = canvasReducer(stateWith({ fitPending: true }), {
    type: "RESIZE",
    size: { width: 800, height: 600 },
  });
  assert.equal(state.fitPending, false);
  assert.ok(state.document.viewport.zoom < 1);
});

test("a pending fit frames the document loaded before the first size", () => {
  const moved = { ...rect, x: 5000, y: 5000, width: 100, height: 100 };
  let state = stateWith({ fitPending: true });
  state = canvasReducer(state, {
    type: "SET_DOCUMENT",
    document: { ...EMPTY_DOCUMENT, elements: [moved] },
  });
  state = canvasReducer(state, { type: "RESIZE", size: { width: 800, height: 600 } });
  assert.deepEqual(state.document.viewport, { x: 5050, y: 5050, zoom: 1 });
});

test("a fit is not an undo step", () => {
  const state = canvasReducer(stateWith({ fitPending: true }), {
    type: "RESIZE",
    size: { width: 1000, height: 500 },
  });
  assert.equal(state.past.length, 0);
});
