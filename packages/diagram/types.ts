// ── Core element types ──

export type ElementType =
  | "rectangle"
  | "circle"
  | "cylinder"
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
}

export interface CircleElement extends BaseElement {
  type: "circle";
  cx: number;
  cy: number;
  radius: number;
  text?: string;
}

export interface CylinderElement extends BaseElement {
  type: "cylinder";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
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
