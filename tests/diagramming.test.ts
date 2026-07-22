import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  DEFAULT_VIEWPORT,
  EMPTY_DOCUMENT,
  generateSeed,
  getAnchorPoint,
  getElementConnectionPoints,
  getContentBounds,
  getDiamondVertices,
  getElementBounds,
  getElementCenter,
  getElementRoughPaths,
  isBindable,
  isConnector,
  isDiagramDocument,
  parseDiagramDocument,
  scaleFontSizeForResize,
  type ArrowElement,
  type CircleElement,
  type CylinderElement,
  type DiagramDocument,
  type DiagramElement,
  type DiamondElement,
  type IconElement,
  type LineElement,
  type RectangleElement,
  type TextElement,
  type Viewport,
} from "@scribblesvg/core";
import {
  canvasToScreen,
  getViewBox,
  screenToCanvas,
} from "../packages/react-utils/src/editor/coordinate-utils.ts";
import {
  getResizeHandles,
  hitTest,
  hitTestElement,
  hitTestResizeHandle,
  hitTestConnectionPoint,
} from "../packages/react-utils/src/editor/hit-test.ts";
import {
  canvasReducer,
  type CanvasState,
  type ToolType,
} from "../packages/react-utils/src/editor/useCanvasReducer.ts";
import {
  resolveDiagramColors,
  DIAGRAM_COLOR_PRESETS,
  DEFAULT_DIAGRAM_COLORS,
} from "../packages/react-utils/src/colors.ts";
import {
  getIconRenderMode,
  parseIconSvg,
  partitionIconCatalog,
  resolveDiagramIcon,
  type DiagramIcon,
} from "../packages/react-utils/src/icons.ts";
import {
  diagramSnapshot,
  parsePayload,
} from '../utils/diagram.ts';

