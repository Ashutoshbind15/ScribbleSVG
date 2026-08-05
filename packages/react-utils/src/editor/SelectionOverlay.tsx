import { useMemo } from "react";
import { getElementBounds, type DiagramElement } from "@scribblesvg/core";
import type { EditingTarget } from "./InlineTextEditor";

interface SelectionOverlayProps {
  elements: DiagramElement[];
  selectedIds: Set<string>;
  /** When set, prefer live editor bounds for the element being edited */
  editingTarget?: EditingTarget | null;
}

const PADDING = 4; // extra padding around the bounding box

/**
 * Renders dashed bounding box overlays for all selected elements.
 * Rendered after all elements so the overlay is always on top.
 */
export function SelectionOverlay({
  elements,
  selectedIds,
  editingTarget = null,
}: SelectionOverlayProps) {
  const selectedElements = useMemo(
    () => elements.filter((el) => selectedIds.has(el.id)),
    [elements, selectedIds],
  );

  if (selectedElements.length === 0) return null;

  return (
    <g className="selection-overlay" pointerEvents="none">
      {selectedElements.map((el) => {
        const bounds =
          editingTarget &&
          editingTarget.elementId === el.id &&
          editingTarget.kind === "standalone-text"
            ? {
                x: editingTarget.x,
                y: editingTarget.y,
                width: editingTarget.width,
                height: editingTarget.height,
              }
            : getElementBounds(el);
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
