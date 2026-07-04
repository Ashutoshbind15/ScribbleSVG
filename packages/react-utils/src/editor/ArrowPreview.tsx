interface ArrowPreviewProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/**
 * Renders a dashed preview line from the arrow start point to the cursor
 * while creating an arrow element.
 */
export function ArrowPreview({
  startX,
  startY,
  endX,
  endY,
}: ArrowPreviewProps) {
  return (
    <g className="arrow-preview" pointerEvents="none">
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke="var(--color-primary, #3b82f6)"
        strokeWidth={1.5}
        strokeDasharray="6 3"
        opacity={0.6}
      />
      {/* Small circle at start point */}
      <circle
        cx={startX}
        cy={startY}
        r={3}
        fill="var(--color-primary, #3b82f6)"
        opacity={0.6}
      />
      {/* Small circle at end point */}
      <circle
        cx={endX}
        cy={endY}
        r={3}
        fill="var(--color-primary, #3b82f6)"
        opacity={0.6}
      />
    </g>
  );
}
