import type { DiagramDocument, DiagramElement, Viewport } from "./types";

// ── Primitives ──

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Finite numbers only (rejects NaN / ±Infinity). */
function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || isString(value);
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || isNumber(value);
}

function hasBaseFields(value: Record<string, unknown>): boolean {
  return isString(value.id) && isNumber(value.seed);
}

// ── Element checks ──

function isRectangleElement(value: Record<string, unknown>): boolean {
  return (
    value.type === "rectangle" &&
    hasBaseFields(value) &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isNumber(value.width) &&
    isNumber(value.height) &&
    isOptionalString(value.text) &&
    isOptionalNumber(value.fontSize)
  );
}

function isCircleElement(value: Record<string, unknown>): boolean {
  return (
    value.type === "circle" &&
    hasBaseFields(value) &&
    isNumber(value.cx) &&
    isNumber(value.cy) &&
    isNumber(value.radius) &&
    isOptionalString(value.text) &&
    isOptionalNumber(value.fontSize)
  );
}

function isCylinderElement(value: Record<string, unknown>): boolean {
  return (
    value.type === "cylinder" &&
    hasBaseFields(value) &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isNumber(value.width) &&
    isNumber(value.height) &&
    isOptionalString(value.text) &&
    isOptionalNumber(value.fontSize)
  );
}

function isDiamondElement(value: Record<string, unknown>): boolean {
  return (
    value.type === "diamond" &&
    hasBaseFields(value) &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isNumber(value.width) &&
    isNumber(value.height) &&
    isOptionalString(value.text) &&
    isOptionalNumber(value.fontSize)
  );
}

function isIconElement(value: Record<string, unknown>): boolean {
  return (
    value.type === "icon" &&
    hasBaseFields(value) &&
    isString(value.iconId) &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isNumber(value.width) &&
    isNumber(value.height) &&
    isOptionalString(value.text) &&
    isOptionalNumber(value.fontSize)
  );
}

function isImageElement(value: Record<string, unknown>): boolean {
  if (!isString(value.src) || !value.src || value.src.trim() !== value.src || /[\u0000-\u0020\\]/.test(value.src)) return false;
  const src = value.src;
  const scheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.exec(src)?.[0].toLowerCase();
  if (scheme) {
    if (scheme === "http:" || scheme === "https:") {
      try { const url = new URL(src); if (!url.hostname) return false; } catch { return false; }
    } else if (scheme !== "data:" || !/^data:image\/[a-z0-9.+-]+[;,]/i.test(src)) return false;
  } else if (src.startsWith("//")) return false;
  return hasBaseFields(value) && isNumber(value.x) && isNumber(value.y) &&
    [value.width, value.height, value.naturalWidth, value.naturalHeight].every(v => isNumber(v) && v > 0) &&
    isOptionalString(value.alt);
}

function isTextElement(value: Record<string, unknown>): boolean {
  return (
    value.type === "text" &&
    hasBaseFields(value) &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isString(value.text) &&
    isOptionalNumber(value.fontSize) &&
    isOptionalNumber(value.width) &&
    isOptionalNumber(value.height)
  );
}

function isArrowElement(value: Record<string, unknown>): boolean {
  return (
    value.type === "arrow" &&
    hasBaseFields(value) &&
    isNumber(value.startX) &&
    isNumber(value.startY) &&
    isNumber(value.endX) &&
    isNumber(value.endY) &&
    isOptionalString(value.startBinding) &&
    isOptionalString(value.endBinding)
  );
}

function isLineElement(value: Record<string, unknown>): boolean {
  return (
    value.type === "line" &&
    hasBaseFields(value) &&
    isNumber(value.startX) &&
    isNumber(value.startY) &&
    isNumber(value.endX) &&
    isNumber(value.endY) &&
    isOptionalString(value.startBinding) &&
    isOptionalString(value.endBinding)
  );
}

function isDiagramElement(value: unknown): value is DiagramElement {
  if (!isRecord(value)) return false;

  switch (value.type) {
    case "rectangle":
      return isRectangleElement(value);
    case "circle":
      return isCircleElement(value);
    case "cylinder":
      return isCylinderElement(value);
    case "diamond":
      return isDiamondElement(value);
    case "icon":
      return isIconElement(value);
    case "image":
      return isImageElement(value);
    case "text":
      return isTextElement(value);
    case "arrow":
      return isArrowElement(value);
    case "line":
      return isLineElement(value);
    default:
      return false;
  }
}

function isViewport(value: unknown): value is Viewport {
  return (
    isRecord(value) &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isNumber(value.zoom)
  );
}

// ── Public API ──

/**
 * Type guard: returns true if the payload is a valid DiagramDocument.
 */
export function isDiagramDocument(data: unknown): data is DiagramDocument {
  if (!isRecord(data)) return false;
  if (data.version !== 1) return false;
  if (!isViewport(data.viewport)) return false;
  if (!Array.isArray(data.elements)) return false;
  return data.elements.every(isDiagramElement);
}

/**
 * Parse and validate an unknown payload as a DiagramDocument.
 * Throws if the payload is invalid.
 */
export function parseDiagramDocument(data: unknown): DiagramDocument {
  if (!isDiagramDocument(data)) {
    throw new Error("Invalid DiagramDocument");
  }
  return data;
}
