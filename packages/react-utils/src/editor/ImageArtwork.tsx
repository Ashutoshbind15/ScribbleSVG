import { useState } from "react";
import type { ImageElement } from "@scribblesvg/core";

export function ImageArtwork({ element }: { element: ImageElement }) {
  const [status, setStatus] = useState<{ src: string; state: "loaded" | "error" }>({ src: "", state: "error" });
  const state = status.src === element.src ? status.state : "loading";
  const { x, y, width, height, src, alt } = element;
  return <g role={alt ? "img" : undefined} aria-label={alt} pointerEvents="none">
    <image x={x} y={y} width={width} height={height} href={src} preserveAspectRatio="xMidYMid slice" visibility={state === "loaded" ? "visible" : "hidden"} onLoad={() => setStatus({ src, state: "loaded" })} onError={() => setStatus({ src, state: "error" })} />
    {state !== "loaded" && <g><rect x={x} y={y} width={width} height={height} fill="none" stroke="#b91c1c" strokeWidth={1.5} strokeDasharray="4 3" /><text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fill="#b91c1c" fontSize={Math.max(10, Math.min(14, Math.min(width, height) / 6))}>{state === "loading" ? "Loading image" : "Image unavailable"}</text></g>}
  </g>;
}
