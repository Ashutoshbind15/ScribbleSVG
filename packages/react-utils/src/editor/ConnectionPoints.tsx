import { useMemo } from "react";
import {
  getElementConnectionPoints,
  isBindable,
  type DiagramElement,
} from "@scribblesvg/core";
import type { ConnectionPointHit } from "./hit-test";

interface ConnectionPointsProps {
  elements: DiagramElement[];
  /** Radius of each point in canvas-space */
  pointRadius: number;
  hoveredPoint: ConnectionPointHit | null;
  /** Start point after the first click in arrow creation */
  activeStartPoint: { x: number; y: number } | null;
  onPointerDown: (
    e: React.PointerEvent,
    elementId: string,
    point: { x: number; y: number },
  ) => void;
}

function pointsEqual(
  a: { x: number; y: number },
  b: { x: number; y: number },
  epsilon = 0.01,
): boolean {
  return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
}

/**
 * Renders snap points on bindable elements while a connector tool is active.
 */
export function ConnectionPoints({
  elements,
  pointRadius,
  hoveredPoint,
  activeStartPoint,
  onPointerDown,
}: ConnectionPointsProps) {
  const bindableElements = useMemo(
    () => elements.filter(isBindable),
    [elements],
  );

  if (bindableElements.length === 0) return null;

  return (
    <g className="connection-points">
      {bindableElements.flatMap((el) =>
        getElementConnectionPoints(el).map((point, index) => {
          const isHovered =
            hoveredPoint?.elementId === el.id &&
            pointsEqual(hoveredPoint.point, point);
          const isActiveStart =
            activeStartPoint != null && pointsEqual(activeStartPoint, point);
          const isHighlighted = isHovered || isActiveStart;
          const radius = isHighlighted ? pointRadius * 1.4 : pointRadius;

          return (
            <circle
              key={`${el.id}-${index}`}
              cx={point.x}
              cy={point.y}
              r={radius}
              fill={
                isHighlighted
                  ? "var(--color-primary, #3b82f6)"
                  : "var(--color-background, #fff)"
              }
              stroke="var(--color-primary, #3b82f6)"
              strokeWidth={1.5}
              style={{ cursor: "crosshair" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onPointerDown(e, el.id, point);
              }}
            />
          );
        }),
      )}
    </g>
  );
}
