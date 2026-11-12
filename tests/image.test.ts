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

test("image sources that browsers would rewrite or send off-host are rejected", () => {
  const allowed = [
    "my photo.png",
    "HTTPS://example.com/a.png",
    `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>`,
  ];
  for (const src of allowed) assert.equal(valid({ ...image, src }), true, src);

  const rejected = [
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "photo.png\n",
    "\\\\example.com/a.png",
    "/\\example.com/a.png",
    "https://",
  ];
  for (const src of rejected) assert.equal(valid({ ...image, src }), false, JSON.stringify(src));
});

test("element types are looked up safely", async () => {
  const { isDiagramElement } = await import("../packages/core/validation");
  for (const type of ["toString", "__proto__", "constructor", undefined]) {
    assert.equal(isDiagramElement({ ...image, type }), false, String(type));
  }
});

test("pasting rejects clipboard payloads with invalid elements", async () => {
  const { parseClipboard, serializeClipboard } = await import("../packages/react-utils/src/editor/clipboard");
  assert.deepEqual(parseClipboard(serializeClipboard([image])), [image]);
  const bad = { ...image, src: "javascript:alert(1)" };
  assert.equal(parseClipboard(serializeClipboard([image, bad as ImageElement])), null);
  assert.equal(parseClipboard("null"), null);
});

test("corner resizes of images keep their aspect ratio", async () => {
  const { lockAspectRatio } = await import("../packages/react-utils/src/editor/aspect-ratio");
  const start = { x: 0, y: 0, width: 200, height: 100 };

  // The axis stretched further wins; the opposite corner stays put.
  assert.deepEqual(lockAspectRatio(start, { x: 0, y: 0, width: 300, height: 110 }, "se", 20), { x: 0, y: 0, width: 300, height: 150 });
  assert.deepEqual(lockAspectRatio(start, { x: -100, y: -60, width: 300, height: 160 }, "nw", 20), { x: -120, y: -60, width: 320, height: 160 });

  // Shrinking stops once the short side reaches the minimum size.
  assert.deepEqual(lockAspectRatio(start, { x: 0, y: 0, width: 20, height: 20 }, "se", 20), { x: 0, y: 0, width: 40, height: 20 });
});

test("only shapes carry labels", async () => {
  const { isLabeledShape } = await import("../packages/core/types");
  assert.equal(isLabeledShape(image), false);
  assert.equal(isLabeledShape({ type: "rectangle", id: "r", seed: 1, x: 0, y: 0, width: 1, height: 1 }), true);
  assert.equal(isLabeledShape({ type: "text", id: "t", seed: 1, x: 0, y: 0, text: "hi" }), false);
});
