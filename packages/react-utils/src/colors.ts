/**
 * Colors applied when rendering diagram SVG paths and text.
 * Use `currentColor` to inherit from the host theme (e.g. Tailwind `text-foreground`).
 */
export interface DiagramColors {
  /** Stroke color for shapes and arrows. */
  stroke: string;
  /** Fill color for shapes (Rough.js shapes default to no fill). */
  fill: string;
  /** Text fill color. */
  text: string;
  /** Opacity for placeholder text such as "Empty diagram". */
  mutedTextOpacity: number;
}

export type DiagramColorPreset = "inherit" | "light" | "dark" | "darkBlue";

/** Built-in color palettes for common light/dark and themed looks. */
export const DIAGRAM_COLOR_PRESETS: Record<DiagramColorPreset, DiagramColors> = {
  /** Follow the surrounding text color — works with CSS/Tailwind themes. */
  inherit: {
    stroke: "currentColor",
    fill: "none",
    text: "currentColor",
    mutedTextOpacity: 0.55,
  },
  light: {
    stroke: "#1a1a1a",
    fill: "none",
    text: "currentColor",
    mutedTextOpacity: 0.55,
  },
  dark: {
    stroke: "#e5e5e5",
    fill: "none",
    text: "currentColor",
    mutedTextOpacity: 0.55,
  },
  /** Soft blue strokes suited to dark blue-tinted site themes. */
  darkBlue: {
    stroke: "#93c5fd",
    fill: "rgba(59, 130, 246, 0.06)",
    text: "currentColor",
    mutedTextOpacity: 0.6,
  },
};

export const DEFAULT_DIAGRAM_COLORS = DIAGRAM_COLOR_PRESETS.inherit;

export interface ResolveDiagramColorsOptions {
  /** Start from a built-in palette instead of the default. */
  preset?: DiagramColorPreset;
  /** Override individual color values on top of the preset. */
  colors?: Partial<DiagramColors>;
}

/** Merge a preset and optional overrides into a complete color set. */
export function resolveDiagramColors(
  options: ResolveDiagramColorsOptions = {},
): DiagramColors {
  const base = options.preset
    ? DIAGRAM_COLOR_PRESETS[options.preset]
    : DEFAULT_DIAGRAM_COLORS;

  return {
    ...base,
    ...options.colors,
  };
}
