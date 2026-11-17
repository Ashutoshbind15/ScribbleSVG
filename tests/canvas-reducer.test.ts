import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMPTY_DOCUMENT,
  getContentBounds,
  type DiagramDocument,
  type RectangleElement,
} from "@scribblesvg/core";
import { canvasToScreen } from "../packages/react-utils/src/editor/coordinate-utils.ts";
import {
  canvasReducer,
  type CanvasState,
} from "../packages/react-utils/src/editor/useCanvasReducer.ts";
import { MAX_ZOOM, fitViewport } from "../packages/react-utils/src/editor/zoom.ts";

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);

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

test("ZOOM_AT keeps the canvas point under the pointer in place", () => {
  const state = stateWith({}, { ...EMPTY_DOCUMENT, viewport: { x: 100, y: 50, zoom: 1 } });
  const screenPoint = { x: 600, y: 150 };
  const next = canvasReducer(state, { type: "ZOOM_AT", factor: 2, screenPoint });
  assert.equal(next.document.viewport.zoom, 2);
  // (600, 150) on screen is canvas (300, -100) before and after
  const after = canvasToScreen(300, -100, next.document.viewport, state.size);
  close(after.x, screenPoint.x);
  close(after.y, screenPoint.y);
});

test("ZOOM_AT clamps to the zoom limits", () => {
  const state = stateWith({}, { ...EMPTY_DOCUMENT, viewport: { x: 0, y: 0, zoom: 4 } });
  const next = canvasReducer(state, {
    type: "ZOOM_AT",
    factor: 10,
    screenPoint: { x: 0, y: 0 },
  });
  assert.equal(next.document.viewport.zoom, MAX_ZOOM);
});

test("successive ZOOM_ATs compound", () => {
  let state = stateWith();
  for (let i = 0; i < 3; i++) {
    state = canvasReducer(state, { type: "ZOOM_AT", factor: 1.1, screenPoint: { x: 400, y: 300 } });
  }
  close(state.document.viewport.zoom, 1.1 ** 3);
});

test("PAN_BY moves the viewport by screen pixels at the current zoom", () => {
  const state = stateWith({}, { ...EMPTY_DOCUMENT, viewport: { x: 10, y: 20, zoom: 2 } });
  const next = canvasReducer(state, { type: "PAN_BY", dx: 40, dy: -10 });
  assert.deepEqual(next.document.viewport, { x: 30, y: 15, zoom: 2 });
  assert.equal(next.past.length, 0);
});

const image = {
  type: "image" as const,
  id: "img",
  seed: 7,
  src: "photo.png",
  naturalWidth: 400,
  naturalHeight: 200,
};

test("INSERT_IMAGE centres the image, selects it and returns to the select tool", () => {
  const state = stateWith(
    { tool: "icon", activeIconId: "db", selectedIds: new Set(["r"]) },
    { ...EMPTY_DOCUMENT, elements: [rect], viewport: { x: 1000, y: 500, zoom: 1 } },
  );
  const next = canvasReducer(state, { type: "INSERT_IMAGE", image });
  const inserted = next.document.elements.at(-1);
  // Half the visible 800×600 is 400×300, so a 400×200 image keeps its size
  assert.deepEqual(inserted, { ...image, x: 800, y: 400, width: 400, height: 200 });
  assert.deepEqual(Array.from(next.selectedIds), ["img"]);
  assert.equal(next.tool, "select");
  assert.equal(next.activeIconId, null);

  const undone = canvasReducer(next, { type: "UNDO" });
  assert.deepEqual(undone.document.elements, [rect]);
  assert.deepEqual(Array.from(undone.selectedIds), ["r"]);
});

