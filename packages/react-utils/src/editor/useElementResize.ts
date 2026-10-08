import { useCallback, useRef } from "react";
import {
  DEFAULT_SHAPE_LABEL_FONT_SIZE,
  DEFAULT_TEXT_FONT_SIZE,
  getElementBounds,
  scaleFontSizeForResize,
  type Bounds,
  type DiagramElement,
} from "@scribblesvg/core";
import { getElementsBounds, type HandlePosition } from "./hit-test";
import type { CanvasAction } from "./useCanvasReducer";
import {
  applyElementPatches,
  dispatchBoundArrowAnchorUpdates,
  getBoundArrowAnchorUpdates,
} from "./arrowAnchors";
import { measureDomTextSize } from "./measureDomText";
import {
  computeGroupScale,
  getGroupScalePatches,
  getMinGroupScale,
  getScaleAnchor,
} from "./group-scale";

/** Minimum size constraint for shapes */
const MIN_SIZE = 20;

interface ResizeState {
  kind: "single";
  elementId: string;
  handle: HandlePosition;
  startCanvasPoint: { x: number; y: number };
  startBounds: Bounds;
  /** Original element snapshot for computing the patch */
  originalElement: DiagramElement;
}

/** Uniform scale of a multi-selection from one of its corners. */
interface GroupScaleState {
  kind: "group";
  ids: Set<string>;
  handle: HandlePosition;
  startCanvasPoint: { x: number; y: number };
  startBounds: Bounds;
  anchor: { x: number; y: number };
  minScale: number;
  /** Original snapshots of the selected elements */
  originalElements: DiagramElement[];
}

/**
 * Hook for resizing a single selected element via drag handles, or scaling
 * a multi-selection from its group box corners.
 */
export function useElementResize(
  elements: DiagramElement[],
  dispatch: React.Dispatch<CanvasAction>,
) {
  const resizeRef = useRef<ResizeState | GroupScaleState | null>(null);

  const startResize = useCallback(
    (
      elementId: string,
      handle: HandlePosition,
      canvasPoint: { x: number; y: number },
    ) => {
      const el = elements.find((e) => e.id === elementId);
      if (!el) return;

      resizeRef.current = {
        kind: "single",
        elementId,
        handle,
        startCanvasPoint: canvasPoint,
        startBounds: getElementBounds(el),
        originalElement: el,
      };
      dispatch({ type: "BEGIN_HISTORY" });
    },
    [elements, dispatch],
  );

  const startGroupScale = useCallback(
    (
      ids: ReadonlySet<string>,
      handle: HandlePosition,
      canvasPoint: { x: number; y: number },
    ) => {
      const originalElements = elements.filter((el) => ids.has(el.id));
      const startBounds = getElementsBounds(originalElements);
      if (!startBounds) return false;

      resizeRef.current = {
        kind: "group",
        ids: new Set(ids),
        handle,
        startCanvasPoint: canvasPoint,
        startBounds,
        anchor: getScaleAnchor(startBounds, handle),
        minScale: getMinGroupScale(originalElements),
        originalElements,
      };
      dispatch({ type: "BEGIN_HISTORY" });
      return true;
    },
    [elements, dispatch],
  );

  const continueResize = useCallback(
    (canvasPoint: { x: number; y: number }) => {
      const resize = resizeRef.current;
      if (!resize) return;

      if (resize.kind === "group") {
        const scale = computeGroupScale(
          resize.startBounds,
          resize.handle,
          canvasPoint.x - resize.startCanvasPoint.x,
          canvasPoint.y - resize.startCanvasPoint.y,
          resize.minScale,
        );
        const elementUpdates = getGroupScalePatches(
          resize.originalElements,
          resize.anchor,
          scale,
        );
        // Re-anchor bound connector ends onto the scaled shapes, folding
        // those fixes into any selected connector's own scale patch.
        const projectedElements = applyElementPatches(elements, elementUpdates);
        const updates = new Map(elementUpdates.map((u) => [u.id, u.patch]));
        for (const { id, patch } of getBoundArrowAnchorUpdates(
          resize.ids,
          projectedElements,
        )) {
          updates.set(id, { ...updates.get(id), ...patch });
        }
        dispatch({
          type: "UPDATE_ELEMENTS",
          updates: Array.from(updates, ([id, patch]) => ({ id, patch })),
        });
        return;
      }

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
        resize.handle,
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
    const resize = resizeRef.current;
    const resizedIds =
      resize.kind === "group" ? resize.ids : new Set([resize.elementId]);
    dispatchBoundArrowAnchorUpdates(resizedIds, elements, dispatch);

    resizeRef.current = null;
    dispatch({ type: "END_HISTORY" });
    return true;
  }, [elements, dispatch]);

  const isResizing = useCallback(() => resizeRef.current !== null, []);

  return {
    startResize,
    startGroupScale,
    continueResize,
    endResize,
    isResizing,
  };
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
  handle: HandlePosition,
): Partial<DiagramElement> | null {
  switch (original.type) {
    case "rectangle":
    case "cylinder":
    case "diamond":
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
      // Scale font from the gesture, then hug the resulting glyphs and
      // pin the opposite corner/edge so the box doesn't float off the text.
      const baseFontSize = original.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
      const fontSize = scaleFontSizeForResize(
        baseFontSize,
        bounds,
        resizeStartBounds,
      );
      const size = measureDomTextSize(original.text, fontSize);
      const { x, y } = anchorTextTopLeft(resizeStartBounds, size, handle);
      return {
        x,
        y,
        width: size.width,
        height: size.height,
        fontSize,
      };
    }

    case "arrow":
    case "line":
      // Connectors aren't resized via handles
      return null;
  }
}

/**
 * Place content-sized text so the edge/corner opposite the active handle
 * stays fixed through the resize.
 */
function anchorTextTopLeft(
  startBounds: Bounds,
  content: { width: number; height: number },
  handle: HandlePosition,
): { x: number; y: number } {
  const startRight = startBounds.x + startBounds.width;
  const startBottom = startBounds.y + startBounds.height;
  const startCx = startBounds.x + startBounds.width / 2;
  const startCy = startBounds.y + startBounds.height / 2;

  let x: number;
  if (handle.includes("w") && !handle.includes("e")) {
    x = startRight - content.width;
  } else if (handle.includes("e") && !handle.includes("w")) {
    x = startBounds.x;
  } else {
    x = startCx - content.width / 2;
  }

  let y: number;
  if (handle.includes("n") && !handle.includes("s")) {
    y = startBottom - content.height;
  } else if (handle.includes("s") && !handle.includes("n")) {
    y = startBounds.y;
  } else {
    y = startCy - content.height / 2;
  }

  return { x, y };
}
