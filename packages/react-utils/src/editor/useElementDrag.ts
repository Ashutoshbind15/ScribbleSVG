import { useCallback, useRef } from "react";
import type { DiagramElement } from "@scribblesvg/core";
import type { CanvasAction } from "./useCanvasReducer";
import { translateElement } from "./clipboard";
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
  /** Snapshot of each dragged element at drag start */
  startElements: Map<string, DiagramElement>;
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
      const startElements = new Map<string, DiagramElement>();
      for (const id of elementIds) {
        const el = elements.find((e) => e.id === id);
        if (el) startElements.set(id, el);
      }

      dragRef.current = {
        elementIds,
        startCanvasPoint: canvasPoint,
        startElements,
      };
      dispatch({ type: "BEGIN_HISTORY" });
    },
    [elements, dispatch],
  );

  const continueDrag = useCallback(
    (canvasPoint: { x: number; y: number }) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = canvasPoint.x - drag.startCanvasPoint.x;
      const dy = canvasPoint.y - drag.startCanvasPoint.y;

      const updates: { id: string; patch: Partial<DiagramElement> }[] = [];
      for (const [id, start] of drag.startElements) {
        updates.push({ id, patch: translateElement(start, dx, dy) });
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
    dispatch({ type: "END_HISTORY" });
    return true;
  }, [elements, dispatch]);

  const isDragging = useCallback(() => dragRef.current !== null, []);

  return { startDrag, continueDrag, endDrag, isDragging };
}
