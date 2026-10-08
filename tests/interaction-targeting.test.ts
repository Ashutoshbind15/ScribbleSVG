import assert from "node:assert/strict";
import { test } from "node:test";
import type { DiagramElement, RectangleElement } from "@scribblesvg/core";
import {
  CORNER_HANDLES,
  getElementsBounds,
  getGroupSelectionBounds,
  hitTestResizeHandle,
  hitTest,
  hitTestGroupSelection,
  hitTestMarquee,
  hitTestSelection,
  hitTestTextTarget,
} from "../packages/react-utils/src/editor/hit-test.ts";

import {
  computeGroupScale,
  getGroupScalePatches,
  getMinGroupScale,
  getScaleAnchor,
} from "../packages/react-utils/src/editor/group-scale.ts";
import { resolveConnectorTarget } from "../packages/react-utils/src/editor/connector-targeting.ts";

const outer: RectangleElement = { id: "outer", type: "rectangle", seed: 1, x: 0, y: 0, width: 800, height: 400 };
const inner: DiagramElement = { id: "inner", type: "circle", seed: 2, cx: 200, cy: 200, radius: 40 };

test("contained geometry wins regardless of creation order", () => {
  assert.equal(hitTest({ x: 200, y: 200 }, [inner, outer])?.id, "inner");
  assert.equal(hitTest({ x: 200, y: 200 }, [outer, inner])?.id, "inner");
});

test("unrelated overlaps and equal bounds preserve stacking order", () => {
  const overlap = { ...outer, id: "overlap", x: 100, y: 100 };
  assert.equal(hitTest({ x: 200, y: 200 }, [outer, overlap])?.id, "overlap");
  assert.equal(hitTest({ x: 200, y: 200 }, [overlap, outer])?.id, "outer");
  assert.equal(hitTest({ x: 200, y: 200 }, [outer, { ...outer, id: "equal" }])?.id, "equal");
  assert.equal(hitTest({ x: 245, y: 245 }, [inner, outer])?.id, "outer");
});

test("text targeting uses the geometry winner and a zoom-aware center radius", () => {
  assert.equal(hitTestTextTarget({ x: 400, y: 200 }, [outer], 1)?.id, "outer");
  assert.equal(hitTestTextTarget({ x: 415, y: 200 }, [outer], 1)?.id, "outer");
  assert.equal(hitTestTextTarget({ x: 417, y: 200 }, [outer], 1), null);
  assert.equal(hitTestTextTarget({ x: 409, y: 200 }, [outer], 2), null);
  assert.equal(hitTestTextTarget({ x: 407, y: 200 }, [outer], 2)?.id, "outer");
  assert.equal(hitTestTextTarget({ x: 430, y: 200 }, [outer], 0.5)?.id, "outer");
  assert.equal(hitTestTextTarget({ x: 440, y: 200 }, [outer], 0.5), null);
  assert.equal(hitTestTextTarget({ x: 200, y: 200 }, [inner, outer], 1)?.id, "inner");
  const text: DiagramElement = { id: "text", type: "text", seed: 3, x: 100, y: 100, text: "Existing text", fontSize: 20 };
  assert.equal(hitTestTextTarget({ x: 101, y: 101 }, [text, outer], 1)?.id, "text");
  // A container's center still hits when it lies inside a nested child's body
  const cover: DiagramElement = { ...inner, id: "cover", cx: 400, cy: 230, radius: 60 };
  assert.equal(hitTestTextTarget({ x: 400, y: 200 }, [outer, cover], 1)?.id, "outer");
  assert.equal(hitTestTextTarget({ x: 400, y: 230 }, [outer, cover], 1)?.id, "cover");
  const tiny = { ...outer, id: "tiny", width: 10, height: 10 };
  assert.equal(hitTestTextTarget({ x: 5, y: 5 }, [tiny], 0.1)?.id, "tiny");
  assert.equal(hitTestTextTarget({ x: 9, y: 9 }, [tiny], 0.1), null);
});

test("bounds containment alone does not override unrelated geometry", () => {
  const circle: DiagramElement = { ...inner, cx: 100, cy: 100, radius: 100 };
  const corner = { ...outer, id: "corner", x: 0, y: 0, width: 80, height: 80 };
  assert.equal(hitTest({ x: 75, y: 75 }, [corner, circle])?.id, "inner");
  assert.equal(hitTest({ x: 75, y: 75 }, [circle, corner])?.id, "corner");
});

const shape = { ...outer, width: 100, height: 100 };