test("INSERT_IMAGE scales a large image down to half the visible area", () => {
  const state = stateWith({}, { ...EMPTY_DOCUMENT, viewport: { x: 0, y: 0, zoom: 2 } });
  const next = canvasReducer(state, {
    type: "INSERT_IMAGE",
    image: { ...image, naturalWidth: 4000, naturalHeight: 2000 },
  });
  const inserted = next.document.elements[0];
  // Visible area at 200% is 400×300; half of it is 200×150
  assert.deepEqual(
    inserted && { x: inserted.x, y: inserted.y, width: inserted.width, height: inserted.height },
    { x: -100, y: -50, width: 200, height: 100 },
  );
});

test("INSERT_IMAGE skips an image that fails validation", () => {
  const state = stateWith();
  const next = canvasReducer(state, {
    type: "INSERT_IMAGE",
    image: { ...image, src: "javascript:alert(1)" },
  });
  assert.equal(next, state);
});

for (const grouped of [false, true]) {
  test(`placement restores elements and selection on undo (grouped=${grouped})`, () => {
    const initial = stateWith({ selectedIds: new Set([rect.id]), tool: "rectangle" });
    let state = grouped ? canvasReducer(initial, { type: "BEGIN_HISTORY" }) : initial;
    state = canvasReducer(state, { type: "PLACE_ELEMENT", element: { ...rect, id: "new" } });
    assert.equal(state.tool, "select");
    assert.deepEqual([...state.selectedIds], ["new"]);
    if (grouped) {
      state = canvasReducer(state, { type: "UPDATE_ELEMENT", id: "new", patch: { x: 100 } });
      state = canvasReducer(state, { type: "END_HISTORY" });
    }
    assert.equal(state.past.length, 1);
    state = canvasReducer(state, { type: "UNDO" });
    assert.deepEqual(state.document.elements, initial.document.elements);
    assert.deepEqual(state.selectedIds, initial.selectedIds);
    assert.deepEqual([...canvasReducer(state, { type: "REDO" }).selectedIds], ["new"]);
  });
}

test("bulk movement reanchors current bound endpoints in one history group", () => {
  const arrow = { type: "arrow" as const, id: "a", seed: 1, startX: 2000, startY: 500, endX: 3000, endY: 500, startBinding: "r" };
  const free = { ...arrow, id: "free", startBinding: undefined };
  const initial = stateWith({}, { ...EMPTY_DOCUMENT, elements: [rect, arrow, free] });
  let state = canvasReducer(initial, { type: "BEGIN_HISTORY" });
  for (const x of [100, 200]) {
    state = canvasReducer(state, { type: "UPDATE_ELEMENTS", updates: [{ id: "r", patch: { x } }], reanchor: true });
    const bound = state.document.elements[1] as typeof arrow;
    assert.equal(bound.startX, 2000 + x);
    assert.equal(bound.startY, 500);
    assert.equal(state.document.elements[2], free);
  }
  state = canvasReducer(state, { type: "END_HISTORY" });
  assert.equal(state.past.length, 1);
  assert.deepEqual(canvasReducer(state, { type: "UNDO" }).document.elements, initial.document.elements);
});

test("an anchor update from an older render can overwrite the last move", async () => {
  const { getBoundArrowAnchorUpdates } = await import("../packages/react-utils/src/editor/arrowAnchors.ts");
  const arrow = { type: "arrow" as const, id: "a", seed: 1, startX: 2000, startY: 500, endX: 3000, endY: 500, startBinding: "r" };
  const old = stateWith({}, { ...EMPTY_DOCUMENT, elements: [rect, arrow] });
  const moved = canvasReducer(old, { type: "UPDATE_ELEMENTS", updates: [{ id: "r", patch: { x: 200 } }], reanchor: true });
  const staleRelease = canvasReducer(moved, { type: "UPDATE_ELEMENTS", updates: getBoundArrowAnchorUpdates(new Set(["r"]), old.document.elements) });
  assert.equal((moved.document.elements[1] as typeof arrow).startX, 2200);
  assert.equal((staleRelease.document.elements[1] as typeof arrow).startX, 2000);
  assert.equal((canvasReducer(moved, { type: "END_HISTORY" }).document.elements[1] as typeof arrow).startX, 2200);
});
