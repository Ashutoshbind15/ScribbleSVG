import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_PRESETS,
  ZOOM_SNAP_TOLERANCE,
  clampZoom,
  fitViewport,
  sliderPositionToZoom,
  snapZoomToHundred,
  stepZoom,
  zoomAround,
  zoomToSliderPosition,
} from "../packages/react-utils/src/editor/zoom.ts";

const close = (actual: number, expected: number, message?: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, message ?? `${actual} ≈ ${expected}`);

test("clampZoom keeps zoom within the limits", () => {
  assert.equal(clampZoom(0.01), MIN_ZOOM);
  assert.equal(clampZoom(50), MAX_ZOOM);
  assert.equal(clampZoom(1.3), 1.3);
  assert.equal(clampZoom(NaN), 1);
  assert.equal(clampZoom(Infinity), 1);
});

test("slider mapping is log scale and round-trips", () => {
  assert.equal(zoomToSliderPosition(MIN_ZOOM), 0);
  assert.equal(zoomToSliderPosition(MAX_ZOOM), 1);
  // 100% lands about 59% along: ln(10) / ln(50)
  close(zoomToSliderPosition(1), Math.log(10) / Math.log(50));
  assert.ok(Math.abs(zoomToSliderPosition(1) - 0.59) < 0.01);
  // Equal ratios are equal distances
  close(
    zoomToSliderPosition(2) - zoomToSliderPosition(1),
    zoomToSliderPosition(1) - zoomToSliderPosition(0.5),
  );

  for (const zoom of [MIN_ZOOM, 0.17, 0.5, 1, 1.234, 3, MAX_ZOOM]) {
    close(sliderPositionToZoom(zoomToSliderPosition(zoom)), zoom, `zoom ${zoom}`);
  }
  for (const p of [0, 0.1, 0.5, 0.9, 1]) {
    close(zoomToSliderPosition(sliderPositionToZoom(p)), p, `position ${p}`);
  }
  // Out-of-range positions clamp
  assert.equal(sliderPositionToZoom(-0.5), MIN_ZOOM);
  assert.equal(sliderPositionToZoom(1.5), MAX_ZOOM);
  close(zoomToSliderPosition(20), 1);
});

test("slider snaps to 100% near it, and only near it", () => {
  const hundred = zoomToSliderPosition(1);
  const inside = sliderPositionToZoom(hundred + ZOOM_SNAP_TOLERANCE * 0.9);
  const insideBelow = sliderPositionToZoom(hundred - ZOOM_SNAP_TOLERANCE * 0.9);
  const outside = sliderPositionToZoom(hundred + ZOOM_SNAP_TOLERANCE * 1.5);
  assert.equal(snapZoomToHundred(inside), 1);
  assert.equal(snapZoomToHundred(insideBelow), 1);
  assert.equal(snapZoomToHundred(outside), outside);
  assert.equal(snapZoomToHundred(0.5), 0.5);
  assert.equal(snapZoomToHundred(1.05, 0), 1.05);
});

test("stepZoom moves to the next preset strictly above or below", () => {
  assert.deepEqual(ZOOM_PRESETS, [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5]);
  assert.equal(stepZoom(1, 1), 1.5);
  assert.equal(stepZoom(1, -1), 0.75);
  // Between presets: the neighbour in that direction
  assert.equal(stepZoom(1.2, 1), 1.5);
  assert.equal(stepZoom(1.2, -1), 1);
  assert.equal(stepZoom(0.3, -1), 0.25);
  // Float noise near a preset doesn't land on the same preset
  assert.equal(stepZoom(0.7499999999, 1), 1);
  assert.equal(stepZoom(1.0000000001, -1), 0.75);
  // Edges clamp
  assert.equal(stepZoom(MAX_ZOOM, 1), MAX_ZOOM);
  assert.equal(stepZoom(MIN_ZOOM, -1), MIN_ZOOM);
  assert.equal(stepZoom(4.5, 1), MAX_ZOOM);
  assert.equal(stepZoom(0.12, -1), MIN_ZOOM);
  assert.equal(stepZoom(20, -1), 4);
});

test("zoomAround keeps the anchor in place, or the centre without one", () => {
  const viewport = { x: 100, y: 50, zoom: 1 };
  assert.deepEqual(zoomAround(viewport, 2), { x: 100, y: 50, zoom: 2 });
  assert.deepEqual(zoomAround(viewport, 99), { x: 100, y: 50, zoom: MAX_ZOOM });

  // The anchor's screen offset from the centre is the same before and after
  const anchor = { x: 300, y: -50 };
  const next = zoomAround(viewport, 2, anchor);
  assert.equal(next.zoom, 2);
  const offset = (v: { x: number; y: number; zoom: number }) => ({
    x: (anchor.x - v.x) * v.zoom,
    y: (anchor.y - v.y) * v.zoom,
  });
  assert.deepEqual(offset(next), offset(viewport));
});

test("fitViewport centres content and zooms out to fit, never past 100%", () => {
  const size = { width: 800, height: 600 };

  // Small content stays at 100%, centred
  assert.deepEqual(
    fitViewport({ x: 10, y: 20, width: 100, height: 50 }, size),
    { x: 60, y: 45, zoom: 1 },
  );

  // Large content zooms out to the tighter axis, inside the padding
  const wide = fitViewport({ x: 0, y: 0, width: 1600, height: 200 }, size, { padding: 0 });
  assert.deepEqual(wide, { x: 800, y: 100, zoom: 0.5 });
  const padded = fitViewport({ x: 0, y: 0, width: 1600, height: 200 }, size, { padding: 50 });
  assert.equal(padded.zoom, 700 / 1600);
  const tall = fitViewport({ x: -100, y: -100, width: 200, height: 2000 }, size, { padding: 0 });
  assert.deepEqual(tall, { x: 0, y: 900, zoom: 0.3 });

  // Padding can push content that fits at 100% below it
  assert.equal(
    fitViewport({ x: 0, y: 0, width: 780, height: 100 }, size, { padding: 20 }).zoom,
    760 / 780,
  );

  // Huge content clamps to the minimum zoom
  assert.equal(
    fitViewport({ x: 0, y: 0, width: 1e7, height: 10 }, size).zoom,
    MIN_ZOOM,
  );

  // A straight line (zero height) fits on its long axis
  assert.equal(
    fitViewport({ x: 0, y: 0, width: 1600, height: 0 }, size, { padding: 0 }).zoom,
    0.5,
  );
});

test("fitViewport without content or size", () => {
  assert.deepEqual(fitViewport(null, { width: 800, height: 600 }), { x: 0, y: 0, zoom: 1 });
  assert.deepEqual(
    fitViewport({ x: 0, y: 0, width: 4000, height: 4000 }, { width: 0, height: 0 }),
    { x: 2000, y: 2000, zoom: 1 },
  );
});
