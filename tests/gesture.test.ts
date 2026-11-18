import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLICK_SLOP_PX,
  IDLE,
  cancelOnEscape,
  clickEditTarget,
  creationPatch,
  gestureCursor,
  getMarqueeBounds,
  moveMarquee,
  panViewport,
  type Gesture,
} from "../packages/react-utils/src/editor/gesture.ts";

const dragSession = { startCanvasPoint: { x: 0, y: 0 }, originalElements: [] };
const resizeSession = {
  kind: "group" as const, ids: new Set<string>(), startCanvasPoint: { x: 0, y: 0 },
  startBounds: { x: 0, y: 0, width: 100, height: 100 },
  anchor: { x: 0, y: 0 }, minScale: 0.2, originalElements: [],
};

const marquee: Gesture = {
  type: "marqueeing",
  startPoint: { x: 10, y: 10 },
  currentPoint: { x: 10, y: 10 },
  screenStart: { x: 100, y: 100 },
  additive: false,
};

test("the marquee follows the pointer and its bounds are derived from it", () => {
  const moved = moveMarquee(marquee, { x: -20, y: 50 });
  assert.deepEqual(getMarqueeBounds(moved), { x: -20, y: 10, width: 30, height: 40 });
  assert.equal(getMarqueeBounds(IDLE), null);
});

test("moving the pointer only changes a marquee", () => {
  const dragging: Gesture = { type: "dragging", ...dragSession, pendingEdit: null };
  assert.equal(moveMarquee(dragging, { x: 1, y: 1 }), dragging);
  assert.equal(moveMarquee(IDLE, { x: 1, y: 1 }), IDLE);
});

test("Escape drops a marquee until release and leaves other gestures alone", () => {
  const cancelled = cancelOnEscape(moveMarquee(marquee, { x: 50, y: 50 }));
  assert.deepEqual(cancelled, { type: "cancelled" });
  assert.equal(getMarqueeBounds(cancelled), null);
  assert.equal(moveMarquee(cancelled, { x: 60, y: 60 }), cancelled);
  assert.equal(gestureCursor(cancelled), "crosshair");

  const resizing: Gesture = { type: "resizing", ...resizeSession, handle: "nw" };
  assert.equal(cancelOnEscape(resizing), resizing);
  assert.equal(cancelOnEscape(IDLE), IDLE);
});

test("panning moves the viewport against the pointer, scaled by zoom", () => {
  const panning = {
    type: "panning" as const,
    screenStart: { x: 100, y: 100 },
    viewportStart: { x: 0, y: 0 },
  };
  assert.deepEqual(
    panViewport(panning, { x: 999, y: 999, zoom: 2 }, { x: 140, y: 80 }),
    { x: -20, y: 10, zoom: 2 },
  );
});

test("creating drags out a box from the start point either way, with a minimum size", () => {
  const creating = {
    type: "creating" as const,
    elementType: "rectangle" as const,
    elementId: "r",
    startPoint: { x: 100, y: 100 },
  };
  assert.deepEqual(creationPatch(creating, { x: 40, y: 160 }), {
    x: 40,
    y: 100,
    width: 60,
    height: 60,
  });
  assert.deepEqual(creationPatch(creating, { x: 105, y: 95 }), {
    x: 100,
    y: 95,
    width: 20,
    height: 20,
  });
});

test("creating a circle sets its radius from the start point", () => {
  const creating = {
    type: "creating" as const,
    elementType: "circle" as const,
    elementId: "c",
    startPoint: { x: 0, y: 0 },
  };
  assert.deepEqual(creationPatch(creating, { x: 30, y: 40 }), { cx: 0, cy: 0, radius: 50 });
  assert.deepEqual(creationPatch(creating, { x: 1, y: 1 }), { cx: 0, cy: 0, radius: 10 });
});

test("a drag's release opens the text editor only for a click on the sole selection", () => {
  const press = { type: "dragging" as const, ...dragSession, pendingEdit: { elementId: "a", screenStart: { x: 0, y: 0 } } };
  assert.equal(clickEditTarget(press, { x: 1, y: 1 }), "a");
  assert.equal(clickEditTarget(press, { x: CLICK_SLOP_PX, y: 0 }), null);
  assert.equal(clickEditTarget({ type: "dragging", ...dragSession, pendingEdit: null }, { x: 0, y: 0 }), null);
});

test("each gesture sets its cursor; idle and creating defer to the tool", () => {
  assert.equal(gestureCursor({ type: "panning", screenStart: { x: 0, y: 0 }, viewportStart: { x: 0, y: 0 } }), "grabbing");
  assert.equal(gestureCursor({ type: "resizing", ...resizeSession, handle: "e" }), "ew-resize");
  assert.equal(gestureCursor({ type: "dragging", ...dragSession, pendingEdit: null }), "move");
  assert.equal(gestureCursor(marquee), "crosshair");
  assert.equal(gestureCursor(IDLE), null);
  assert.equal(
    gestureCursor({ type: "creating", elementType: "icon", elementId: "i", startPoint: { x: 0, y: 0 } }),
    null,
  );
});
