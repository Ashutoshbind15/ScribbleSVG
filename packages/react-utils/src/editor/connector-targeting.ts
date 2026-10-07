import {
  constrainToStraightAngle,
  getAnchorPoint,
  getElementCenter,
  isBindable,
  type DiagramElement,
} from "@scribblesvg/core";
import { hitTest, hitTestConnectionPoint, type ConnectionPointHit } from "./hit-test";

export type ConnectorKind = "arrow" | "line";

export interface ConnectorPoint {
  point: { x: number; y: number };
  binding?: string;
  automatic?: boolean;
}

export function resolveConnectorTarget(args: {
  kind: ConnectorKind;
  point: { x: number; y: number };
  elements: DiagramElement[];
  start?: ConnectorPoint | null;
  snapThreshold?: number;
  constrain?: boolean;
  explicitHit?: ConnectionPointHit;
}): { start: ConnectorPoint; end: ConnectorPoint | null } {
  const { kind, point, elements, start, snapThreshold, constrain, explicitHit } = args;
  const constrainedLine = kind === "line" && constrain;
  let target: ConnectorPoint = { point };
  if (!constrainedLine) {
    const connection = explicitHit ?? (snapThreshold == null
      ? null : hitTestConnectionPoint(point, elements, snapThreshold));
    if (connection) {
      target = { point: connection.point, binding: connection.elementId };
    } else if (kind === "arrow") {
      const hit = hitTest(point, elements);
      if (hit && isBindable(hit)) {
        target = { point: getAnchorPoint(hit, start?.point ?? point), binding: hit.id, automatic: true };
      }
    }
  }
  if (!start) return { start: target, end: null };

  if (target.binding && target.binding === start.binding && (target.automatic || start.automatic)) {
    target = { point: target.automatic ? point : target.point };
  }
  if (constrain && (constrainedLine || !target.binding)) {
    target = { point: constrainToStraightAngle(start.point, target.point) };
  }
  let resolvedStart = constrainedLine ? { point: start.point } : start;
  if (resolvedStart.automatic && resolvedStart.binding) {
    const shape = elements.find((element) => element.id === resolvedStart.binding);
    const endShape = elements.find((element) => element.id === target.binding);
    if (shape && isBindable(shape)) {
      resolvedStart = {
        ...resolvedStart,
        point: getAnchorPoint(shape, endShape ? getElementCenter(endShape) : target.point),
      };
    }
  }
  return { start: resolvedStart, end: target };
}
