import { z } from "zod";
import type { DiagramDocument } from "./types";

// ── Element schemas ──

const RectangleElementSchema = z.object({
  id: z.string(),
  type: z.literal("rectangle"),
  seed: z.number(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  text: z.string().optional(),
  fontSize: z.number().optional(),
});

const CircleElementSchema = z.object({
  id: z.string(),
  type: z.literal("circle"),
  seed: z.number(),
  cx: z.number(),
  cy: z.number(),
  radius: z.number(),
  text: z.string().optional(),
  fontSize: z.number().optional(),
});

const CylinderElementSchema = z.object({
  id: z.string(),
  type: z.literal("cylinder"),
  seed: z.number(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  text: z.string().optional(),
  fontSize: z.number().optional(),
});

const IconElementSchema = z.object({
  id: z.string(),
  type: z.literal("icon"),
  seed: z.number(),
  iconId: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  text: z.string().optional(),
  fontSize: z.number().optional(),
});

const TextElementSchema = z.object({
  id: z.string(),
  type: z.literal("text"),
  seed: z.number(),
  x: z.number(),
  y: z.number(),
  text: z.string(),
  fontSize: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const ArrowElementSchema = z.object({
  id: z.string(),
  type: z.literal("arrow"),
  seed: z.number(),
  startX: z.number(),
  startY: z.number(),
  endX: z.number(),
  endY: z.number(),
  startBinding: z.string().optional(),
  endBinding: z.string().optional(),
});

const DiagramElementSchema = z.discriminatedUnion("type", [
  RectangleElementSchema,
  CircleElementSchema,
  CylinderElementSchema,
  IconElementSchema,
  TextElementSchema,
  ArrowElementSchema,
]);

// ── Viewport schema ──

const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

// ── Document schema ──

const DiagramDocumentSchema = z.object({
  version: z.literal(1),
  viewport: ViewportSchema,
  elements: z.array(DiagramElementSchema),
});

// ── Public API ──

/**
 * Parse and validate an unknown payload as a DiagramDocument.
 * Throws ZodError if the payload is invalid.
 */
export function parseDiagramDocument(data: unknown): DiagramDocument {
  return DiagramDocumentSchema.parse(data) as DiagramDocument;
}

/**
 * Type guard: returns true if the payload is a valid DiagramDocument.
 */
export function isDiagramDocument(data: unknown): data is DiagramDocument {
  return DiagramDocumentSchema.safeParse(data).success;
}
