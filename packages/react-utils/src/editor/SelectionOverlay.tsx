import { useMemo } from "react";
import { getElementBounds, type Bounds, type DiagramElement } from "@scribblesvg/core";
import type { EditingTarget } from "./InlineTextEditor";
import { getSelectionOutlines } from "./groups";
import { getElementsBounds, getGroupSelectionBounds } from "./hit-test";

interface SelectionOverlayProps {
  elements: DiagramElement[];
  selectedIds: Set<string>;
  /** When set, prefer live editor bounds for the element being edited */
  editingTarget?: EditingTarget | null;
}

const PADDING = 4; // extra padding around the bounding box
const STROKE = "var(--color-primary, #3b82f6)";

function pad(bounds: Bounds, by: number): Bounds {
  return {
    x: bounds.x - by,
    y: bounds.y - by,
    width: bounds.width + by * 2,
    height: bounds.height + by * 2,
  };
}

function DashedBox({ bounds }: { bounds: Bounds }) {
  return (
    <rect
      {...pad(bounds, PADDING)}
      fill="none"
      stroke={STROKE}
      strokeWidth={1.5}
      strokeDasharray="6 3"
      rx={2}
    />
  );
}

/**
 * Draws a solid box around a multi-selection's draggable area, with a dashed
 * box for each selected element or fully selected group. A single fully
 * selected group uses the solid box alone.
 * Rendered after all elements so the overlay is always on top.
 */
export function SelectionOverlay({
  elements,
  selectedIds,
  editingTarget = null,
}: SelectionOverlayProps) {
  const outlines = useMemo(
    () => getSelectionOutlines(elements, selectedIds),
    [elements, selectedIds],
  );

  const groupBounds = useMemo(
    () => getGroupSelectionBounds(elements, selectedIds),
    [elements, selectedIds],
  );

  if (selectedIds.size === 0) return null;

  return (
    <g className="selection-overlay" pointerEvents="none">
      {groupBounds && (
        <rect
          {...groupBounds}
          fill={STROKE}
          fillOpacity={0.04}
          stroke={STROKE}
          strokeWidth={1}
          rx={2}
        />
      )}
      {outlines.groups.map((members) => (
        <DashedBox key={members[0]!.id} bounds={getElementsBounds(members)!} />
      ))}
      {outlines.elements.map((el) => {
        // Typing into a shape: the shape itself is context enough
        if (
          editingTarget?.elementId === el.id &&
          editingTarget.kind === "shape-label"
        ) {
          return null;
        }
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
        return <DashedBox key={el.id} bounds={bounds} />;
      })}
    </g>
  );
}
