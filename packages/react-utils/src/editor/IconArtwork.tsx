import type { Bounds } from "@scribblesvg/core";
import {
  getIconRenderMode,
  parseIconSvg,
  type DiagramIcon,
} from "../icons";

interface IconArtworkProps {
  iconId: string;
  bounds: Bounds;
  icons?: DiagramIcon[];
  /** Stroke/text color for the missing-icon placeholder. */
  errorColor?: string;
}

/**
 * Renders catalog SVG inside an icon element's bbox, or an SVG error placeholder.
 */
export function IconArtwork({
  iconId,
  bounds,
  icons,
  errorColor = "#b91c1c",
}: IconArtworkProps) {
  const mode = getIconRenderMode(icons, iconId);
  const { x, y, width, height } = bounds;
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);

  if (mode.kind === "resolved") {
    const parsed = parseIconSvg(mode.icon.svg);
    if (!parsed) {
      return (
        <MissingIconPlaceholder
          iconId={iconId}
          x={x}
          y={y}
          width={w}
          height={h}
          errorColor={errorColor}
        />
      );
    }

    return (
      <svg
        x={x}
        y={y}
        width={w}
        height={h}
        viewBox={parsed.viewBox}
        preserveAspectRatio="xMidYMid meet"
        overflow="visible"
        pointerEvents="none"
        dangerouslySetInnerHTML={{ __html: parsed.content }}
      />
    );
  }

  return (
    <MissingIconPlaceholder
      iconId={iconId}
      x={x}
      y={y}
      width={w}
      height={h}
      errorColor={errorColor}
    />
  );
}

function MissingIconPlaceholder({
  iconId,
  x,
  y,
  width,
  height,
  errorColor,
}: {
  iconId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  errorColor: string;
}) {
  const fontSize = Math.max(10, Math.min(14, Math.min(width, height) / 6));
  const label = `Missing icon: ${iconId}`;

  return (
    <g data-icon-missing={iconId} pointerEvents="none">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke={errorColor}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={errorColor}
        fontSize={fontSize}
        fontFamily="'Segoe UI', system-ui, sans-serif"
      >
        {label}
      </text>
    </g>
  );
}
