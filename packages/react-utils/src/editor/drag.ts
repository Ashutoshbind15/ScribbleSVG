import type { DiagramElement } from "@scribblesvg/core";

type Point = { x: number; y: number };

export interface DragSession {
  startCanvasPoint: Point;
  originalElements: DiagramElement[];
}

export function startDrag(elements: DiagramElement[], ids: string[], point: Point): DragSession {
  const selected = new Set(ids);
  return { startCanvasPoint: point, originalElements: elements.filter((el) => selected.has(el.id)) };
}

export function dragPatches(drag: DragSession, point: Point) {
  const dx = point.x - drag.startCanvasPoint.x;
  const dy = point.y - drag.startCanvasPoint.y;
  return drag.originalElements.map((el) => {
    let patch: Partial<DiagramElement>;
    switch (el.type) {
      case "circle":
        patch = { cx: el.cx + dx, cy: el.cy + dy };
        break;
      case "arrow":
      case "line":
        patch = {
          startX: el.startX + dx, startY: el.startY + dy,
          endX: el.endX + dx, endY: el.endY + dy,
        };
        break;
      case "freedraw":
        patch = { points: el.points.map(([x, y]) => [x + dx, y + dy]) };
        break;
      default:
        patch = { x: el.x + dx, y: el.y + dy };
    }
    return { id: el.id, patch };
  });
}
