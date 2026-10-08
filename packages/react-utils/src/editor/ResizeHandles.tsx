import { useMemo } from "react";
import {
  getElementBounds,
  isConnector,
  type Bounds,
  type DiagramElement,
} from "@scribblesvg/core";
import { getResizeHandles, HANDLE_CURSORS } from "./hit-test";
import type { HandlePosition } from "./hit-test";

interface ResizeHandlesProps {
  /** Element whose bounding box gets handles; ignored when `bounds` is set */
  element?: DiagramElement;
  /** Explicit box for the handles (e.g. a multi-selection's group box) */
  bounds?: Bounds;
  /** Which handles to show (default: all 8) */
  positions?: readonly HandlePosition[];
  /** Half-size of each handle in canvas-space */
  handleSize: number;
  onHandlePointerDown?: (e: React.PointerEvent, handle: HandlePosition) => void;
}

/**
 * Renders resize handles around a selected element's bounding box, or
 * around an explicit `bounds` box.
 */
export function ResizeHandles({
  element,
  bounds: explicitBounds,
  positions,
  handleSize,
  onHandlePointerDown,
}: ResizeHandlesProps) {
  const bounds = useMemo(
    () => explicitBounds ?? (element ? getElementBounds(element) : null),
    [explicitBounds, element],
  );
  const handles = useMemo(
    () =>
      bounds
        ? getResizeHandles(bounds).filter(
            (h) => !positions || positions.includes(h.position),
          )
        : [],
    [bounds, positions],
  );

  // Connectors aren't resized via box handles
  if (!bounds || (!explicitBounds && element && isConnector(element))) {
    return null;
  }

  return (
    <g className="resize-handles">
      {handles.map((handle) => (
        <rect
          key={handle.position}
          x={handle.x - handleSize}
          y={handle.y - handleSize}
          width={handleSize * 2}
          height={handleSize * 2}
          fill="white"
          stroke="var(--color-primary, #3b82f6)"
          strokeWidth={1.5}
          style={{ cursor: HANDLE_CURSORS[handle.position] }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onHandlePointerDown?.(e, handle.position);
          }}
        />
      ))}
    </g>
  );
}
