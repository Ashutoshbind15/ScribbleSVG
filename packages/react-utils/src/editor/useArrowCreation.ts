import { useCallback, useState } from "react";
import {
  generateSeed,
  getAnchorPoint,
  getElementCenter,
  isBindable,
  type ArrowElement,
  type DiagramElement,
  type LineElement,
} from "@scribblesvg/core";
import { hitTest, hitTestConnectionPoint } from "./hit-test";
import type { CanvasAction } from "./useCanvasReducer";

export type ConnectorKind = "arrow" | "line";

export interface ArrowStartState {
  /** Canvas-space position of the first click */
  point: { x: number; y: number };
  /** Element ID if the click landed on a shape, undefined if free-floating */
  binding?: string;
}

/**
 * Hook for two-click arrow/line creation.
 *
 * Connector tool flow:
 * 1. First click sets start point (optionally bound to an element)
 * 2. Mouse move shows a preview line from start to cursor
 * 3. Second click sets end point (optionally bound to an element)
 * 4. Connector element is created and tool switches to select
 */
export function useArrowCreation(
  elements: DiagramElement[],
  dispatch: React.Dispatch<CanvasAction>,
) {
  const [arrowStart, setArrowStart] = useState<ArrowStartState | null>(null);
  const [previewEnd, setPreviewEnd] = useState<{ x: number; y: number } | null>(
    null,
  );

  const createConnector = useCallback(
    (
      kind: ConnectorKind,
      startPoint: { x: number; y: number },
      endPoint: { x: number; y: number },
      startBinding?: string,
      endBinding?: string,
    ) => {
      const base = {
        id: crypto.randomUUID(),
        seed: generateSeed(),
        startX: startPoint.x,
        startY: startPoint.y,
        endX: endPoint.x,
        endY: endPoint.y,
        startBinding,
        endBinding,
      };

      const element: ArrowElement | LineElement =
        kind === "arrow"
          ? { ...base, type: "arrow" }
          : { ...base, type: "line" };

      dispatch({ type: "ADD_ELEMENT", element });
      dispatch({ type: "SET_TOOL", tool: "select" });
      dispatch({ type: "SET_SELECTION", ids: [element.id] });

      setArrowStart(null);
      setPreviewEnd(null);
    },
    [dispatch],
  );

  const resolveStartPoint = useCallback(
    (
      startState: ArrowStartState,
      endRef: { x: number; y: number },
      endBinding?: string,
    ) => {
      if (!startState.binding) return startState.point;

      const startTarget = elements.find((e) => e.id === startState.binding);
      if (!startTarget || !isBindable(startTarget)) return startState.point;

      const endTarget = endBinding
        ? elements.find((e) => e.id === endBinding)
        : null;
      const anchorFrom =
        endTarget && isBindable(endTarget)
          ? getElementCenter(endTarget)
          : endRef;

      return getAnchorPoint(startTarget, anchorFrom);
    },
    [elements],
  );

  const handleArrowPointClick = useCallback(
    (
      kind: ConnectorKind,
      point: { x: number; y: number },
      binding?: string,
    ) => {
      if (!arrowStart) {
        setArrowStart({ point, binding });
        setPreviewEnd(point);
        return;
      }

      createConnector(
        kind,
        arrowStart.point,
        point,
        arrowStart.binding,
        binding,
      );
    },
    [arrowStart, createConnector],
  );

  const handleArrowClick = useCallback(
    (
      kind: ConnectorKind,
      canvasPoint: { x: number; y: number },
      snapThreshold?: number,
    ) => {
      if (snapThreshold != null) {
        const connHit = hitTestConnectionPoint(
          canvasPoint,
          elements,
          snapThreshold,
        );
        if (connHit) {
          handleArrowPointClick(kind, connHit.point, connHit.elementId);
          return;
        }
      }

      const hitElement = hitTest(canvasPoint, elements);
      const bindableHit =
        hitElement && isBindable(hitElement) ? hitElement : null;

      if (!arrowStart) {
        const startPoint = bindableHit
          ? getAnchorPoint(bindableHit, canvasPoint)
          : canvasPoint;

        handleArrowPointClick(kind, startPoint, bindableHit?.id);
      } else {
        const endPoint = bindableHit
          ? getAnchorPoint(bindableHit, arrowStart.point)
          : canvasPoint;
        const startPoint = resolveStartPoint(
          arrowStart,
          endPoint,
          bindableHit?.id,
        );

        createConnector(
          kind,
          startPoint,
          endPoint,
          arrowStart.binding,
          bindableHit?.id,
        );
      }
    },
    [arrowStart, elements, handleArrowPointClick, resolveStartPoint, createConnector],
  );

  const updatePreview = useCallback(
    (canvasPoint: { x: number; y: number }, snapThreshold?: number) => {
      if (!arrowStart) return;

      if (snapThreshold != null) {
        const connHit = hitTestConnectionPoint(
          canvasPoint,
          elements,
          snapThreshold,
        );
        if (connHit) {
          setPreviewEnd(connHit.point);
          return;
        }
      }

      const hitElement = hitTest(canvasPoint, elements);
      const bindableHit =
        hitElement && isBindable(hitElement) ? hitElement : null;

      if (bindableHit) {
        setPreviewEnd(getAnchorPoint(bindableHit, arrowStart.point));
      } else {
        setPreviewEnd(canvasPoint);
      }
    },
    [arrowStart, elements],
  );

  const cancelArrow = useCallback(() => {
    setArrowStart(null);
    setPreviewEnd(null);
  }, []);

  return {
    arrowStart,
    previewEnd,
    handleArrowClick,
    handleArrowPointClick,
    updatePreview,
    cancelArrow,
  };
}