function assertClose(
  actual: number,
  expected: number,
  message: string,
  epsilon = 0.01,
) {
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `${message}: expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

function createRectangle(
  overrides: Partial<RectangleElement> = {},
): RectangleElement {
  return {
    id: "rect-1",
    type: "rectangle",
    seed: 42,
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    ...overrides,
  };
}

function createCircle(overrides: Partial<CircleElement> = {}): CircleElement {
  return {
    id: "circle-1",
    type: "circle",
    seed: 99,
    cx: 200,
    cy: 200,
    radius: 40,
    ...overrides,
  };
}

function createCylinder(
  overrides: Partial<CylinderElement> = {},
): CylinderElement {
  return {
    id: "cylinder-1",
    type: "cylinder",
    seed: 77,
    x: 300,
    y: 100,
    width: 80,
    height: 120,
    ...overrides,
  };
}

function createDiamond(
  overrides: Partial<DiamondElement> = {},
): DiamondElement {
  return {
    id: "diamond-1",
    type: "diamond",
    seed: 88,
    x: 400,
    y: 50,
    width: 100,
    height: 80,
    ...overrides,
  };
}

function createIcon(overrides: Partial<IconElement> = {}): IconElement {
  return {
    id: "icon-1",
    type: "icon",
    seed: 33,
    iconId: "custom",
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    ...overrides,
  };
}

function createText(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: "text-1",
    type: "text",
    seed: 11,
    x: 50,
    y: 50,
    text: "Hello",
    ...overrides,
  };
}

function createArrow(overrides: Partial<ArrowElement> = {}): ArrowElement {
  return {
    id: "arrow-1",
    type: "arrow",
    seed: 55,
    startX: 0,
    startY: 0,
    endX: 100,
    endY: 100,
    ...overrides,
  };
}

function createLine(overrides: Partial<LineElement> = {}): LineElement {
  return {
    id: "line-1",
    type: "line",
    seed: 66,
    startX: 0,
    startY: 0,
    endX: 100,
    endY: 100,
    ...overrides,
  };
}

function createDocument(
  elements: DiagramElement[] = [],
  viewport: Viewport = { ...DEFAULT_VIEWPORT },
): DiagramDocument {
  return {
    version: 1,
    viewport,
    elements,
  };
}

function createCanvasState(
  document: DiagramDocument = EMPTY_DOCUMENT,
): CanvasState {
  return {
    document,
    selectedIds: new Set(),
    tool: "select",
    activeIconId: null,
  };
}

describe("@scribblesvg/core", () => {
  test("exposes the default viewport and empty document constants", () => {
    assert.deepEqual(DEFAULT_VIEWPORT, { x: 0, y: 0, zoom: 1 });
    assert.equal(EMPTY_DOCUMENT.version, 1);
    assert.equal(EMPTY_DOCUMENT.elements.length, 0);
    assert.equal(EMPTY_DOCUMENT.viewport, DEFAULT_VIEWPORT);
  });

  test("generates numeric rough seeds", () => {
    const seeds = new Set(Array.from({ length: 10 }, () => generateSeed()));

    assert.ok(Array.from(seeds).every((seed) => Number.isInteger(seed)));
    assert.ok(seeds.size > 1, "expected at least two unique seeds");
  });

  test("parses and guards valid documents across every supported element type", () => {
    const document = createDocument([
      createRectangle({ text: "Box" }),
      createCircle({ text: "Circle" }),
      createCylinder({ text: "Cylinder" }),
      createDiamond({ text: "Decision" }),
      createIcon({ text: "Icon", iconId: "iconpack:iconname" }),
      createText({ text: "Hello World", fontSize: 16 }),
      createArrow({ startBinding: "rect-1", endBinding: "circle-1" }),
      createLine({ startBinding: "diamond-1", endBinding: "rect-1" }),
    ]);

    const parsed = parseDiagramDocument(document);
    assert.equal(parsed.elements.length, 8);
    assert.equal(parsed.elements[0]?.type, "rectangle");
    assert.equal(parsed.elements[3]?.type, "diamond");
    assert.equal(parsed.elements[6]?.type, "arrow");
    assert.equal(parsed.elements[7]?.type, "line");
    assert.equal((parsed.elements[6] as ArrowElement).endBinding, "circle-1");
    assert.equal((parsed.elements[7] as LineElement).startBinding, "diamond-1");
    assert.equal(isDiagramDocument(document), true);
    assert.equal(isConnector(parsed.elements[6]!), true);
    assert.equal(isBindable(parsed.elements[3]!), true);
  });

  test("rejects invalid diagram documents", () => {
    assert.equal(isDiagramDocument({}), false);
    assert.equal(isDiagramDocument(null), false);
    assert.equal(isDiagramDocument("not an object"), false);
    assert.equal(isDiagramDocument({ version: 2 }), false);

    assert.throws(() => parseDiagramDocument({ version: 1, elements: [] }));
    assert.throws(() =>
      parseDiagramDocument({
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        elements: [{ id: "bad", type: "unknown", seed: 1 }],
      }),
    );
    assert.throws(() =>
      parseDiagramDocument({
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        elements: [
          {
            id: "icon-bad",
            type: "icon",
            seed: 1,
            x: 0,
            y: 0,
            width: 10,
            height: 10,
          },
        ],
      }),
    );
  });

  test("calculates element bounds for every geometry type", () => {
    const rectangleBounds = getElementBounds(createRectangle());
    assert.deepEqual(rectangleBounds, { x: 10, y: 20, width: 100, height: 50 });

    const iconBounds = getElementBounds(createIcon());
    assert.deepEqual(iconBounds, rectangleBounds);

    const circleBounds = getElementBounds(createCircle());
    assert.deepEqual(circleBounds, { x: 160, y: 160, width: 80, height: 80 });

    const cylinderBounds = getElementBounds(createCylinder());
    assert.deepEqual(cylinderBounds, {
      x: 300,
      y: 100,
      width: 80,
      height: 120,
    });

    const diamondBounds = getElementBounds(createDiamond());
    assert.deepEqual(diamondBounds, {
      x: 400,
      y: 50,
      width: 100,
      height: 80,
    });
    assert.deepEqual(getDiamondVertices(diamondBounds), [
      { x: 450, y: 50 },
      { x: 500, y: 90 },
      { x: 450, y: 130 },
      { x: 400, y: 90 },
    ]);

    const arrowBounds = getElementBounds(
      createArrow({ startX: 120, startY: 10, endX: 20, endY: 60 }),
    );
    assert.deepEqual(arrowBounds, { x: 20, y: 10, width: 100, height: 50 });

    const lineBounds = getElementBounds(
      createLine({ startX: 120, startY: 10, endX: 20, endY: 60 }),
    );
    assert.deepEqual(lineBounds, arrowBounds);

    const singleLineTextBounds = getElementBounds(
      createText({ x: 10, y: 20, text: "Hello", fontSize: 16 }),
    );
    assert.equal(singleLineTextBounds.x, 10);
    assert.equal(singleLineTextBounds.y, 20);
    assertClose(singleLineTextBounds.width, 48, "single-line text width");
    assertClose(singleLineTextBounds.height, 19.2, "single-line text height");

    const multiLineTextBounds = getElementBounds(
      createText({
        x: 5,
        y: 10,
        text: "Short\nA much longer line here",
        fontSize: 20,
      }),
    );
    assertClose(multiLineTextBounds.width, 276, "multi-line text width");
    assertClose(multiLineTextBounds.height, 48, "multi-line text height");

    const emptyTextBounds = getElementBounds(
      createText({ x: 0, y: 0, text: "", fontSize: 16 }),
    );
    assertClose(emptyTextBounds.width, 9.6, "empty text minimum width");
    assertClose(emptyTextBounds.height, 19.2, "empty text minimum height");

    const explicitTextBounds = getElementBounds(
      createText({ x: 10, y: 20, text: "Hi", width: 120, height: 40 }),
    );
    assert.deepEqual(explicitTextBounds, {
      x: 10,
      y: 20,
      width: 120,
      height: 40,
    });
  });

  test("scales font size proportionally when bounds change", () => {
    const start = { x: 0, y: 0, width: 100, height: 100 };
    const doubled = { x: 0, y: 0, width: 200, height: 200 };
    assert.equal(scaleFontSizeForResize(14, doubled, start), 28);
    assert.equal(scaleFontSizeForResize(16, doubled, start), 32);
    assert.equal(scaleFontSizeForResize(8, { x: 0, y: 0, width: 10, height: 10 }, start), 8);
  });

  test("computes content bounds across mixed coordinates", () => {
    const bounds = getContentBounds([
      createRectangle({ x: -50, y: 10, width: 100, height: 40 }),
      createCircle({ cx: 200, cy: 200, radius: 25 }),
      createArrow({ startX: -10, startY: -20, endX: 80, endY: 20 }),
    ]);

    assert.ok(bounds);
    assert.deepEqual(bounds, { x: -50, y: -20, width: 275, height: 245 });
    assert.equal(getContentBounds([]), null);
  });

  test("computes centers for shapes, text, and arrows", () => {
    assert.deepEqual(getElementCenter(createRectangle()), { x: 60, y: 45 });
    assert.deepEqual(getElementCenter(createIcon()), { x: 60, y: 45 });
    assert.deepEqual(getElementCenter(createCircle()), { x: 200, y: 200 });
    assert.deepEqual(
      getElementCenter(
        createText({ x: 10, y: 20, text: "Test", fontSize: 20 }),
      ),
      {
        x: 34,
        y: 32,
      },
    );
    assert.deepEqual(
      getElementCenter(
        createArrow({ startX: 0, startY: 0, endX: 100, endY: 40 }),
      ),
      { x: 50, y: 20 },
    );
    assert.deepEqual(getElementCenter(createDiamond()), { x: 450, y: 90 });
    assert.deepEqual(
      getElementCenter(createLine({ startX: 0, startY: 0, endX: 100, endY: 40 })),
      { x: 50, y: 20 },
    );
  });

  test("computes anchor points for rectangles, cylinders, circles, diamonds, and degenerate cases", () => {
    const rectangle = createRectangle();
    const anchorRight = getAnchorPoint(rectangle, { x: 200, y: 45 });
    assertClose(anchorRight.x, 110, "rectangle right edge x");
    assertClose(anchorRight.y, 45, "rectangle right edge y");

    const icon = createIcon();
    const iconAnchorRight = getAnchorPoint(icon, { x: 200, y: 45 });
    assertClose(iconAnchorRight.x, 110, "icon right edge x");
    assertClose(iconAnchorRight.y, 45, "icon right edge y");

    const anchorTop = getAnchorPoint(rectangle, { x: 60, y: -100 });
    assertClose(anchorTop.x, 60, "rectangle top edge x");
    assertClose(anchorTop.y, 20, "rectangle top edge y");

    const cylinder = createCylinder();
    const cylinderAnchor = getAnchorPoint(cylinder, { x: 340, y: 500 });
    assertClose(cylinderAnchor.x, 340, "cylinder bottom edge x");
    assertClose(cylinderAnchor.y, 220, "cylinder bottom edge y");

    const circle = createCircle();
    const circleAnchor = getAnchorPoint(circle, { x: 200, y: 0 });
    assertClose(circleAnchor.x, 200, "circle top anchor x");
    assertClose(circleAnchor.y, 160, "circle top anchor y");

    const circleCenterAnchor = getAnchorPoint(circle, { x: 200, y: 200 });
    assert.deepEqual(circleCenterAnchor, { x: 240, y: 200 });

    const rectangleCenter = getElementCenter(rectangle);
    assert.deepEqual(
      getAnchorPoint(rectangle, rectangleCenter),
      rectangleCenter,
    );

    const text = createText({
      x: 100,
      y: 50,
      text: "Label",
      fontSize: 16,
      width: 80,
      height: 30,
    });
    const textAnchorRight = getAnchorPoint(text, { x: 300, y: 65 });
    assertClose(textAnchorRight.x, 180, "text right edge x");
    assertClose(textAnchorRight.y, 65, "text right edge y");

    const diamond = createDiamond();
    const diamondRight = getAnchorPoint(diamond, { x: 600, y: 90 });
    assertClose(diamondRight.x, 500, "diamond right vertex x");
    assertClose(diamondRight.y, 90, "diamond right vertex y");

    const diamondTop = getAnchorPoint(diamond, { x: 450, y: -100 });
    assertClose(diamondTop.x, 450, "diamond top vertex x");
    assertClose(diamondTop.y, 50, "diamond top vertex y");
  });

  test("exposes connection points per bindable shape", () => {
    const rectangle = createRectangle();
    const rectPoints = getElementConnectionPoints(rectangle);
    assert.equal(rectPoints.length, 8);
    assert.deepEqual(rectPoints[1], { x: 60, y: 20 });
    assert.deepEqual(rectPoints[3], { x: 110, y: 45 });

    const iconPoints = getElementConnectionPoints(createIcon());
    assert.deepEqual(iconPoints, rectPoints);

    const circle = createCircle();
    const circlePoints = getElementConnectionPoints(circle);
    assert.equal(circlePoints.length, 8);
    const circleTop = circlePoints[0];
    const circleRight = circlePoints[2];
    assert.ok(circleTop);
    assert.ok(circleRight);
    assertClose(circleTop.x, 200, "circle top x");
    assertClose(circleTop.y, 160, "circle top y");
    assertClose(circleRight.x, 240, "circle right x");
    assertClose(circleRight.y, 200, "circle right y");

    const diamondPoints = getElementConnectionPoints(createDiamond());
    assert.equal(diamondPoints.length, 4);
    assert.deepEqual(diamondPoints[0], { x: 450, y: 50 });
    assert.deepEqual(diamondPoints[1], { x: 500, y: 90 });

    assert.equal(getElementConnectionPoints(createArrow()).length, 0);
    assert.equal(getElementConnectionPoints(createLine()).length, 0);
  });

  test("generates serializable rough paths for renderable elements", () => {
    const renderableElements = [
      createRectangle(),
      createCircle(),
      createCylinder(),
      createDiamond(),
      createArrow(),
      createLine(),
    ];

    for (const element of renderableElements) {
      const paths = getElementRoughPaths(element);
      assert.ok(paths.length > 0, `expected paths for ${element.type}`);

      for (const path of paths) {
        assert.equal(typeof path.d, "string");
        assert.ok(path.d.length > 0);
        assert.equal(typeof path.stroke, "string");
        assert.equal(typeof path.strokeWidth, "number");
        assert.equal(typeof path.fill, "string");
      }
    }

    assert.equal(getElementRoughPaths(createText()).length, 0);
    assert.equal(getElementRoughPaths(createIcon()).length, 0);

    const arrowPaths = getElementRoughPaths(createArrow({ seed: 1 }));
    const linePaths = getElementRoughPaths(createLine({ seed: 1 }));
    assert.ok(arrowPaths.length > linePaths.length, "arrow has head paths");
  });

  test("renders deterministically for the same seeded element", () => {
    const element = createRectangle({ seed: 7 });
    const firstPaths = getElementRoughPaths(element);
    const secondPaths = getElementRoughPaths(element);

    assert.deepEqual(firstPaths, secondPaths);
    assert.ok(getElementRoughPaths(createArrow()).length >= 3);
    assert.ok(getElementRoughPaths(createDiamond({ seed: 3 })).length > 0);
  });
});

describe("diagram page utilities", () => {
  test("parses valid payloads and treats an empty object as the empty document", () => {
    const document = createDocument([createRectangle()], {
      x: 10,
      y: 20,
      zoom: 1.5,
    });

    const parsed = parsePayload(document);
    assert.equal(parsed.viewport.x, 10);
    assert.equal(parsed.viewport.zoom, 1.5);
    assert.equal(parsed.elements.length, 1);
    assert.equal(parsed.elements[0]?.type, "rectangle");

    assert.equal(parsePayload({}), EMPTY_DOCUMENT);
  });

  test("throws on corrupt or partial diagram payloads", () => {
    const invalidPayloads = [
      { version: 99, nonsense: true },
      "not an object",
      null,
      undefined,
      42,
      [],
      { version: 1, elements: [] },
      { version: 1, viewport: { x: 0, y: 0, zoom: 1 } },
      {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        elements: [{ id: "bad", type: "unknown-type", seed: 1 }],
      },
    ];

    for (const payload of invalidPayloads) {
      assert.throws(() => parsePayload(payload));
    }
  });

  test("produces deterministic snapshots and detects dirty state changes", () => {
    const baseSnapshot = diagramSnapshot("", EMPTY_DOCUMENT);
    assert.equal(diagramSnapshot("", EMPTY_DOCUMENT), baseSnapshot);
    assert.notEqual(
      diagramSnapshot("My Diagram", EMPTY_DOCUMENT),
      baseSnapshot,
    );

    const document = createDocument([createRectangle()]);
    const savedSnapshot = diagramSnapshot("Diagram", document);

    assert.equal(diagramSnapshot("Diagram", document), savedSnapshot);
    assert.notEqual(
      diagramSnapshot(
        "Diagram",
        createDocument([createRectangle({ x: 50, y: 60 })]),
      ),
      savedSnapshot,
    );
    assert.notEqual(
      diagramSnapshot(
        "Diagram",
        createDocument([], { x: 100, y: 200, zoom: 2 }),
      ),
      baseSnapshot,
    );
  });

  test("round-trips saved documents through JSON serialization", () => {
    const document = createDocument(
      [
        createRectangle({ text: "Hello" }),
        createCircle({ text: "Circle" }),
        createArrow({
          startX: 110,
          startY: 45,
          endX: 160,
          endY: 200,
          startBinding: "rect-1",
          endBinding: "circle-1",
        }),
      ],
      { x: 50, y: -30, zoom: 2 },
    );

    const restored = parseDiagramDocument(JSON.parse(JSON.stringify(document)));

    assert.deepEqual(restored, document);
    assert.equal(
      diagramSnapshot("Round Trip", restored),
      diagramSnapshot("Round Trip", document),
    );
  });
});

describe("canvas coordinate utilities", () => {
  test("maps screen coordinates into canvas coordinates", () => {
    const defaultViewport = { x: 0, y: 0, zoom: 1 };
    const rect = { width: 800, height: 600 };

    assert.deepEqual(screenToCanvas(400, 300, defaultViewport, rect), {
      x: 0,
      y: 0,
    });
    assert.deepEqual(screenToCanvas(0, 0, defaultViewport, rect), {
      x: -400,
      y: -300,
    });
    assert.deepEqual(
      screenToCanvas(400, 300, { x: 100, y: 50, zoom: 1 }, rect),
      {
        x: 100,
        y: 50,
      },
    );
    assert.deepEqual(screenToCanvas(0, 0, { x: 0, y: 0, zoom: 2 }, rect), {
      x: -200,
      y: -150,
    });
  });

  test("maps canvas coordinates back to screen space and preserves round trips", () => {
    const viewport = { x: 50, y: -30, zoom: 1.5 };
    const svgRect = { width: 1024, height: 768 };
    const screenPoint = { x: 200, y: 150 };
    const canvasPoint = screenToCanvas(
      screenPoint.x,
      screenPoint.y,
      viewport,
      svgRect,
    );
    const roundTrip = canvasToScreen(
      canvasPoint.x,
      canvasPoint.y,
      viewport,
      svgRect,
    );

    assertClose(roundTrip.x, screenPoint.x, "screen-to-canvas round trip x");
    assertClose(roundTrip.y, screenPoint.y, "screen-to-canvas round trip y");

    const reverseViewport = { x: -100, y: 200, zoom: 0.5 };
    const reverseRect = { width: 600, height: 400 };
    const reverseScreen = canvasToScreen(75, -25, reverseViewport, reverseRect);
    const reverseRoundTrip = screenToCanvas(
      reverseScreen.x,
      reverseScreen.y,
      reverseViewport,
      reverseRect,
    );

    assertClose(reverseRoundTrip.x, 75, "canvas-to-screen round trip x");
    assertClose(reverseRoundTrip.y, -25, "canvas-to-screen round trip y");
  });

  test("computes viewBox strings from the viewport", () => {
    assert.equal(
      getViewBox({ x: 0, y: 0, zoom: 1 }, 800, 600),
      "-400 -300 800 600",
    );
    assert.equal(
      getViewBox({ x: 0, y: 0, zoom: 2 }, 800, 600),
      "-200 -150 400 300",
    );
    assert.equal(
      getViewBox({ x: 100, y: 50, zoom: 1 }, 800, 600),
      "-300 -250 800 600",
    );
  });
});

describe("canvas reducer", () => {
  test("supports every tool type", () => {
    const initialState = createCanvasState();
    const allTools: ToolType[] = [
      "select",
      "rectangle",
      "circle",
      "cylinder",
      "diamond",
      "icon",
      "text",
      "line",
      "arrow",
    ];

    for (const tool of allTools) {
      const next = canvasReducer(initialState, { type: "SET_TOOL", tool });
      assert.equal(next.tool, tool);
    }
  });

  test("adds elements and updates them individually or in batches", () => {
    const rectangle = createRectangle({ id: "rect-001" });
    const circle = createCircle({ id: "circle-001" });

    let state = canvasReducer(createCanvasState(), {
      type: "ADD_ELEMENT",
      element: rectangle,
    });
    state = canvasReducer(state, { type: "ADD_ELEMENT", element: circle });

    assert.equal(state.document.elements.length, 2);
    assert.equal(state.document.elements[0]?.id, "rect-001");
    assert.equal(state.document.elements[1]?.id, "circle-001");

    state = canvasReducer(state, {
      type: "UPDATE_ELEMENT",
      id: "rect-001",
      patch: { x: 50, y: 60 },
    });
    assert.equal((state.document.elements[0] as RectangleElement).x, 50);
    assert.equal((state.document.elements[0] as RectangleElement).y, 60);

    state = canvasReducer(state, {
      type: "UPDATE_ELEMENTS",
      updates: [
        { id: "rect-001", patch: { x: 100, y: 200 } },
        { id: "circle-001", patch: { cx: 300, cy: 400 } },
      ],
    });

    assert.equal((state.document.elements[0] as RectangleElement).x, 100);
    assert.equal((state.document.elements[0] as RectangleElement).y, 200);
    assert.equal((state.document.elements[1] as CircleElement).cx, 300);
    assert.equal((state.document.elements[1] as CircleElement).cy, 400);
  });

  test("deletes elements and keeps selection in sync", () => {
    const rectangle = createRectangle({ id: "rect-001" });
    const firstCircle = createCircle({ id: "circle-001" });
    const secondCircle = createCircle({ id: "circle-002", cx: 50, cy: 50 });

    let state = canvasReducer(createCanvasState(), {
      type: "ADD_ELEMENT",
      element: rectangle,
    });
    state = canvasReducer(state, { type: "ADD_ELEMENT", element: firstCircle });
    state = canvasReducer(state, {
      type: "ADD_ELEMENT",
      element: secondCircle,
    });
    state = canvasReducer(state, {
      type: "SET_SELECTION",
      ids: ["rect-001", "circle-001", "circle-002"],
    });

    const next = canvasReducer(state, {
      type: "DELETE_ELEMENTS",
      ids: ["rect-001", "circle-002"],
    });

    assert.equal(next.document.elements.length, 1);
    assert.equal(next.document.elements[0]?.id, "circle-001");
    assert.deepEqual(Array.from(next.selectedIds), ["circle-001"]);
  });

  test("handles selection, viewport, document replacement, and no-op actions safely", () => {
    const rectangle = createRectangle({ id: "rect-001" });
    const initialState = canvasReducer(createCanvasState(), {
      type: "ADD_ELEMENT",
      element: rectangle,
    });

    const selected = canvasReducer(initialState, {
      type: "SET_SELECTION",
      ids: ["rect-001"],
    });
    assert.deepEqual(Array.from(selected.selectedIds), ["rect-001"]);

    const cleared = canvasReducer(selected, { type: "CLEAR_SELECTION" });
    assert.equal(cleared.selectedIds.size, 0);

    const viewportState = canvasReducer(initialState, {
      type: "SET_VIEWPORT",
      viewport: { x: 100, y: 200, zoom: 1.5 },
    });
    assert.deepEqual(viewportState.document.viewport, {
      x: 100,
      y: 200,
      zoom: 1.5,
    });
    assert.equal(viewportState.document.elements.length, 1);

    const documentState = canvasReducer(selected, {
      type: "SET_DOCUMENT",
      document: createDocument([rectangle], { x: 50, y: 50, zoom: 2 }),
    });
    assert.equal(documentState.document.viewport.zoom, 2);
    assert.equal(documentState.selectedIds.size, 0);

    const unchangedByMissingUpdate = canvasReducer(initialState, {
      type: "UPDATE_ELEMENT",
      id: "missing",
      patch: { x: 999 },
    });
    assert.equal(
      (unchangedByMissingUpdate.document.elements[0] as RectangleElement).x,
      10,
    );

    const unchangedByEmptyBatch = canvasReducer(initialState, {
      type: "UPDATE_ELEMENTS",
      updates: [],
    });
    assert.equal(
      (unchangedByEmptyBatch.document.elements[0] as RectangleElement).x,
      10,
    );

    const unchangedByUnknownAction = canvasReducer(initialState, {
      type: "UNKNOWN",
    } as never);
    assert.equal(unchangedByUnknownAction, initialState);
  });
});

describe("canvas hit testing", () => {
  test("hit tests rectangles, circles, cylinders, diamonds, icons, and text", () => {
    const rectangle = createRectangle();
    assert.equal(hitTestElement({ x: 60, y: 45 }, rectangle), true);
    assert.equal(hitTestElement({ x: 5, y: 45 }, rectangle), false);

    const icon = createIcon();
    assert.equal(hitTestElement({ x: 60, y: 45 }, icon), true);
    assert.equal(hitTestElement({ x: 5, y: 45 }, icon), false);

    const circle = createCircle({ cx: 100, cy: 100, radius: 50 });
    assert.equal(hitTestElement({ x: 100, y: 100 }, circle), true);
    assert.equal(hitTestElement({ x: 150, y: 100 }, circle), true);
    assert.equal(hitTestElement({ x: 155, y: 100 }, circle), false);

    const cylinder = createCylinder({ x: 50, y: 50, width: 80, height: 120 });
    assert.equal(hitTestElement({ x: 90, y: 100 }, cylinder), true);
    assert.equal(hitTestElement({ x: 45, y: 100 }, cylinder), false);

    // Diamond: center hits; AABB corner is outside the silhouette
    const diamond = createDiamond({ x: 0, y: 0, width: 100, height: 100 });
    assert.equal(hitTestElement({ x: 50, y: 50 }, diamond), true);
    assert.equal(hitTestElement({ x: 50, y: 0 }, diamond), true);
    assert.equal(hitTestElement({ x: 0, y: 0 }, diamond), false);
    assert.equal(hitTestElement({ x: 5, y: 5 }, diamond), false);

    const text = createText({
      x: 10,
      y: 20,
      text: "Hello\nWorld\nFoo",
      fontSize: 16,
    });
    assert.equal(hitTestElement({ x: 30, y: 50 }, text), true);
    assert.equal(hitTestElement({ x: 30, y: 80 }, text), false);
  });

  test("hit tests arrows and lines at the threshold and handles zero-length segments", () => {
    const arrow = createArrow({ startX: 0, startY: 0, endX: 100, endY: 0 });
    assert.equal(hitTestElement({ x: 50, y: 0 }, arrow), true);
    assert.equal(hitTestElement({ x: 50, y: 5 }, arrow), true);
    assert.equal(hitTestElement({ x: 50, y: 5.01 }, arrow), false);
    assert.equal(hitTestElement({ x: -10, y: 0 }, arrow), false);

    const line = createLine({ startX: 0, startY: 0, endX: 100, endY: 0 });
    assert.equal(hitTestElement({ x: 50, y: 0 }, line), true);
    assert.equal(hitTestElement({ x: 50, y: 5 }, line), true);
    assert.equal(hitTestElement({ x: 50, y: 5.01 }, line), false);

    const diagonalArrow = createArrow({
      startX: 0,
      startY: 0,
      endX: 100,
      endY: 100,
    });
    assert.equal(hitTestElement({ x: 50, y: 50 }, diagonalArrow), true);
    assert.equal(hitTestElement({ x: 0, y: 100 }, diagonalArrow), false);

    const pointArrow = createArrow({
      startX: 10,
      startY: 10,
      endX: 10,
      endY: 10,
    });
    assert.equal(hitTestElement({ x: 13, y: 14 }, pointArrow), true);
    assert.equal(hitTestElement({ x: 20, y: 20 }, pointArrow), false);
  });

  test("returns the topmost hit element and null when nothing is hit", () => {
    const bottomRectangle = createRectangle({
      id: "r1",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const topRectangle = createRectangle({
      id: "r2",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });

    assert.equal(
      hitTest({ x: 75, y: 75 }, [bottomRectangle, topRectangle])?.id,
      "r2",
    );
    assert.equal(
      hitTest({ x: 25, y: 25 }, [bottomRectangle, topRectangle])?.id,
      "r1",
    );
    assert.equal(
      hitTest({ x: 200, y: 200 }, [bottomRectangle, topRectangle]),
      null,
    );
    assert.equal(hitTest({ x: 50, y: 50 }, []), null);
  });

  test("reports resize handles and detects hits on them", () => {
    const bounds = { x: 10, y: 20, width: 100, height: 50 };
    const handles = getResizeHandles(bounds);

    assert.equal(handles.length, 8);
    assert.deepEqual(
      handles.find((handle) => handle.position === "nw"),
      {
        position: "nw",
        x: 10,
        y: 20,
      },
    );
    assert.deepEqual(
      handles.find((handle) => handle.position === "se"),
      {
        position: "se",
        x: 110,
        y: 70,
      },
    );
    assert.deepEqual(
      handles.find((handle) => handle.position === "n"),
      {
        position: "n",
        x: 60,
        y: 20,
      },
    );

    assert.equal(hitTestResizeHandle({ x: 10, y: 20 }, bounds, 5), "nw");
    assert.equal(hitTestResizeHandle({ x: 13, y: 23 }, bounds, 5), "nw");
    assert.equal(hitTestResizeHandle({ x: 115, y: 75 }, bounds, 5), "se");
    assert.equal(hitTestResizeHandle({ x: 60, y: 45 }, bounds, 5), null);
  });

  test("hit-tests connection points with topmost element preference", () => {
    const back = createRectangle({ id: "back", x: 0, y: 0, width: 200, height: 200 });
    const front = createRectangle({
      id: "front",
      x: 50,
      y: 50,
      width: 100,
      height: 50,
    });

    const hit = hitTestConnectionPoint({ x: 100, y: 50 }, [back, front], 8);
    assert.ok(hit);
    assert.equal(hit.elementId, "front");
    assertClose(hit.point.x, 100, "front top midpoint x");
    assertClose(hit.point.y, 50, "front top midpoint y");

    assert.equal(
      hitTestConnectionPoint({ x: 999, y: 999 }, [back, front], 8),
      null,
    );
  });
});

describe("diagram renderer colors", () => {
  test("defaults to theme-aware inherit colors", () => {
    assert.deepEqual(DEFAULT_DIAGRAM_COLORS, DIAGRAM_COLOR_PRESETS.inherit);
    assert.equal(resolveDiagramColors().stroke, "currentColor");
  });

  test("applies built-in presets", () => {
    assert.equal(resolveDiagramColors({ preset: "darkBlue" }).stroke, "#93c5fd");
    assert.equal(
      resolveDiagramColors({ preset: "darkBlue" }).fill,
      "rgba(59, 130, 246, 0.06)",
    );
  });

  test("merges custom overrides on top of presets", () => {
    const colors = resolveDiagramColors({
      preset: "dark",
      colors: { stroke: "#60a5fa" },
    });

    assert.equal(colors.stroke, "#60a5fa");
    assert.equal(colors.text, "currentColor");
  });
});

describe("icon catalog resolution", () => {
  const sampleSvg =
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>';

  const catalog: DiagramIcon[] = [
    {
      iconId: "server",
      svg: sampleSvg,
      label: "Server",
      defaultWidth: 64,
      defaultHeight: 64,
    },
    { iconId: "db", svg: '<path d="M0 0h10v10H0z" />' },
  ];

  test("resolveDiagramIcon finds by iconId and returns undefined when missing", () => {
    assert.equal(resolveDiagramIcon(catalog, "server")?.label, "Server");
    assert.equal(resolveDiagramIcon(catalog, "missing"), undefined);
    assert.equal(resolveDiagramIcon(undefined, "server"), undefined);
  });

  test("getIconRenderMode resolves or reports missing", () => {
    assert.deepEqual(getIconRenderMode(catalog, "server"), {
      kind: "resolved",
      icon: catalog[0],
    });
    assert.deepEqual(getIconRenderMode(catalog, "ghost"), {
      kind: "missing",
      iconId: "ghost",
    });
    assert.deepEqual(getIconRenderMode(undefined, "server"), {
      kind: "missing",
      iconId: "server",
    });
    assert.deepEqual(
      getIconRenderMode([{ iconId: "empty", svg: "   " }], "empty"),
      { kind: "missing", iconId: "empty" },
    );
  });

  test("partitionIconCatalog keeps valid entries and warns on invalid ones", () => {
    const { valid, warnings } = partitionIconCatalog([
      { iconId: "ok", svg: sampleSvg },
      { iconId: "", svg: sampleSvg },
      { iconId: "blank", svg: "" },
      { iconId: "ok", svg: sampleSvg },
      { iconId: "second", svg: '<rect width="1" height="1" />' },
    ]);

    assert.equal(valid.length, 2);
    assert.equal(valid[0]?.iconId, "ok");
    assert.equal(valid[1]?.iconId, "second");
    assert.equal(warnings.length, 3);
  });

  test("parseIconSvg extracts viewBox and inner content", () => {
    const parsed = parseIconSvg(sampleSvg);
    assert.ok(parsed);
    assert.equal(parsed.viewBox, "0 0 24 24");
    assert.match(parsed.content, /circle/);

    assert.equal(parseIconSvg(""), null);
    assert.equal(parseIconSvg("   "), null);
  });

  test("documents store iconId only and still validate without svg", () => {
    const document = createDocument([
      createIcon({ iconId: "server" }),
    ]);
    assert.ok(isDiagramDocument(document));
    const icon = parseDiagramDocument(document).elements[0] as IconElement;
    assert.equal(icon.iconId, "server");
    assert.equal("svg" in icon, false);
  });

  test("SET_TOOL tracks activeIconId for icon placement", () => {
    let state = createCanvasState();
    state = canvasReducer(state, {
      type: "SET_TOOL",
      tool: "icon",
      activeIconId: "server",
    });
    assert.equal(state.tool, "icon");
    assert.equal(state.activeIconId, "server");

    state = canvasReducer(state, { type: "SET_TOOL", tool: "select" });
    assert.equal(state.tool, "select");
    assert.equal(state.activeIconId, null);
  });
});
