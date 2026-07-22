// ── Core element types ──

export type ElementType =
  | "rectangle"
  | "circle"
  | "cylinder"
  | "diamond"
  | "icon"
  | "text"
  | "arrow"
  | "line";

// Base element (all elements extend this)
export interface BaseElement {
  id: string; // UUID
  type: ElementType;
  seed: number; // deterministic Rough.js rendering
}

// Shape elements

export interface RectangleElement extends BaseElement {
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fontSize?: number; // default 14
}

export interface CircleElement extends BaseElement {
  type: "circle";
  cx: number;
  cy: number;
  radius: number;
  text?: string;
  fontSize?: number; // default 14
}

export interface CylinderElement extends BaseElement {
  type: "cylinder";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fontSize?: number; // default 14
}

/** Decision / flowchart diamond; AABB circumscribes the diamond silhouette. */
export interface DiamondElement extends BaseElement {
  type: "diamond";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fontSize?: number; // default 14
}

/** Icon element; artwork is resolved from a consumer `icons` catalog by `iconId`. */
export interface IconElement extends BaseElement {
  type: "icon";
  /** Opaque consumer key matched against a DiagramIcon catalog (e.g. "iconpack:icon-name"). */
  iconId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fontSize?: number; // default 14
}

// Standalone text element

export interface TextElement extends BaseElement {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize?: number; // default 16
  /** Explicit box size (set after resize); omitted until first resize */
  width?: number;
  height?: number;
}

// Connectors

export interface ArrowElement extends BaseElement {
  type: "arrow";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startBinding?: string; // element ID or undefined (free-floating)
  endBinding?: string; // element ID or undefined (free-floating)
}

/** Straight connector without arrowheads; same binding model as arrow. */
export interface LineElement extends BaseElement {
  type: "line";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startBinding?: string;
  endBinding?: string;
}

export type ConnectorElement = ArrowElement | LineElement;

// Union type

export type DiagramElement =
  | RectangleElement
  | CircleElement
  | CylinderElement
  | DiamondElement
  | IconElement
  | TextElement
  | ArrowElement
  | LineElement;

/** Elements that can receive arrow/line bindings. */
export type BindableElement = Exclude<DiagramElement, ConnectorElement>;

/** True for arrow/line connectors (not bind targets). */
export function isConnector(el: DiagramElement): el is ConnectorElement {
  return el.type === "arrow" || el.type === "line";
}

/** True for shapes/text that connectors can bind to. */
export function isBindable(el: DiagramElement): el is BindableElement {
  return !isConnector(el);
}

// Viewport

export interface Viewport {
  x: number; // pan offset X (canvas coords of viewport center)
  y: number; // pan offset Y
  zoom: number; // 1 = 100%
}

// Top-level document

export interface DiagramDocument {
  version: 1;
  viewport: Viewport;
  elements: DiagramElement[];
}
