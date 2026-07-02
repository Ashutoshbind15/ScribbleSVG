import {
  EMPTY_DOCUMENT,
  parseDiagramDocument,
  type DiagramDocument,
} from "@scribblesvg/core";

/**
 * Safely parse a DB payload into a DiagramDocument.
 * Handles valid docs, empty `{}`, and corrupt/legacy data.
 *
 * - Valid DiagramDocument → returned as-is
 * - Empty `{}` → returns EMPTY_DOCUMENT
 * - Invalid/corrupt → throws (caller should catch and handle)
 */
export function parsePayload(payload: unknown): DiagramDocument {
  // Empty object → empty document
  if (
    payload != null &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    Object.keys(payload as Record<string, unknown>).length === 0
  ) {
    return EMPTY_DOCUMENT;
  }

  // Attempt full parse
  return parseDiagramDocument(payload);
}

/**
 * Create a JSON snapshot of diagram state for dirty comparison.
 */
export function diagramSnapshot(
  title: string,
  document: DiagramDocument,
): string {
  return JSON.stringify({ title, document });
}