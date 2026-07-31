import type { Bounds } from "@scribblesvg/core";

interface MarqueeOverlayProps {
  bounds: Bounds;
}

/**
 * Virtual selection rectangle drawn while dragging a marquee (box select).
 */
export function MarqueeOverlay({ bounds }: MarqueeOverlayProps) {
  if (bounds.width <= 0 && bounds.height <= 0) return null;

  return (
    <g className="marquee-overlay" pointerEvents="none">
      <rect
        x={bounds.x}
        y={bounds.y}
        width={Math.max(bounds.width, 0)}
        height={Math.max(bounds.height, 0)}
        fill="var(--color-primary, #3b82f6)"
        fillOpacity={0.08}
        stroke="var(--color-primary, #3b82f6)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
    </g>
  );
}
