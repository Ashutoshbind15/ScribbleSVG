import {
  getAnchorPoint,
  getElementCenter,
  isBindable,
  isConnector,
  type DiagramElement,
} from "@scribblesvg/core";
/**
 * Compute anchor updates for connectors (arrows/lines) bound to the given elements.
 */
export function getBoundArrowAnchorUpdates(
  affectedIds: Set<string>,
  elements: DiagramElement[],
): { id: string; patch: Partial<DiagramElement> }[] {
  const updates: { id: string; patch: Partial<DiagramElement> }[] = [];

  for (const el of elements) {
    if (!isConnector(el)) continue;

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

    if (startBound && startTarget && isBindable(startTarget)) {
      const otherEnd =
        endTarget && isBindable(endTarget)
          ? getElementCenter(endTarget)
          : { x: el.endX, y: el.endY };
      const anchor = getAnchorPoint(startTarget, otherEnd);
      patch.startX = anchor.x;
      patch.startY = anchor.y;
    }

    if (endBound && endTarget && isBindable(endTarget)) {
      const otherEnd =
        startTarget && isBindable(startTarget)
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
