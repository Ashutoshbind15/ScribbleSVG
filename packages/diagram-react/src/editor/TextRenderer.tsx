/**
 * SVG text rendering component for standalone text elements and shape labels.
 * Supports multi-line text by splitting on newlines and rendering with <tspan> elements.
 */

interface StandaloneTextProps {
  /** Render mode for standalone text elements */
  mode: "standalone";
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

interface ShapeLabelProps {
  /** Render mode for text inside shapes (centered) */
  mode: "shape-label";
  /** Center X of the shape */
  cx: number;
  /** Center Y of the shape */
  cy: number;
  text: string;
  fontSize: number;
}

type TextRendererProps = StandaloneTextProps | ShapeLabelProps;

/** Line height multiplier relative to fontSize */
const LINE_HEIGHT = 1.2;

/**
 * Renders multi-line text as SVG `<text>` with `<tspan>` elements.
 * - Standalone text: positioned at (x, y), left-aligned
 * - Shape labels: centered within the shape bounds
 */
export function TextRenderer(props: TextRendererProps) {
  const lines = props.text.split("\n");
  const { fontSize } = props;
  const lineHeight = fontSize * LINE_HEIGHT;

  if (props.mode === "standalone") {
    // Standalone text: left-aligned at (x, y)
    // First line baseline is at y + fontSize (to account for descender)
    const baselineY = props.y + fontSize;
    return (
      <text
        x={props.x}
        y={baselineY}
        fontSize={fontSize}
        fontFamily="'Segoe UI', system-ui, sans-serif"
        fill="currentColor"
        pointerEvents="none"
      >
        {lines.map((line, i) => (
          <tspan key={i} x={props.x} dy={i === 0 ? 0 : lineHeight}>
            {line || "\u00A0"}
          </tspan>
        ))}
      </text>
    );
  }

  // Shape label: centered at (cx, cy)
  // Offset the first line so the block is vertically centered
  const totalHeight = lineHeight * lines.length;
  const startDy = -(totalHeight / 2) + lineHeight / 2;

  return (
    <text
      x={props.cx}
      y={props.cy}
      fontSize={fontSize}
      fontFamily="'Segoe UI', system-ui, sans-serif"
      fill="currentColor"
      textAnchor="middle"
      dominantBaseline="central"
      pointerEvents="none"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={props.cx} dy={i === 0 ? startDy : lineHeight}>
          {line || "\u00A0"}
        </tspan>
      ))}
    </text>
  );
}
