import { useMemo } from "react";
import type { DiagramElement } from "@packages/diagram";
import { getElementBounds } from "@packages/diagram";

interface SelectionOverlayProps {
  elements: DiagramElement[];
  selectedIds: Set<string>;
}

const PADDING = 4; // extra padding around the bounding box

/**
 * Renders dashed bounding box overlays for all selected elements.
 * Rendered after all elements so the overlay is always on top.
 */
export function SelectionOverlay({
  elements,
  selectedIds,
}: SelectionOverlayProps) {
  const selectedElements = useMemo(
    () => elements.filter((el) => selectedIds.has(el.id)),
    [elements, selectedIds],
  );

  if (selectedElements.length === 0) return null;

  return (
    <g className="selection-overlay" pointerEvents="none">
      {selectedElements.map((el) => {
        const bounds = getElementBounds(el);
        return (
          <rect
            key={el.id}
            x={bounds.x - PADDING}
            y={bounds.y - PADDING}
            width={bounds.width + PADDING * 2}
            height={bounds.height + PADDING * 2}
            fill="none"
            stroke="var(--color-primary, #3b82f6)"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            rx={2}
          />
        );
      })}
    </g>
  );
}
