import rough from "roughjs";
import type {
  DiagramElement,
  RectangleElement,
  CircleElement,
  CylinderElement,
  ArrowElement,
} from "./types";

// ── Public types ──

/**
 * Serializable SVG path data produced by Rough.js.
 * Safe for SSR — no DOM dependency.
 */
export interface RoughPathData {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill: string;
}

// ── Generator (singleton, stateless — seed is per-call) ──

const generator = rough.generator();

// ── Public API ──

/**
 * Generate Rough.js SVG path data for a diagram element.
 * Returns an array of paths that, when rendered as `<path>` elements,
 * produce the hand-drawn appearance.
 *
 * Text elements return an empty array — text rendering is handled
 * by the consuming React component.
 */
export function getElementRoughPaths(element: DiagramElement): RoughPathData[] {
  switch (element.type) {
    case "rectangle":
      return getRectanglePaths(element);
    case "circle":
      return getCirclePaths(element);
    case "cylinder":
      return getCylinderPaths(element);
    case "arrow":
      return getArrowPaths(element);
    case "text":
      return [];
  }
}

// ── Element renderers ──

function getRectanglePaths(el: RectangleElement): RoughPathData[] {
  const drawable = generator.rectangle(el.x, el.y, el.width, el.height, {
    seed: el.seed,
  });
  return generator.toPaths(drawable).map(normalizePathInfo);
}

function getCirclePaths(el: CircleElement): RoughPathData[] {
  const drawable = generator.circle(el.cx, el.cy, el.radius * 2, {
    seed: el.seed,
  });
  return generator.toPaths(drawable).map(normalizePathInfo);
}

function getCylinderPaths(el: CylinderElement): RoughPathData[] {
  // Ellipse cap height: proportional to width, capped to avoid visual distortion
  const ellipseHeight = Math.min(el.width * 0.25, el.height * 0.3);
  const cx = el.x + el.width / 2;
  const topCy = el.y + ellipseHeight / 2;
  const bottomCy = el.y + el.height - ellipseHeight / 2;

  const paths: RoughPathData[] = [];

  // Left side line
  const leftLine = generator.line(el.x, topCy, el.x, bottomCy, {
    seed: el.seed,
  });
  paths.push(...generator.toPaths(leftLine).map(normalizePathInfo));

  // Right side line
  const rightLine = generator.line(
    el.x + el.width,
    topCy,
    el.x + el.width,
    bottomCy,
    { seed: el.seed + 1 },
  );
  paths.push(...generator.toPaths(rightLine).map(normalizePathInfo));

  // Top ellipse (full)
  const topEllipse = generator.ellipse(cx, topCy, el.width, ellipseHeight, {
    seed: el.seed + 2,
  });
  paths.push(...generator.toPaths(topEllipse).map(normalizePathInfo));

  // Bottom arc (lower half only — upper half hidden by body)
  const bottomArc = generator.arc(
    cx,
    bottomCy,
    el.width,
    ellipseHeight,
    0,
    Math.PI,
    false,
    { seed: el.seed + 3 },
  );
  paths.push(...generator.toPaths(bottomArc).map(normalizePathInfo));

  return paths;
}

function getArrowPaths(el: ArrowElement): RoughPathData[] {
  const paths: RoughPathData[] = [];

  // Shaft line
  const line = generator.line(el.startX, el.startY, el.endX, el.endY, {
    seed: el.seed,
  });
  paths.push(...generator.toPaths(line).map(normalizePathInfo));

  // Arrowhead (two short lines at ±30° from arrow direction)
  const angle = Math.atan2(el.endY - el.startY, el.endX - el.startX);
  const headLength = 15;
  const headAngle = Math.PI / 6;

  const h1x = el.endX - headLength * Math.cos(angle - headAngle);
  const h1y = el.endY - headLength * Math.sin(angle - headAngle);
  const h2x = el.endX - headLength * Math.cos(angle + headAngle);
  const h2y = el.endY - headLength * Math.sin(angle + headAngle);

  const head1 = generator.line(el.endX, el.endY, h1x, h1y, {
    seed: el.seed + 1,
  });
  const head2 = generator.line(el.endX, el.endY, h2x, h2y, {
    seed: el.seed + 2,
  });
  paths.push(...generator.toPaths(head1).map(normalizePathInfo));
  paths.push(...generator.toPaths(head2).map(normalizePathInfo));

  return paths;
}

// ── Helpers ──

/**
 * Normalize PathInfo from Rough.js (where fill can be undefined)
 * into our RoughPathData (where fill is always a string).
 */
function normalizePathInfo(info: {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill?: string;
}): RoughPathData {
  return {
    d: info.d,
    stroke: info.stroke,
    strokeWidth: info.strokeWidth,
    fill: info.fill ?? "none",
  };
}
