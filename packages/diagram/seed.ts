import rough from "roughjs";

/**
 * Generate a random seed for deterministic Rough.js rendering.
 * Uses Rough.js's built-in seed generator for consistency.
 */
export function generateSeed(): number {
  return rough.newSeed();
}
