import type {
  DiagramDocument,
  DiagramElement,
  ElementType,
  Viewport,
} from "./types";

type Fields = Record<string, unknown>;

// ── Primitives ──

function isRecord(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Finite numbers only (rejects NaN / ±Infinity). */
function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
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

// ── Field groups shared by several element types ──

/** `id` and `seed`, present on every element. */
function hasBaseFields(value: Fields): boolean {
  return isString(value.id) && isNumber(value.seed);
}

/** Top-left box: `x`, `y`, `width`, `height`. */
function hasBox(value: Fields): boolean {
  return (
    isNumber(value.x) &&
    isNumber(value.y) &&
    isNumber(value.width) &&
    isNumber(value.height)
  );
}

/** Optional centred label on a shape. */
function hasOptionalLabel(value: Fields): boolean {
  return isOptionalString(value.text) && isOptionalNumber(value.fontSize);
}

/** Connector endpoints and their optional bindings. */
function hasEndpoints(value: Fields): boolean {
  return (
    isNumber(value.startX) &&
    isNumber(value.startY) &&
    isNumber(value.endX) &&
    isNumber(value.endY) &&
    isOptionalString(value.startBinding) &&
    isOptionalString(value.endBinding)
  );
}

// ── Image sources ──

/** Stand-in page origin that relative paths are resolved against. */
const RELATIVE_BASE = new URL("https://relative.invalid/");
const URL_SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const DATA_IMAGE_URI = /^data:image\/[a-z0-9.+-]+[;,]/i;
/**
 * Browsers silently drop tabs and newlines inside URLs and trim surrounding
 * whitespace, so `"java\tscript:"` would load as `"javascript:"`. Sources
 * containing control characters are rejected rather than normalised.
 */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function parseUrl(src: string): URL | null {
  try {
    return new URL(src, RELATIVE_BASE);
  } catch {
    return null;
  }
}

/**
 * Image sources are rendered as-is, so only three forms are allowed:
 * - absolute `http:` / `https:` URLs,
 * - relative or root-relative paths (`photo.png`, `../a.png`, `/a.png`),
 * - inline `data:image/<subtype>` URIs.
 *
 * Everything else is rejected: other schemes (`javascript:`, `blob:`, …) and
 * scheme-less paths that would leave the page's host (`//host`, `\\host`).
 */
function isAllowedImageSrc(src: string): boolean {
  if (src === "" || src.trim() !== src || CONTROL_CHARACTERS.test(src)) {
    return false;
  }
  const url = parseUrl(src);
  if (!url) return false;

  const scheme = URL_SCHEME.exec(src)?.[1].toLowerCase();
  switch (scheme) {
    case undefined:
      // A relative path must resolve on the page's own host.
      return url.origin === RELATIVE_BASE.origin;
    case "http":
    case "https":
      return true;
    case "data":
      return DATA_IMAGE_URI.test(src);
    default:
      return false;
  }
}

// ── Elements ──

/**
 * The type-specific fields of each element. `satisfies` makes a new
 * `ElementType` without a check here a compile error.
 */
const elementFieldChecks = {
  rectangle: (v) => hasBox(v) && hasOptionalLabel(v),
  cylinder: (v) => hasBox(v) && hasOptionalLabel(v),
  diamond: (v) => hasBox(v) && hasOptionalLabel(v),
  circle: (v) =>
    isNumber(v.cx) &&
    isNumber(v.cy) &&
    isNumber(v.radius) &&
    hasOptionalLabel(v),
  icon: (v) => isString(v.iconId) && hasBox(v) && hasOptionalLabel(v),
  image: (v) =>
    isString(v.src) &&
    isAllowedImageSrc(v.src) &&
    isNumber(v.x) &&
    isNumber(v.y) &&
    isPositiveNumber(v.width) &&
    isPositiveNumber(v.height) &&
    isPositiveNumber(v.naturalWidth) &&
    isPositiveNumber(v.naturalHeight) &&
    isOptionalString(v.alt),
  text: (v) =>
    isNumber(v.x) &&
    isNumber(v.y) &&
    isString(v.text) &&
    isOptionalNumber(v.fontSize) &&
    isOptionalNumber(v.width) &&
    isOptionalNumber(v.height),
  arrow: hasEndpoints,
  line: hasEndpoints,
} satisfies Record<ElementType, (value: Fields) => boolean>;

function isElementType(value: unknown): value is ElementType {
  return isString(value) && Object.hasOwn(elementFieldChecks, value);
}

/** True when `value` is a structurally valid diagram element. */
export function isDiagramElement(value: unknown): value is DiagramElement {
  return (
    isRecord(value) &&
    isElementType(value.type) &&
    hasBaseFields(value) &&
    elementFieldChecks[value.type](value)
  );
}

function isViewport(value: unknown): value is Viewport {
  return (
    isRecord(value) &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isNumber(value.zoom)
  );
}

// ── Documents ──

/**
 * Type guard: returns true if the payload is a valid DiagramDocument.
 */
export function isDiagramDocument(data: unknown): data is DiagramDocument {
  return (
    isRecord(data) &&
    data.version === 1 &&
    isViewport(data.viewport) &&
    Array.isArray(data.elements) &&
    data.elements.every(isDiagramElement)
  );
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