test("line interior clicks stay free and arrows retain shape binding", () => {
  const lineStart = resolveConnectorTarget({ kind: "line", point: { x: 20, y: 20 }, elements: [shape], snapThreshold: 8 }).start;
  assert.deepEqual(lineStart, { point: { x: 20, y: 20 } });
  assert.deepEqual(resolveConnectorTarget({ kind: "line", point: { x: 80, y: 30 }, elements: [shape], start: lineStart, snapThreshold: 8 }), {
    start: { point: { x: 20, y: 20 } }, end: { point: { x: 80, y: 30 } },
  });
  const arrowStart = resolveConnectorTarget({ kind: "arrow", point: { x: 75, y: 50 }, elements: [shape] }).start;
  assert.deepEqual(arrowStart, { point: { x: 50, y: 50 }, binding: "outer", automatic: true });
  const resolved = resolveConnectorTarget({ kind: "arrow", point: { x: 200, y: 50 }, elements: [shape], start: arrowStart });
  assert.deepEqual(resolved.end, { point: { x: 200, y: 50 } });
  assert.deepEqual(resolved.start, { point: { x: 100, y: 50 }, binding: "outer", automatic: true });
});

test("explicit line connection points bind, while Shift wins over snapping", () => {
  const start = resolveConnectorTarget({ kind: "line", point: { x: 1, y: 50 }, elements: [shape], snapThreshold: 8 }).start;
  assert.deepEqual(start, { point: { x: 0, y: 50 }, binding: "outer" });
  const endShape = { ...shape, id: "end", x: 200, y: 10 };
  const bound = resolveConnectorTarget({ kind: "line", point: { x: 201, y: 60 }, elements: [shape, endShape], start, snapThreshold: 8 });
  assert.deepEqual(bound.end, { point: { x: 200, y: 60 }, binding: "end" });
  const shifted = resolveConnectorTarget({ kind: "line", point: { x: 201, y: 60 }, elements: [shape, endShape], start, snapThreshold: 8, constrain: true });
  assert.deepEqual(shifted.start, { point: { x: 0, y: 50 } });
  assert.equal(shifted.end?.point.y, 50);
  assert.equal(shifted.end?.binding, undefined);
  const explicit = resolveConnectorTarget({ kind: "line", point: { x: 200, y: 50 }, elements: [shape, endShape], start, constrain: true, explicitHit: { elementId: "end", point: { x: 200, y: 60 } } });
  assert.deepEqual(explicit.end?.point, { x: 200, y: 50 });
  assert.equal(explicit.end?.binding, undefined);
  const arrow = resolveConnectorTarget({ kind: "arrow", point: { x: 201, y: 60 }, elements: [shape, endShape], start, snapThreshold: 8, constrain: true });
  assert.deepEqual(arrow.end, { point: { x: 200, y: 60 }, binding: "end" });
});

test("same-shape connector clicks do not collapse onto one anchor", () => {
  const start = resolveConnectorTarget({ kind: "arrow", point: { x: 75, y: 50 }, elements: [shape] }).start;
  assert.deepEqual(resolveConnectorTarget({ kind: "arrow", point: { x: 25, y: 50 }, elements: [shape], start }), {
    start: { point: { x: 50, y: 50 }, binding: "outer", automatic: true }, end: { point: { x: 25, y: 50 } },
  });
  const explicit = resolveConnectorTarget({ kind: "line", point: { x: 0, y: 50 }, elements: [shape], snapThreshold: 8 }).start;
  assert.deepEqual(resolveConnectorTarget({ kind: "line", point: { x: 100, y: 50 }, elements: [shape], start: explicit, snapThreshold: 8 }), {
    start: { point: { x: 0, y: 50 }, binding: "outer" }, end: { point: { x: 100, y: 50 }, binding: "outer" },
  });
});

test("Shift line creation inside an enclosing shape stays free and horizontal", () => {
  const start = resolveConnectorTarget({ kind: "line", point: { x: 70, y: 110 }, elements: [outer], snapThreshold: 8, constrain: true }).start;
  assert.deepEqual(start, { point: { x: 70, y: 110 } });
  const geometry = resolveConnectorTarget({ kind: "line", point: { x: 280, y: 125 }, elements: [outer], start, snapThreshold: 8, constrain: true });
  assert.deepEqual(geometry.start, { point: { x: 70, y: 110 } });
  assert.equal(geometry.end?.point.y, 110);
  assert.equal(geometry.end?.binding, undefined);
  assert.ok(geometry.end!.point.x > 280);
});

