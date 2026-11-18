import assert from "node:assert/strict";
import { test } from "node:test";
import type { RectangleElement } from "@scribblesvg/core";
import { isDiagramElement } from "../packages/core/validation.ts";
import {
  expandToGroups,
  getSelectionOutlines,
  groupPatches,
  isWholeGroupSelected,
  ungroupPatches,
} from "../packages/react-utils/src/editor/groups.ts";
import { cloneElementsForPaste } from "../packages/react-utils/src/editor/clipboard.ts";
import { resolveMarqueeSelection } from "../packages/react-utils/src/editor/hit-test.ts";
import { canvasReducer } from "../packages/react-utils/src/editor/useCanvasReducer.ts";

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

const elements = [
  rect("a", 0, "g1"),
  rect("b", 50, "g1"),
  rect("c", 100),
  rect("d", 150, "g2"),
  rect("e", 200, "g2"),
];

test("expandToGroups adds the rest of each touched group, in document order", () => {
  assert.deepEqual(expandToGroups(elements, ["b"]), ["a", "b"]);
  assert.deepEqual(expandToGroups(elements, ["c"]), ["c"]);
  assert.deepEqual(expandToGroups(elements, ["e", "a"]), ["a", "b", "d", "e"]);
  assert.deepEqual(expandToGroups(elements, []), []);
});

test("a groupId held by one element selects only that element", () => {
  const lone = [rect("a", 0, "g1"), rect("b", 50)];
  assert.deepEqual(expandToGroups(lone, ["a"]), ["a"]);
  assert.equal(isWholeGroupSelected(lone, new Set(["a"]), "a"), false);
});

test("isWholeGroupSelected is true only when the selection is exactly that group", () => {
  assert.equal(isWholeGroupSelected(elements, new Set(["a", "b"]), "a"), true);
  assert.equal(isWholeGroupSelected(elements, new Set(["a", "b", "c"]), "a"), false);
  assert.equal(isWholeGroupSelected(elements, new Set(["a"]), "a"), false);
  assert.equal(isWholeGroupSelected(elements, new Set(["a", "b"]), "c"), false);
});

test("grouping across two groups merges them into one", () => {
  const patches = groupPatches(elements, new Set(["a", "b", "c", "d", "e"]), "g3");
  assert.deepEqual(
    patches.map((p) => [p.id, p.patch.groupId]),
    [["a", "g3"], ["b", "g3"], ["c", "g3"], ["d", "g3"], ["e", "g3"]],
  );
});

test("grouping needs two elements that are not already one group", () => {
  assert.deepEqual(groupPatches(elements, new Set(["c"]), "g3"), []);
  assert.deepEqual(groupPatches(elements, new Set(["a", "b"]), "g3"), []);
  assert.equal(groupPatches(elements, new Set(["a", "c"]), "g3").length, 2);
});

test("group then ungroup through the reducer is one undo step each", () => {
  let state = canvasReducer(
    canvasReducer(undefined as never, {
      type: "SET_DOCUMENT",
      document: { version: 1, viewport: { x: 0, y: 0, zoom: 1 }, elements: [rect("x", 0), rect("y", 50)] },
    }),
    { type: "SET_SELECTION", ids: ["x", "y"] },
  );
  const ids = new Set(["x", "y"]);
  state = canvasReducer(state, {
    type: "UPDATE_ELEMENTS",
    updates: groupPatches(state.document.elements, ids, "g"),
  });
  assert.deepEqual(state.document.elements.map((el) => el.groupId), ["g", "g"]);
  assert.deepEqual(expandToGroups(state.document.elements, ["x"]), ["x", "y"]);

  state = canvasReducer(state, {
    type: "UPDATE_ELEMENTS",
    updates: ungroupPatches(state.document.elements, ids),
  });
  assert.deepEqual(expandToGroups(state.document.elements, ["x"]), ["x"]);
  assert.deepEqual(JSON.parse(JSON.stringify(state.document.elements))[0], rect("x", 0));

  state = canvasReducer(state, { type: "UNDO" });
  assert.deepEqual(state.document.elements.map((el) => el.groupId), ["g", "g"]);
  state = canvasReducer(state, { type: "UNDO" });
  assert.deepEqual(state.document.elements.map((el) => el.groupId), [undefined, undefined]);
});

test("ungroupPatches touches only grouped elements in the set", () => {
  assert.deepEqual(
    ungroupPatches(elements, new Set(["a", "c", "d"])).map((p) => p.id),
    ["a", "d"],
  );
});

test("a box touching one member selects its whole group", () => {
  const drag = (additive: boolean, selected: string[]) =>
    resolveMarqueeSelection({
      // Crosses only b's left edge (x = 50)
      startPoint: { x: 45, y: 10 },
      endPoint: { x: 55, y: 20 },
      screenStart: { x: 0, y: 0 },
      screenEnd: { x: 100, y: 100 },
      additive,
      selectedIds: new Set(selected),
      elements,
    });
  assert.deepEqual(drag(false, []), { type: "set", ids: ["a", "b"] });
  assert.deepEqual(drag(true, ["c"]), { type: "set", ids: ["c", "a", "b"] });
});

test("a pasted group gets a new groupId shared by its copies", () => {
  const pasted = cloneElementsForPaste(elements);
  const [a, b, c, d, e] = pasted.map((el) => el.groupId);
  assert.ok(a && d);
  assert.equal(a, b);
  assert.equal(d, e);
  assert.notEqual(a, d);
  assert.notEqual(a, "g1");
  assert.notEqual(d, "g2");
  assert.equal(c, undefined);
  assert.equal("groupId" in pasted[2]!, false);
});

function outlineIds(selected: string[], els = elements) {
  const { elements: loose, groups } = getSelectionOutlines(els, new Set(selected));
  const ids = (list: { id: string }[]) => list.map((el) => el.id);
  return {
    elements: ids(loose),
    groups: groups.map(ids),
  };
}

test("a selection that is exactly one group gets no per-member outlines", () => {
  assert.deepEqual(outlineIds(["b", "a"]), { elements: [], groups: [] });
});

test("loose elements are outlined one by one, as before", () => {
  assert.deepEqual(outlineIds(["c"]), { elements: ["c"], groups: [] });
  const loose = [rect("x", 0), rect("y", 50)];
  assert.deepEqual(outlineIds(["x", "y"], loose), { elements: ["x", "y"], groups: [] });
});

test("several groups, or a group with loose elements, outline each group as one", () => {
  assert.deepEqual(outlineIds(["a", "b", "d", "e"]), {
    elements: [],
    groups: [["a", "b"], ["d", "e"]],
  });
  assert.deepEqual(outlineIds(["c", "a", "b"]), {
    elements: ["c"],
    groups: [["a", "b"]],
  });
});

test("selected members of a partly selected group are outlined as loose elements", () => {
  assert.deepEqual(outlineIds(["a"]), { elements: ["a"], groups: [] });
  assert.deepEqual(outlineIds(["a", "c"]), { elements: ["a", "c"], groups: [] });
});

test("a groupId held by one element outlines it as a loose element", () => {
  const lone = [rect("a", 0, "g1"), rect("b", 50)];
  assert.deepEqual(outlineIds(["a"], lone), { elements: ["a"], groups: [] });
});
