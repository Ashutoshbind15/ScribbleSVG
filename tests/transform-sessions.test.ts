import assert from "node:assert/strict";
import { test } from "node:test";
import type { DiagramElement, ImageElement, RectangleElement } from "@scribblesvg/core";
import { startDraw, drawPatch } from "../packages/react-utils/src/editor/draw.ts";
import { startDrag, dragPatches } from "../packages/react-utils/src/editor/drag.ts";
import { startResize, startGroupScale, resizePatches } from "../packages/react-utils/src/editor/resize.ts";

const rect: RectangleElement = { type: "rectangle", id: "r", seed: 7, x: 0, y: 0, width: 100, height: 100 };

test("drag patches use original positions for boxes, circles and connectors", () => {
  const elements: DiagramElement[] = [rect,
    { type: "circle", id: "c", seed: 2, cx: 20, cy: 30, radius: 10 },
    { type: "line", id: "l", seed: 3, startX: 0, startY: 5, endX: 40, endY: 50 },
  ];
  const drag = startDrag(elements, ["r", "c", "l", "missing"], { x: 10, y: 20 });
  dragPatches(drag, { x: 100, y: 100 });
  const patches = dragPatches(drag, { x: 15, y: 10 }).map((u) => u.patch);
  assert.deepEqual(patches, [
    { x: 5, y: -10 },
    { cx: 25, cy: 20 },
    { startX: 5, startY: -5, endX: 45, endY: 40 },
  ]);
  assert.equal(rect.x, 0);
});

test("draw patches add each batch of samples once and return the whole stroke", () => {
  const draw = startDraw({ type: "freedraw", id: "s", seed: 1, points: [[0, 0]] }, 1, false);
  assert.deepEqual(drawPatch(draw, [{ x: 5, y: 0 }]), { points: [[0, 0], [5, 0]] });
  assert.deepEqual(drawPatch(draw, [{ x: 10, y: 0 }, { x: 15, y: 0 }]), { points: [[0, 0], [5, 0], [10, 0], [15, 0]] });
  assert.deepEqual(drawPatch(draw, []), { points: [[0, 0], [5, 0], [10, 0], [15, 0]] });
});

test("resize uses its original bounds, clamps minimum size and keeps opposite corner", () => {
  const resize = startResize([rect], "r", "nw", { x: 0, y: 0 })!;
  assert.deepEqual(resizePatches(resize, { x: 200, y: 200 }), [{ id: "r", patch: { x: 80, y: 80, width: 20, height: 20 } }]);
  assert.deepEqual(resizePatches(resize, { x: -20, y: -10 }), [{ id: "r", patch: { x: -20, y: -10, width: 120, height: 110 } }]);
});

test("image corners keep aspect unless Shift frees it", () => {
  const image: ImageElement = { ...rect, type: "image", src: "https://example.com/a.png", naturalWidth: 200, naturalHeight: 100, width: 200 };
  const resize = startResize([image], "r", "se", { x: 200, y: 100 })!;
  const locked = resizePatches(resize, { x: 300, y: 120 })[0].patch as Partial<ImageElement>;
  assert.equal(locked.width! / locked.height!, 2);
  assert.deepEqual(resizePatches(resize, { x: 300, y: 120 }, true)[0].patch, { x: 0, y: 0, width: 300, height: 120 });
});

test("group scaling uses snapshots and scales from the opposite anchor", () => {
  const session = startGroupScale([rect, { ...rect, id: "other", x: 100 }], new Set(["r", "other"]), "se", { x: 200, y: 100 })!;
  const patches = resizePatches(session, { x: 400, y: 200 });
  assert.deepEqual(patches.map((u) => ({ id: u.id, x: (u.patch as Partial<RectangleElement>).x, width: (u.patch as Partial<RectangleElement>).width })), [
    { id: "r", x: 0, width: 200 }, { id: "other", x: 200, width: 200 },
  ]);
});
