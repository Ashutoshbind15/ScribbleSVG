/**
 * Subtle dot grid pattern rendered as an SVG `<defs>` + `<rect>`.
 * The pattern tiles in canvas-space, so it moves naturally with pan/zoom.
 */
export function GridBackground() {
  const dotSpacing = 20; // px in canvas-space between dots
  const dotRadius = 1;

  return (
    <>
      <defs>
        <pattern
          id="grid-dot-pattern"
          x={0}
          y={0}
          width={dotSpacing}
          height={dotSpacing}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={dotSpacing / 2}
            cy={dotSpacing / 2}
            r={dotRadius}
            fill="currentColor"
            opacity={0.3}
          />
        </pattern>
      </defs>
      {/* Large rect that covers a huge area so grid is always visible */}
      <rect
        x={-1e5}
        y={-1e5}
        width={2e5}
        height={2e5}
        fill="url(#grid-dot-pattern)"
      />
    </>
  );
}
