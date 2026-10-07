import assert from "node:assert/strict";
import { test } from "node:test";
import type { DiagramElement, RectangleElement } from "@scribblesvg/core";
import { hitTest, hitTestTextTarget } from "../packages/react-utils/src/editor/hit-test.ts";

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
