import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  scaleFontSizeFromGrip,
  stepFontSize,
} from "../packages/react-utils/src/editor/text-size.ts";

test("stepFontSize walks the ladder and snaps off-ladder sizes", () => {
  assert.equal(stepFontSize(16, 1), 18);
  assert.equal(stepFontSize(16, -1), 14);
  assert.equal(stepFontSize(17.3, 1), 18);
  assert.equal(stepFontSize(17.3, -1), 16);
  assert.equal(stepFontSize(MAX_FONT_SIZE, 1), MAX_FONT_SIZE);
  assert.equal(stepFontSize(MIN_FONT_SIZE, -1), MIN_FONT_SIZE);
});

test("scaleFontSizeFromGrip scales with travel along the anchor axis", () => {
  const anchor = { x: 0, y: 0 };
  const grip = { x: 100, y: 50 };
  assert.equal(scaleFontSizeFromGrip(20, anchor, grip, { x: 200, y: 100 }), 40);
  assert.equal(scaleFontSizeFromGrip(20, anchor, grip, { x: 50, y: 25 }), 10);
  // Sideways (perpendicular) motion leaves the size alone
  assert.equal(scaleFontSizeFromGrip(20, anchor, grip, { x: 80, y: 90 }), 20);
});

test("scaleFontSizeFromGrip clamps past the anchor and at the max", () => {
  const anchor = { x: 0, y: 0 };
  const grip = { x: 10, y: 10 };
  assert.equal(scaleFontSizeFromGrip(20, anchor, grip, { x: -50, y: -50 }), MIN_FONT_SIZE);
  assert.equal(scaleFontSizeFromGrip(20, anchor, grip, { x: 1000, y: 1000 }), MAX_FONT_SIZE);
});
