// ── Core element types ──

export type ElementType =
  | "rectangle"
  | "circle"
  | "cylinder"
  | "icon"
  | "text"
  | "arrow";

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

/** Extensible icon; rendered as a rectangle until custom SVG resolution exists. */
export interface IconElement extends BaseElement {
  type: "icon";
  /** Opaque consumer key for later SVG resolution (e.g. "iconpack:icon-name"). */
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

// Arrow element

export interface ArrowElement extends BaseElement {
  type: "arrow";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startBinding?: string; // element ID or undefined (free-floating)
  endBinding?: string; // element ID or undefined (free-floating)
}

// Union type

export type DiagramElement =
  | RectangleElement
  | CircleElement
  | CylinderElement
  | IconElement
  | TextElement
  | ArrowElement;

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
