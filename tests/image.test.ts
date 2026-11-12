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

test("images clone and translate through the clipboard", async () => {
  const { collectCopyElements, translateElement } = await import("../packages/react-utils/src/editor/clipboard");
  const [copy] = collectCopyElements([image], new Set([image.id]));
  assert.deepEqual(copy, image);
  assert.notEqual(copy, image);
  assert.deepEqual(translateElement(copy!, 4, -2), { ...image, x: 6, y: 1 });
});

test("inserted images fit half the viewport without upscaling", async () => {
  const { fitImageToViewport } = await import("../packages/react-utils/src/editor/image-fit");
  const viewport = { x: 100, y: 50, zoom: 1 };
  const screen = { width: 800, height: 600 };

  // Small images keep their natural size, centred on the viewport.
  assert.deepEqual(fitImageToViewport({ width: 200, height: 100 }, viewport, screen), {
    x: 0,
    y: 0,
    width: 200,
    height: 100,
  });

  // Large images shrink to half the visible area, keeping their ratio.
  const wide = fitImageToViewport({ width: 4000, height: 1000 }, viewport, screen);
  assert.equal(wide.width, 400);
  assert.equal(wide.height, 100);

  // Zooming in shrinks the visible canvas, so the image gets smaller too.
  const zoomed = fitImageToViewport({ width: 4000, height: 1000 }, { ...viewport, zoom: 2 }, screen);
  assert.equal(zoomed.width, 200);
  assert.equal(zoomed.height, 50);
});

test("isDiagramElement rejects image elements with disallowed sources", async () => {
  const { isDiagramElement } = await import("../packages/core/validation");
  assert.equal(isDiagramElement(image), true);
  assert.equal(isDiagramElement({ ...image, src: "blob:https://example.com/a" }), false);
});
