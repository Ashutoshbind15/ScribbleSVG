import { useMemo } from "react";
import type { DiagramElement } from "@packages/diagram";
import {
  getElementRoughPaths,
  getElementBounds,
  DEFAULT_SHAPE_LABEL_FONT_SIZE,
  DEFAULT_TEXT_FONT_SIZE,
} from "@packages/diagram";
import { TextRenderer } from "./TextRenderer";

interface ElementRendererProps {
  element: DiagramElement;
  isSelected: boolean;
  /** When true, skip rendering text so the inline editor doesn't overlap it */
  isEditingText?: boolean;
}

/**
 * Renders a single DiagramElement as an SVG `<g>` group.
 * - Shape elements get Rough.js SVG paths
 * - Text elements get multi-line SVG `<text>` via TextRenderer
 * - Shapes with optional text get centered labels via TextRenderer
 * - A transparent hit-area rect covers the bounding box for pointer events
 *
 * Note: pointer events are handled at the canvas level via hit-testing,
 * not per-element. The `data-element-id` attribute is for identification only.
 */
export function ElementRenderer({
  element,
  isSelected,
  isEditingText = false,
}: ElementRendererProps) {
  const paths = useMemo(() => getElementRoughPaths(element), [element]);
  const bounds = useMemo(() => getElementBounds(element), [element]);

  return (
    <g data-element-id={element.id} data-element-type={element.type}>
      {/* Invisible hit area for easier clicking */}
      <rect
        x={bounds.x}
        y={bounds.y}
        width={Math.max(bounds.width, 1)}
        height={Math.max(bounds.height, 1)}
        fill="transparent"
        stroke="none"
        pointerEvents="none"
      />

      {/* Rough.js paths */}
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          stroke={p.stroke}
          strokeWidth={p.strokeWidth}
          fill={p.fill}
          pointerEvents="none"
        />
      ))}

      {/* Standalone text elements — multi-line support */}
      {element.type === "text" && !isEditingText && (
        <TextRenderer
          mode="standalone"
          x={element.x}
          y={element.y}
          text={element.text}
          fontSize={element.fontSize ?? DEFAULT_TEXT_FONT_SIZE}
        />
      )}

      {/* Shape labels — centered multi-line text */}
      {!isEditingText &&
        element.type !== "text" &&
        element.type !== "arrow" &&
        "text" in element &&
        element.text && (
          <TextRenderer
            mode="shape-label"
            cx={bounds.x + bounds.width / 2}
            cy={bounds.y + bounds.height / 2}
            text={element.text}
            fontSize={element.fontSize ?? DEFAULT_SHAPE_LABEL_FONT_SIZE}
          />
        )}
    </g>
  );
}