test("arrow interior targeting prefers the contained shape", () => {
  assert.deepEqual(resolveConnectorTarget({ kind: "arrow", point: { x: 200, y: 200 }, elements: [inner, outer] }).start, {
    point: { x: 240, y: 200 }, binding: "inner", automatic: true,
  });
});

test("select targeting picks shapes by their outline, not their interior", () => {
  assert.equal(hitTestSelection({ x: 400, y: 200 }, [outer], 1)?.id, "outer");
  assert.equal(hitTestSelection({ x: 300, y: 200 }, [outer], 1), null);
  assert.equal(hitTestSelection({ x: 3, y: 200 }, [outer], 1)?.id, "outer");
  assert.equal(hitTestSelection({ x: 400, y: 405 }, [outer], 1)?.id, "outer");
  assert.equal(hitTestSelection({ x: 400, y: 410 }, [outer], 1), null);
  assert.equal(hitTestSelection({ x: 400, y: 410 }, [outer], 0.5)?.id, "outer");
  assert.equal(hitTestSelection({ x: 200, y: 200 }, [inner, outer], 1)?.id, "inner");
  assert.equal(hitTestSelection({ x: 220, y: 200 }, [inner, outer], 1), null);
  assert.equal(hitTestSelection({ x: 240, y: 200 }, [outer, inner], 1)?.id, "inner");
  assert.equal(hitTestSelection({ x: 202, y: 162 }, [outer, inner], 1)?.id, "inner");
  const diamond: DiagramElement = { id: "diamond", type: "diamond", seed: 4, x: 0, y: 0, width: 100, height: 100 };
  assert.equal(hitTestSelection({ x: 50, y: 50 }, [diamond], 1)?.id, "diamond");
  assert.equal(hitTestSelection({ x: 50, y: 30 }, [diamond], 1), null);
  assert.equal(hitTestSelection({ x: 25, y: 25 }, [diamond], 1)?.id, "diamond");
  const cylinder: DiagramElement = { id: "cyl", type: "cylinder", seed: 5, x: 0, y: 0, width: 100, height: 200 };
  assert.equal(hitTestSelection({ x: 50, y: 100 }, [cylinder], 1)?.id, "cyl");
  assert.equal(hitTestSelection({ x: 50, y: 70 }, [cylinder], 1), null);
  assert.equal(hitTestSelection({ x: 1, y: 100 }, [cylinder], 1)?.id, "cyl");
  assert.equal(hitTestSelection({ x: 50, y: 1 }, [cylinder], 1)?.id, "cyl");
  assert.equal(hitTestSelection({ x: 50, y: 24 }, [cylinder], 1)?.id, "cyl");
});

test("select targeting keeps text bodies and selected interiors draggable", () => {
  const text: DiagramElement = { id: "text", type: "text", seed: 3, x: 100, y: 100, text: "Existing text", fontSize: 20 };
  assert.equal(hitTestSelection({ x: 105, y: 105 }, [outer, text], 1)?.id, "text");
  assert.equal(hitTestSelection({ x: 400, y: 200 }, [outer], 1, new Set(["outer"]))?.id, "outer");
  assert.equal(hitTestSelection({ x: 240, y: 200 }, [outer, inner], 1, new Set(["outer"]))?.id, "inner");
});

test("marquee inside a container selects the children, not the container", () => {
  const ids = (marquee: { x: number; y: number; width: number; height: number }, els: DiagramElement[]) =>
    hitTestMarquee(marquee, els).map((el) => el.id);
  assert.deepEqual(ids({ x: 150, y: 150, width: 100, height: 100 }, [outer, inner]), ["inner"]);
  assert.deepEqual(ids({ x: 190, y: 190, width: 20, height: 20 }, [outer, inner]), []);
  assert.deepEqual(ids({ x: -10, y: 150, width: 30, height: 30 }, [outer, inner]), ["outer"]);
  assert.deepEqual(ids({ x: -10, y: -10, width: 900, height: 500 }, [outer, inner]), ["outer", "inner"]);
  // Circle: box in the empty corner of its bounding box misses.
  assert.deepEqual(ids({ x: 160, y: 160, width: 5, height: 5 }, [inner]), []);
  const diamond: DiagramElement = { id: "diamond", type: "diamond", seed: 4, x: 0, y: 0, width: 100, height: 100 };
  assert.deepEqual(ids({ x: 40, y: 40, width: 20, height: 20 }, [diamond]), []);
  assert.deepEqual(ids({ x: 0, y: 0, width: 10, height: 10 }, [diamond]), []);
  assert.deepEqual(ids({ x: 20, y: 20, width: 10, height: 10 }, [diamond]), ["diamond"]);
  const cylinder: DiagramElement = { id: "cyl", type: "cylinder", seed: 5, x: 0, y: 0, width: 100, height: 200 };
  assert.deepEqual(ids({ x: 30, y: 80, width: 40, height: 40 }, [cylinder]), []);
  assert.deepEqual(ids({ x: 45, y: 20, width: 10, height: 10 }, [cylinder]), ["cyl"]);
  const text: DiagramElement = { id: "text", type: "text", seed: 3, x: 100, y: 100, text: "Existing text", fontSize: 20 };
  assert.deepEqual(ids({ x: 105, y: 105, width: 5, height: 5 }, [text]), ["text"]);
});

