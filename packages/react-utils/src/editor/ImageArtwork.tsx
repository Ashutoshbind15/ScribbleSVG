import { useState } from "react";
import type { ImageElement } from "@scribblesvg/core";

type LoadState = "loading" | "loaded" | "error";

/** Neutral grey, so a loading image never reads as an error. */
const LOADING_COLOR = "#9ca3af";

interface ImageArtworkProps {
  element: ImageElement;
  /** Colour of the "Image unavailable" placeholder. */
  color?: string;
}

/**
 * Renders an image element crisply (no scribble treatment), with a dashed
 * placeholder while it loads or if it fails.
 */
export function ImageArtwork({ element, color = "#b91c1c" }: ImageArtworkProps) {
  const { x, y, width, height, src, alt } = element;
  // Keyed by src, so a changed source starts over as "loading".
  const [loaded, setLoaded] = useState<{ src: string; state: LoadState }>({
    src,
    state: "loading",
  });
  const state: LoadState = loaded.src === src ? loaded.state : "loading";

  return (
    <g
      role={alt ? "img" : undefined}
      aria-label={alt}
      data-image-state={state}
      pointerEvents="none"
    >
      <image
        x={x}
        y={y}
        width={width}
        height={height}
        href={src}
        preserveAspectRatio="xMidYMid slice"
        visibility={state === "loaded" ? "visible" : "hidden"}
        onLoad={() => setLoaded({ src, state: "loaded" })}
        onError={() => setLoaded({ src, state: "error" })}
      />
      {state !== "loaded" && (
        <ImagePlaceholder
          x={x}
          y={y}
          width={width}
          height={height}
          color={state === "error" ? color : LOADING_COLOR}
          failed={state === "error"}
        />
      )}
    </g>
  );
}

function ImagePlaceholder({
  x,
  y,
  width,
  height,
  color,
  failed,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  failed: boolean;
}) {
  const fontSize = Math.max(10, Math.min(14, Math.min(width, height) / 6));
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize={fontSize}
        fontFamily="'Segoe UI', system-ui, sans-serif"
      >
        {failed ? "Image unavailable" : "Loading image"}
      </text>
    </g>
  );
}
