import type {
  DiagramElement,
  RectangleElement,
  CircleElement,
  CylinderElement,
} from "./types";

// ── Bounding boxes ──

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Bounding box of a single element.
 */
export function getElementBounds(el: DiagramElement): Bounds {
  switch (el.type) {
    case "rectangle":
      return { x: el.x, y: el.y, width: el.width, height: el.height };

    case "circle":
      return {
        x: el.cx - el.radius,
        y: el.cy - el.radius,
        width: el.radius * 2,
        height: el.radius * 2,
      };

    case "cylinder":
      return { x: el.x, y: el.y, width: el.width, height: el.height };

    case "text": {
      const fontSize = el.fontSize ?? 16;
      // Split by newlines for multi-line text bounds
      const lines = el.text.split("\n");
      const maxLineLength = Math.max(...lines.map((l) => l.length), 1);
      const lineCount = lines.length;
      // Approximate text dimensions based on character count and font size
      const width = maxLineLength * fontSize * 0.6;
      const height = fontSize * 1.2 * lineCount;
      return { x: el.x, y: el.y, width, height };
    }

    case "arrow": {
      const minX = Math.min(el.startX, el.endX);
      const minY = Math.min(el.startY, el.endY);
      const maxX = Math.max(el.startX, el.endX);
      const maxY = Math.max(el.startY, el.endY);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
  }
}

/**
 * Bounding box of all elements combined (for auto-fit in portfolio renderer).
 * Returns null if the array is empty.
 */
export function getContentBounds(elements: DiagramElement[]): Bounds | null {
  if (elements.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const b = getElementBounds(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Center point of an element.
 */
export function getElementCenter(el: DiagramElement): { x: number; y: number } {
  if (el.type === "circle") {
    return { x: el.cx, y: el.cy };
  }
  const b = getElementBounds(el);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/**
 * Arrow anchor point: where a line from `from` to the shape center
 * intersects the shape boundary. Used for arrow rendering when an
 * arrow is bound to a shape.
 */
export function getAnchorPoint(
  element: RectangleElement | CircleElement | CylinderElement,
  from: { x: number; y: number },
): { x: number; y: number } {
  const center = getElementCenter(element);

  if (element.type === "circle") {
    const dx = from.x - center.x;
    const dy = from.y - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) {
      return { x: center.x + element.radius, y: center.y };
    }
    return {
      x: center.x + (dx / dist) * element.radius,
      y: center.y + (dy / dist) * element.radius,
    };
  }

  // Rectangle or cylinder: intersect line from center→from with bounding box
  const bounds = getElementBounds(element);
  return lineRectIntersection(center, from, bounds);
}

// ── Internal helpers ──

/**
 * Find where a ray from `inside` toward `outside` intersects a rectangle boundary.
 * Returns the intersection point closest to `inside`.
 */
function lineRectIntersection(
  inside: { x: number; y: number },
  outside: { x: number; y: number },
  rect: Bounds,
): { x: number; y: number } {
  const dx = outside.x - inside.x;
  const dy = outside.y - inside.y;

  let tMin = Infinity;

  // Left edge: x = rect.x
  if (dx !== 0) {
    const t = (rect.x - inside.x) / dx;
    if (t > 0 && t <= 1) {
      const y = inside.y + t * dy;
      if (y >= rect.y && y <= rect.y + rect.height) {
        tMin = Math.min(tMin, t);
      }
    }
  }

  // Right edge: x = rect.x + rect.width
  if (dx !== 0) {
    const t = (rect.x + rect.width - inside.x) / dx;
    if (t > 0 && t <= 1) {
      const y = inside.y + t * dy;
      if (y >= rect.y && y <= rect.y + rect.height) {
        tMin = Math.min(tMin, t);
      }
    }
  }

  // Top edge: y = rect.y
  if (dy !== 0) {
    const t = (rect.y - inside.y) / dy;
    if (t > 0 && t <= 1) {
      const x = inside.x + t * dx;
      if (x >= rect.x && x <= rect.x + rect.width) {
        tMin = Math.min(tMin, t);
      }
    }
  }

  // Bottom edge: y = rect.y + rect.height
  if (dy !== 0) {
    const t = (rect.y + rect.height - inside.y) / dy;
    if (t > 0 && t <= 1) {
      const x = inside.x + t * dx;
      if (x >= rect.x && x <= rect.x + rect.width) {
        tMin = Math.min(tMin, t);
      }
    }
  }

  if (tMin === Infinity) {
    // Degenerate case (inside === outside), return center
    return inside;
  }

  return {
    x: inside.x + tMin * dx,
    y: inside.y + tMin * dy,
  };
}
