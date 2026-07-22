import { useMemo } from "react";
import {
  getElementBounds,
  isConnector,
  type DiagramElement,
} from "@scribblesvg/core";
import { getResizeHandles } from "./hit-test";
import type { HandlePosition } from "./hit-test";

interface ResizeHandlesProps {
  element: DiagramElement;
  /** Half-size of each handle in canvas-space */
  handleSize: number;
  onHandlePointerDown?: (e: React.PointerEvent, handle: HandlePosition) => void;
}

const HANDLE_CURSORS: Record<HandlePosition, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

/**
 * Renders 8 resize handles around a selected element's bounding box.
 */
export function ResizeHandles({
  element,
  handleSize,
  onHandlePointerDown,
}: ResizeHandlesProps) {
  const bounds = useMemo(() => getElementBounds(element), [element]);
  const handles = useMemo(() => getResizeHandles(bounds), [bounds]);

  // Connectors aren't resized via box handles
  if (isConnector(element)) return null;

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
