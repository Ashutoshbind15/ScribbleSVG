import { useCallback, useRef } from "react";
import type { DiagramElement } from "@scribblesvg/core";
import type { CanvasAction } from "./useCanvasReducer";
import {
  applyElementPatches,
  dispatchBoundArrowAnchorUpdates,
  getBoundArrowAnchorUpdates,
} from "./arrowAnchors";

interface DragState {
  /** IDs of elements being dragged */
  elementIds: string[];
  /** Canvas-space position where drag started */
  startCanvasPoint: { x: number; y: number };
  /** Snapshot of element positions at drag start (id → {x, y} or equivalent) */
  startPositions: Map<string, Record<string, number>>;
}

/**
 * Hook for dragging selected elements to reposition them.
 * Returns callbacks to start, continue, and end a drag operation.
 */
export function useElementDrag(
  elements: DiagramElement[],
  dispatch: React.Dispatch<CanvasAction>,
) {
  const dragRef = useRef<DragState | null>(null);

  const startDrag = useCallback(
    (elementIds: string[], canvasPoint: { x: number; y: number }) => {
      const startPositions = new Map<string, Record<string, number>>();

      for (const id of elementIds) {
        const el = elements.find((e) => e.id === id);
        if (!el) continue;

        switch (el.type) {
          case "rectangle":
          case "cylinder":
          case "icon":
          case "text":
            startPositions.set(id, { x: el.x, y: el.y });
            break;
          case "circle":
            startPositions.set(id, { cx: el.cx, cy: el.cy });
            break;
          case "arrow":
            startPositions.set(id, {
              startX: el.startX,
              startY: el.startY,
              endX: el.endX,
              endY: el.endY,
            });
            break;
        }
      }

      dragRef.current = {
        elementIds,
        startCanvasPoint: canvasPoint,
        startPositions,
      };
    },
    [elements],
  );

  const continueDrag = useCallback(
    (canvasPoint: { x: number; y: number }) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = canvasPoint.x - drag.startCanvasPoint.x;
      const dy = canvasPoint.y - drag.startCanvasPoint.y;

      const updates: { id: string; patch: Partial<DiagramElement> }[] = [];

      for (const id of drag.elementIds) {
        const startPos = drag.startPositions.get(id);
        if (!startPos) continue;

        const el = elements.find((e) => e.id === id);
        if (!el) continue;

        switch (el.type) {
          case "rectangle":
          case "cylinder":
          case "icon":
          case "text":
            updates.push({
              id,
              patch: { x: startPos.x + dx, y: startPos.y + dy },
            });
            break;
          case "circle":
            updates.push({
              id,
              patch: { cx: startPos.cx + dx, cy: startPos.cy + dy },
            });
            break;
          case "arrow":
            updates.push({
              id,
              patch: {
                startX: startPos.startX + dx,
                startY: startPos.startY + dy,
                endX: startPos.endX + dx,
                endY: startPos.endY + dy,
              },
            });
            break;
        }
      }

      if (updates.length > 0) {
        const movedIds = new Set(drag.elementIds);
        const projectedElements = applyElementPatches(elements, updates);
        const arrowUpdates = getBoundArrowAnchorUpdates(
          movedIds,
          projectedElements,
        );
        dispatch({
          type: "UPDATE_ELEMENTS",
          updates: [...updates, ...arrowUpdates],
        });
      }
    },
    [elements, dispatch],
  );

  const endDrag = useCallback(() => {
    if (!dragRef.current) return false;

    // After drag, recalculate arrow anchor points for bound arrows
    const draggedIds = new Set(dragRef.current.elementIds);
    dispatchBoundArrowAnchorUpdates(draggedIds, elements, dispatch);

    dragRef.current = null;
    return true;
  }, [elements, dispatch]);

  const isDragging = useCallback(() => dragRef.current !== null, []);

  return { startDrag, continueDrag, endDrag, isDragging };
}
