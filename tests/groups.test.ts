import assert from "node:assert/strict";
import { test } from "node:test";
import type { RectangleElement } from "@scribblesvg/core";
import { isDiagramElement } from "../packages/core/validation.ts";

function rect(id: string, x: number, groupId?: string): RectangleElement {
  return {
    id,
    type: "rectangle",
    seed: 1,
    x,
    y: 0,
    width: 40,
    height: 40,
    ...(groupId !== undefined ? { groupId } : {}),
  };
}

test("isDiagramElement accepts a string groupId and rejects any other", () => {
  assert.equal(isDiagramElement(rect("a", 0)), true);
  assert.equal(isDiagramElement(rect("a", 0, "g1")), true);
  assert.equal(isDiagramElement({ ...rect("a", 0), groupId: 7 }), false);
  assert.equal(isDiagramElement({ ...rect("a", 0), groupId: null }), false);
});