test("a multi-selection's group box spans its members and is one drag target", () => {
  const far: DiagramElement = { ...outer, id: "far", x: 1000, y: 600, width: 100, height: 50 };
  const both = new Set(["outer", "far"]);
  assert.deepEqual(getGroupSelectionBounds([outer, far], both), { x: -8, y: -8, width: 1116, height: 666 });
  assert.equal(getGroupSelectionBounds([outer, far], new Set(["outer"])), null);
  // Empty space between the two members is inside the group box…
  assert.equal(hitTestSelection({ x: 900, y: 500 }, [outer, far], 1, both), null);
  assert.equal(hitTestGroupSelection({ x: 900, y: 500 }, [outer, far], both), true);
  // …while points outside it, or with only one element selected, are not.
  assert.equal(hitTestGroupSelection({ x: 1200, y: 100 }, [outer, far], both), false);
  assert.equal(hitTestGroupSelection({ x: 900, y: 500 }, [outer, far], new Set(["far"])), false);
});

test("group scale grows uniformly from the corner opposite the drag", () => {
  const a: RectangleElement = { id: "a", type: "rectangle", seed: 1, x: 0, y: 0, width: 100, height: 50, text: "A", fontSize: 14 };
  const b: DiagramElement = { id: "b", type: "circle", seed: 2, cx: 150, cy: 75, radius: 25 };
  const c: DiagramElement = { id: "c", type: "arrow", seed: 3, startX: 100, startY: 25, endX: 125, endY: 75 };
  const group = [a, b, c];
  const bounds = getElementsBounds(group)!;
  assert.deepEqual(bounds, { x: 0, y: 0, width: 175, height: 100 });

  // Dragging se outward by 175px horizontally doubles the group
  const anchor = getScaleAnchor(bounds, "se");
  assert.deepEqual(anchor, { x: 0, y: 0 });
  const scale = computeGroupScale(bounds, "se", 175, 10, getMinGroupScale(group));
  assert.equal(scale, 2);

  const patches = new Map(getGroupScalePatches(group, anchor, scale).map((u) => [u.id, u.patch]));
  assert.deepEqual(patches.get("a"), { x: 0, y: 0, width: 200, height: 100, fontSize: 28 });
  assert.deepEqual(patches.get("b"), { cx: 300, cy: 150, radius: 50 });
  assert.deepEqual(patches.get("c"), { startX: 200, startY: 50, endX: 250, endY: 150 });

  // nw handle pins the bottom-right corner
  assert.deepEqual(getScaleAnchor(bounds, "nw"), { x: 175, y: 100 });
  assert.equal(computeGroupScale(bounds, "nw", -175, 0, 0.1), 2);
});

test("group scale clamps so shapes keep a usable size", () => {
  const a: RectangleElement = { id: "a", type: "rectangle", seed: 1, x: 0, y: 0, width: 40, height: 40 };
  const b: RectangleElement = { id: "b", type: "rectangle", seed: 2, x: 100, y: 0, width: 200, height: 200 };
  const min = getMinGroupScale([a, b]);
  assert.equal(min, 0.5);
  assert.equal(computeGroupScale(getElementsBounds([a, b])!, "se", -290, -190, min), 0.5);
});

test("group corner handles only hit at the corners", () => {
  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  assert.equal(hitTestResizeHandle({ x: 100, y: 100 }, bounds, 5, CORNER_HANDLES), "se");
  assert.equal(hitTestResizeHandle({ x: 50, y: 0 }, bounds, 5, CORNER_HANDLES), null);
  assert.equal(hitTestResizeHandle({ x: 50, y: 0 }, bounds, 5), "n");
});
