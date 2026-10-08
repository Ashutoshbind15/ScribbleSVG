import { useEffect, useRef, useState } from "react";
import type { Bounds } from "@scribblesvg/core";
import { scaleFontSizeFromGrip } from "./text-size";

interface TextSizeGripProps {
  /** Box around the text's glyphs (canvas coords) */
  bounds: Bounds;
  /**
   * Point the text scales about: its center for shape labels (centered
   * text), its top-left for standalone text (grows right/down).
   */
  anchor: "center" | "top-left";
  fontSize: number;
  zoom: number;
  /**
   * Outline `bounds` while the grip is hovered or dragged, so it's clear
   * what is being scaled (labels have no other chrome around the glyphs).
   */
  showFrame?: boolean;
  /**
   * Mid-edit mode: shrink to a small dot that hides while the user types
   * and opens into the size pill on hover.
   */
  quiet?: boolean;
  /** Changes on every keystroke; hides a quiet grip until typing pauses */
  activityKey?: string;
  onStart: () => void;
  onChange: (fontSize: number) => void;
  onEnd: () => void;
}

/** Screen-space sizes; divided by zoom so the grip stays constant on screen */
const FRAME_PAD = 4;
const PILL_HEIGHT = 16;
const PILL_FONT_SIZE = 9.5;
/** Rough advance per character at PILL_FONT_SIZE (600 weight) */
const PILL_CHAR_WIDTH = 6;
const PILL_PAD_X = 6;
const DOT_RADIUS = 4;
/** Invisible grab radius around the dot */
const DOT_HIT_RADIUS = 10;
/** How long the size readout lingers after a keyboard change */
const READOUT_LINGER_MS = 900;
/** Typing pause before a quiet grip reappears */
const TYPING_IDLE_MS = 700;

interface GripDrag {
  pointerId: number;
  clientStart: { x: number; y: number };
  gripStart: { x: number; y: number };
  anchor: { x: number; y: number };
  startFontSize: number;
}

/**
 * Direct-manipulation font size control pinned to the bottom-right corner
 * of the text. Dragging it away from the text grows the font, toward it
 * shrinks it; it shows the live size while hovered or dragged.
 *
 * Pointer-down doesn't take focus, so it also works mid-edit without
 * closing the inline editor.
 */
export function TextSizeGrip({
  bounds,
  anchor,
  fontSize,
  zoom,
  showFrame = false,
  quiet = false,
  activityKey,
  onStart,
  onChange,
  onEnd,
}: TextSizeGripProps) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lingering, setLingering] = useState(false);
  const [typing, setTyping] = useState(false);
  const dragRef = useRef<GripDrag | null>(null);

  // Flash the readout when the size changes from elsewhere (shortcuts).
  const lastFontSizeRef = useRef(fontSize);
  useEffect(() => {
    if (lastFontSizeRef.current === fontSize) return;
    lastFontSizeRef.current = fontSize;
    if (dragRef.current) return;
    setLingering(true);
    const timer = window.setTimeout(
      () => setLingering(false),
      READOUT_LINGER_MS,
    );
    return () => window.clearTimeout(timer);
  }, [fontSize]);

  // Stay out of the way while the user is typing.
  const lastActivityRef = useRef(activityKey);
  useEffect(() => {
    if (lastActivityRef.current === activityKey) return;
    lastActivityRef.current = activityKey;
    setTyping(true);
    const timer = window.setTimeout(() => setTyping(false), TYPING_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [activityKey]);

  const unit = 1 / zoom;
  const pad = FRAME_PAD * unit;
  const corner = {
    x: bounds.x + bounds.width + pad,
    y: bounds.y + bounds.height + pad,
  };
  const anchorPoint =
    anchor === "center"
      ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      : { x: bounds.x - pad, y: bounds.y - pad };

  const engaged = hovered || dragging;
  const showReadout = engaged || lingering;
  const compact = quiet && !showReadout;
  const hidden = quiet && typing && !engaged && !lingering;

  const label = showReadout ? `Aa ${Math.round(fontSize)}` : "Aa";
  const pillWidth = (label.length * PILL_CHAR_WIDTH + PILL_PAD_X * 2) * unit;
  const pillHeight = PILL_HEIGHT * unit;

  const handlePointerDown = (e: React.PointerEvent<SVGGElement>) => {
    if (e.button !== 0) return;
    // Keep focus in the inline editor and keep the canvas from reacting.
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      clientStart: { x: e.clientX, y: e.clientY },
      gripStart: corner,
      anchor: anchorPoint,
      startFontSize: fontSize,
    };
    setDragging(true);
    onStart();
  };

  const handlePointerMove = (e: React.PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const point = {
      x: drag.gripStart.x + (e.clientX - drag.clientStart.x) / zoom,
      y: drag.gripStart.y + (e.clientY - drag.clientStart.y) / zoom,
    };
    const next = scaleFontSizeFromGrip(
      drag.startFontSize,
      drag.anchor,
      drag.gripStart,
      point,
    );
    if (next !== Math.round(fontSize)) onChange(next);
  };

  const endDrag = (e: React.PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setDragging(false);
    onEnd();
  };

  return (
    <g
      className="text-size-grip"
      style={{
        opacity: hidden ? 0 : 1,
        transition: "opacity 160ms ease",
      }}
    >
      {showFrame && engaged && (
        <rect
          x={bounds.x - pad}
          y={bounds.y - pad}
          width={bounds.width + pad * 2}
          height={bounds.height + pad * 2}
          fill="none"
          stroke="var(--color-primary, #3b82f6)"
          strokeOpacity={0.6}
          strokeWidth={unit}
          strokeDasharray={`${3 * unit} ${3 * unit}`}
          rx={2 * unit}
          pointerEvents="none"
        />
      )}
      <g
        style={{ cursor: "nwse-resize" }}
        pointerEvents={hidden ? "none" : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <title>Drag to resize text (Ctrl/⌘ Shift &lt; or &gt;)</title>
        {/* Stays put as the dot opens into the pill, so hover doesn't flicker */}
        {quiet && (
          <circle
            cx={corner.x}
            cy={corner.y}
            r={DOT_HIT_RADIUS * unit}
            fill="transparent"
          />
        )}
        {compact ? (
          <circle
            cx={corner.x}
            cy={corner.y}
            r={DOT_RADIUS * unit}
            fill="var(--color-primary, #3b82f6)"
            stroke="white"
            strokeWidth={1.5 * unit}
          />
        ) : (
          <>
            <rect
              x={corner.x - pillHeight / 2}
              y={corner.y - pillHeight / 2}
              width={pillWidth}
              height={pillHeight}
              rx={pillHeight / 2}
              fill="var(--color-primary, #3b82f6)"
              stroke="white"
              strokeWidth={1.5 * unit}
            />
            <text
              x={corner.x - pillHeight / 2 + pillWidth / 2}
              y={corner.y}
              fontSize={PILL_FONT_SIZE * unit}
              fontWeight={600}
              fontFamily="'Segoe UI', system-ui, sans-serif"
              fill="white"
              textAnchor="middle"
              dominantBaseline="central"
              pointerEvents="none"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {label}
            </text>
          </>
        )}
      </g>
    </g>
  );
}
