import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isDiagramDocument } from "../packages/core/validation";
import { getElementBounds } from "../packages/core/geometry";
import type { ImageElement } from "../packages/core/types";

const image: ImageElement = { type: "image", id: "i", seed: 1, src: "photo.png", x: 2, y: 3, width: 100, height: 50, naturalWidth: 200, naturalHeight: 100 };
const valid = (element: unknown) => isDiagramDocument({ version: 1, viewport: { x: 0, y: 0, zoom: 1 }, elements: [element] });
test("image sources and dimensions are validated", () => {
  for (const src of ["photo.png", "../photo.png", "/photo.png", "https://example.com/a", "http://example.com/a", "data:image/png;base64,AAAA"]) assert.equal(valid({ ...image, src }), true, src);
  for (const src of ["", "javascript:alert(1)", "blob:https://example.com/a", "data:text/html,abc", "ftp://example.com/a", "//example.com/a"]) assert.equal(valid({ ...image, src }), false, src);
  for (const key of ["width", "height", "naturalWidth", "naturalHeight"]) for (const size of [0, -1, Infinity, NaN]) assert.equal(valid({ ...image, [key]: size }), false);
});
test("image bounds match its box", () => assert.deepEqual(getElementBounds(image), { x: 2, y: 3, width: 100, height: 50 }));
