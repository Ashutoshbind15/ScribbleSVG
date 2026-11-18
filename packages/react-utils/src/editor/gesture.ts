/**
 * The pointer gesture in progress on the canvas, and its pure transitions.
 * `useCanvasInteraction` holds one `Gesture`; pointer-up ends any of them.
 */
import type { Bounds, DiagramElement, Viewport } from "@scribblesvg/core";
import { boundsFromPoints, HANDLE_CURSORS } from "./hit-test";

import type { DragSession } from "./drag";
import type { ResizeSession } from "./resize";
import type { DrawSession } from "./draw";

type Point = { x: number; y: number };

/** Screen-space pointer travel below which a press-release counts as a click. */
export const CLICK_SLOP_PX = 3;

export type CreationType = "rectangle" | "circle" | "cylinder" | "diamond" | "icon";

/**
 * A press on the sole selection: released without moving, the click opens
 * that element's text editor.
 */
export type PendingEdit = { elementId: string; screenStart: Point };

export type Gesture =
  | { type: "none" }
  | { type: "panning"; screenStart: Point; viewportStart: Point }
  | ({ type: "dragging"; pendingEdit: PendingEdit | null } & DragSession)
  | ({ type: "resizing" } & ResizeSession)
  /** Click-drag out the size of a just-added element. */
  | { type: "creating"; elementType: CreationType; elementId: string; startPoint: Point }
  /** A pencil stroke growing from press to release. */
  | ({ type: "drawing" } & DrawSession)
  | {
      type: "marqueeing";
      startPoint: Point;
      currentPoint: Point;
      /** Screen point at press, to tell a click from a drag. */
      screenStart: Point;
      /** Shift held at press: add to the selection on release. */
      additive: boolean;
    }
  /** A marquee or stroke dropped with Escape; waits for pointer-up, then does nothing. */
  | { type: "cancelled" };

export const IDLE: Gesture = { type: "none" };

/** The marquee follows the pointer; other gestures are unchanged. */
export function moveMarquee(gesture: Gesture, point: Point): Gesture {
  return gesture.type === "marqueeing" ? { ...gesture, currentPoint: point } : gesture;
}

/** Escape drops a marquee or a stroke in progress. Other gestures carry on. */
export function cancelOnEscape(gesture: Gesture): Gesture {
  return gesture.type === "marqueeing" || gesture.type === "drawing"
    ? { type: "cancelled" }
    : gesture;
}

export function getMarqueeBounds(gesture: Gesture): Bounds | null {
  return gesture.type === "marqueeing"
    ? boundsFromPoints(gesture.startPoint, gesture.currentPoint)
    : null;
}

/** Viewport while panning with the pointer at `screenPoint`. */
export function panViewport(
  gesture: Extract<Gesture, { type: "panning" }>,
  viewport: Viewport,
  screenPoint: Point,
): Viewport {
  return {
    ...viewport,
    x: gesture.viewportStart.x - (screenPoint.x - gesture.screenStart.x) / viewport.zoom,
    y: gesture.viewportStart.y - (screenPoint.y - gesture.screenStart.y) / viewport.zoom,
  };
}

/** Click-drag out the size of `element`, just added at `point`. */
export function startCreation(
  elementType: CreationType,
  element: DiagramElement,
  point: Point,
): Extract<Gesture, { type: "creating" }> {
  return { type: "creating", elementType, elementId: element.id, startPoint: point };
}

/** Size patch for an element being click-dragged out from its start point. */
export function creationPatch(
  gesture: Extract<Gesture, { type: "creating" }>,
  point: Point,
): Partial<DiagramElement> {
  const start = gesture.startPoint;
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  if (gesture.elementType === "circle") {
    return { cx: start.x, cy: start.y, radius: Math.max(10, Math.hypot(dx, dy)) };
  }
  return {
    x: Math.min(start.x, point.x),
    y: Math.min(start.y, point.y),
    width: Math.max(20, Math.abs(dx)),
    height: Math.max(20, Math.abs(dy)),
  };
}

/** The element whose text editor a drag's release opens, if it was a click. */
export function clickEditTarget(
  gesture: Extract<Gesture, { type: "dragging" }>,
  screenEnd: Point,
): string | null {
  const { pendingEdit } = gesture;
  if (!pendingEdit) return null;
  const travel = Math.hypot(
    screenEnd.x - pendingEdit.screenStart.x,
    screenEnd.y - pendingEdit.screenStart.y,
  );
  return travel < CLICK_SLOP_PX ? pendingEdit.elementId : null;
}

/** Cursor the gesture sets, or null to fall back to the tool's cursor. */
export function gestureCursor(gesture: Gesture): string | null {
  switch (gesture.type) {
    case "panning":
      return "grabbing";
    case "resizing":
      return HANDLE_CURSORS[gesture.handle];
    case "dragging":
      return "move";
    case "marqueeing":
    case "cancelled":
      return "crosshair";
    case "creating":
    case "drawing":
    case "none":
      return null;
  }
}
