import { useCallback, useRef } from "react";
import {
  DEFAULT_SHAPE_LABEL_FONT_SIZE,
  getElementBounds,
  scaleFontSizeForResize,
  type Bounds,
  type DiagramElement,
} from "@scribblesvg/core";
import type { HandlePosition } from "./hit-test";
import type { CanvasAction } from "./useCanvasReducer";
import {
  applyElementPatches,
  dispatchBoundArrowAnchorUpdates,
  getBoundArrowAnchorUpdates,
} from "./arrowAnchors";

/** Minimum size constraint for shapes */
const MIN_SIZE = 20;

interface ResizeState {
  elementId: string;
  handle: HandlePosition;
  startCanvasPoint: { x: number; y: number };
  startBounds: Bounds;
  /** Original element snapshot for computing the patch */
  originalElement: DiagramElement;
}

/**
 * Hook for resizing a single selected element via drag handles.
 */
export function useElementResize(
  elements: DiagramElement[],
  dispatch: React.Dispatch<CanvasAction>,
) {
  const resizeRef = useRef<ResizeState | null>(null);

  const startResize = useCallback(
    (
      elementId: string,
      handle: HandlePosition,
      canvasPoint: { x: number; y: number },
    ) => {
      const el = elements.find((e) => e.id === elementId);
      if (!el) return;

      resizeRef.current = {
        elementId,
        handle,
        startCanvasPoint: canvasPoint,
        startBounds: getElementBounds(el),
        originalElement: el,
      };
    },
    [elements],
  );

  const continueResize = useCallback(
    (canvasPoint: { x: number; y: number }) => {
      const resize = resizeRef.current;
      if (!resize) return;

      const dx = canvasPoint.x - resize.startCanvasPoint.x;
      const dy = canvasPoint.y - resize.startCanvasPoint.y;
      const newBounds = computeResizedBounds(
        resize.startBounds,
        resize.handle,
        dx,
        dy,
      );

      const patch = boundsToElementPatch(
        resize.originalElement,
        newBounds,
        resize.startBounds,
      );
      if (patch) {
        const elementUpdates = [{ id: resize.elementId, patch }];
        const projectedElements = applyElementPatches(elements, elementUpdates);
        const arrowUpdates = getBoundArrowAnchorUpdates(
          new Set([resize.elementId]),
          projectedElements,
        );
        dispatch({
          type: "UPDATE_ELEMENTS",
          updates: [...elementUpdates, ...arrowUpdates],
        });
      }
    },
    [elements, dispatch],
  );

  const endResize = useCallback(() => {
    if (!resizeRef.current) return false;

    // Recalculate bound arrow anchors after resize
    const resizedId = resizeRef.current.elementId;
    dispatchBoundArrowAnchorUpdates(new Set([resizedId]), elements, dispatch);

    resizeRef.current = null;
    return true;
  }, [elements, dispatch]);

  const isResizing = useCallback(() => resizeRef.current !== null, []);

  return { startResize, continueResize, endResize, isResizing };
}

/**
 * Compute new bounds after dragging a resize handle by (dx, dy).
 */
function computeResizedBounds(
  startBounds: Bounds,
  handle: HandlePosition,
  dx: number,
  dy: number,
): Bounds {
  let { x, y, width, height } = startBounds;

  // Adjust based on which handle is being dragged
  if (handle.includes("w")) {
    const newX = x + dx;
    const newWidth = width - dx;
    if (newWidth >= MIN_SIZE) {
      x = newX;
      width = newWidth;
    } else {
      x = x + width - MIN_SIZE;
      width = MIN_SIZE;
    }
  }
  if (handle.includes("e")) {
    const newWidth = width + dx;
    width = Math.max(MIN_SIZE, newWidth);
  }
  if (handle.includes("n")) {
    const newY = y + dy;
    const newHeight = height - dy;
    if (newHeight >= MIN_SIZE) {
      y = newY;
      height = newHeight;
    } else {
      y = y + height - MIN_SIZE;
      height = MIN_SIZE;
    }
  }
  if (handle.includes("s")) {
    const newHeight = height + dy;
    height = Math.max(MIN_SIZE, newHeight);
  }

  return { x, y, width, height };
}

/**
 * Convert new bounds back into element-specific patch properties.
 */
function boundsToElementPatch(
  original: DiagramElement,
  bounds: Bounds,
  resizeStartBounds: Bounds,
): Partial<DiagramElement> | null {
  switch (original.type) {
    case "rectangle":
    case "cylinder":
    case "icon": {
      const patch: Partial<DiagramElement> = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
      if (original.text) {
        patch.fontSize = scaleFontSizeForResize(
          original.fontSize ?? DEFAULT_SHAPE_LABEL_FONT_SIZE,
          bounds,
          resizeStartBounds,
        );
      }
      return patch;
    }

    case "circle": {
      // Circle radius is min(width, height) / 2 to keep it circular
      const radius = Math.max(
        MIN_SIZE / 2,
        Math.min(bounds.width, bounds.height) / 2,
      );
      const patch: Partial<DiagramElement> = {
        cx: bounds.x + bounds.width / 2,
        cy: bounds.y + bounds.height / 2,
        radius,
      };
      if (original.text) {
        patch.fontSize = scaleFontSizeForResize(
          original.fontSize ?? DEFAULT_SHAPE_LABEL_FONT_SIZE,
          bounds,
          resizeStartBounds,
        );
      }
      return patch;
    }

    case "text": {
      const baseFontSize = original.fontSize ?? 16;
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        fontSize: scaleFontSizeForResize(
          baseFontSize,
          bounds,
          resizeStartBounds,
        ),
      };
    }

    case "arrow":
      // Arrows aren't resized via handles
      return null;
  }
}
