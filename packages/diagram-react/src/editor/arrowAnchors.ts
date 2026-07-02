import type { Dispatch } from "react";
import {
  getAnchorPoint,
  getElementCenter,
  type DiagramElement,
} from "@scribblesvg/core";
import type { CanvasAction } from "./useCanvasReducer";

export function applyElementPatches(
  elements: DiagramElement[],
  updates: { id: string; patch: Partial<DiagramElement> }[],
): DiagramElement[] {
  const patchMap = new Map(updates.map((u) => [u.id, u.patch]));
  return elements.map((el) => {
    const patch = patchMap.get(el.id);
    return patch ? ({ ...el, ...patch } as DiagramElement) : el;
  });
}

/**
 * Compute anchor updates for arrows bound to the given elements.
 */
export function getBoundArrowAnchorUpdates(
  affectedIds: Set<string>,
  elements: DiagramElement[],
): { id: string; patch: Partial<DiagramElement> }[] {
  const updates: { id: string; patch: Partial<DiagramElement> }[] = [];

  for (const el of elements) {
    if (el.type !== "arrow") continue;

    const startBound = el.startBinding && affectedIds.has(el.startBinding);
    const endBound = el.endBinding && affectedIds.has(el.endBinding);

    if (!startBound && !endBound) continue;

    const patch: Record<string, number> = {};
    const startTarget = el.startBinding
      ? elements.find((e) => e.id === el.startBinding)
      : null;
    const endTarget = el.endBinding
      ? elements.find((e) => e.id === el.endBinding)
      : null;

    if (startBound && startTarget && startTarget.type !== "arrow") {
      const otherEnd = endTarget
        ? getElementCenter(endTarget)
        : { x: el.endX, y: el.endY };
      const anchor = getAnchorPoint(startTarget, otherEnd);
      patch.startX = anchor.x;
      patch.startY = anchor.y;
    }

    if (endBound && endTarget && endTarget.type !== "arrow") {
      const otherEnd = startTarget
        ? getElementCenter(startTarget)
        : { x: el.startX, y: el.startY };
      const anchor = getAnchorPoint(endTarget, otherEnd);
      patch.endX = anchor.x;
      patch.endY = anchor.y;
    }

    if (Object.keys(patch).length > 0) {
      updates.push({ id: el.id, patch });
    }
  }

  return updates;
}

export function dispatchBoundArrowAnchorUpdates(
  affectedIds: Set<string>,
  elements: DiagramElement[],
  dispatch: Dispatch<CanvasAction>,
) {
  const updates = getBoundArrowAnchorUpdates(affectedIds, elements);
  if (updates.length > 0) {
    dispatch({ type: "UPDATE_ELEMENTS", updates });
  }
}
