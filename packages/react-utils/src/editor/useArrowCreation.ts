import { useCallback, useState } from "react";
import {
  generateSeed,
  type ArrowElement,
  type DiagramElement,
  type LineElement,
} from "@scribblesvg/core";
import {
  resolveConnectorTarget,
  type ConnectorKind,
  type ConnectorPoint,
} from "./connector-targeting";
import type { ConnectionPointHit } from "./hit-test";
import type { CanvasAction } from "./useCanvasReducer";

export type { ConnectorKind } from "./connector-targeting";
export type ArrowStartState = ConnectorPoint;

export function useArrowCreation(
  elements: DiagramElement[],
  dispatch: React.Dispatch<CanvasAction>,
) {
  const [arrowStart, setArrowStart] = useState<ArrowStartState | null>(null);
  const [preview, setPreview] = useState<
    ReturnType<typeof resolveConnectorTarget> | null
  >(null);

  const handleArrowClick = useCallback(
    (
      kind: ConnectorKind,
      canvasPoint: { x: number; y: number },
      snapThreshold?: number,
      constrain?: boolean,
      explicitHit?: ConnectionPointHit,
    ) => {
      const resolved = resolveConnectorTarget({
        kind,
        point: canvasPoint,
        elements,
        start: arrowStart,
        snapThreshold,
        constrain,
        explicitHit,
      });
      if (!resolved.end) {
        setArrowStart(resolved.start);
        setPreview({ start: resolved.start, end: resolved.start });
        return;
      }
      const base = {
        id: crypto.randomUUID(),
        seed: generateSeed(),
        startX: resolved.start.point.x,
        startY: resolved.start.point.y,
        endX: resolved.end.point.x,
        endY: resolved.end.point.y,
        startBinding: resolved.start.binding,
        endBinding: resolved.end.binding,
      };
      const element: ArrowElement | LineElement =
        kind === "arrow"
          ? { ...base, type: "arrow" }
          : { ...base, type: "line" };
      dispatch({ type: "ADD_ELEMENT", element });
      dispatch({ type: "SET_TOOL", tool: "select" });
      dispatch({ type: "SET_SELECTION", ids: [element.id] });
      setArrowStart(null);
      setPreview(null);
    },
    [arrowStart, elements, dispatch],
  );

  const updatePreview = useCallback(
    (
      kind: ConnectorKind,
      point: { x: number; y: number },
      snapThreshold?: number,
      constrain?: boolean,
    ) => {
      if (!arrowStart) return;
      setPreview(resolveConnectorTarget({
        kind,
        point,
        elements,
        start: arrowStart,
        snapThreshold,
        constrain,
      }));
    },
    [arrowStart, elements],
  );

  const cancelArrow = useCallback(() => {
    setArrowStart(null);
    setPreview(null);
  }, []);

  return {
    arrowStart,
    previewStart: preview?.start.point ?? null,
    previewEnd: preview?.end?.point ?? null,
    handleArrowClick,
    updatePreview,
    cancelArrow,
  };
}
