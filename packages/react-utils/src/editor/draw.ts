import type { DiagramElement, FreedrawElement } from "@scribblesvg/core";
import { createStroke, type Stroke } from "./stroke-smoothing";

type Point = { x: number; y: number };

export interface DrawSession {
  elementId: string;
  stroke: Stroke;
}

/** Grows `element` from its first point. Smoothing distances are screen pixels at `zoom`. */
export function startDraw(element: FreedrawElement, zoom: number, smoothing: boolean): DrawSession {
  const [x, y] = element.points[0]!;
  return { elementId: element.id, stroke: createStroke([x, y], 1 / zoom, smoothing) };
}

/**
 * Adds `samples` to the session's stroke and returns the points to store.
 * The stroke keeps state between calls, so pass each sample once.
 */
export function drawPatch(session: DrawSession, samples: Point[]): Partial<DiagramElement> {
  for (const { x, y } of samples) session.stroke.add([x, y]);
  return { points: session.stroke.points() };
}
