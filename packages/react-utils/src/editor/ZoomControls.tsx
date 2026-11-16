import { useEffect, useRef } from "react";
import { FitIcon } from "./toolbarIcons";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  sliderPositionToZoom,
  snapZoomToHundred,
  stepZoom,
  zoomToSliderPosition,
} from "./zoom";

interface ZoomControlsProps {
  zoom: number;
  /** Zoom around the viewport centre. */
  onZoomChange: (zoom: number) => void;
  onFit: () => void;
  onReset: () => void;
}

const toPercent = (zoom: number) => Math.round(zoom * 100);

/**
 * Bottom-right zoom card: log-scale slider, zoom to fit, and a reset button
 * that shows the live percent. Presses here never reach the canvas (the card
 * is a sibling of the SVG), and the editor root's pointer rule still gives
 * the canvas focus, so shortcuts keep working after a click.
 */
export function ZoomControls({
  zoom,
  onZoomChange,
  onFit,
  onReset,
}: ZoomControlsProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const percent = toPercent(zoom);

  // Wheel over the card neither zooms the canvas (its listener is on the
  // SVG) nor scrolls or page-zooms the host page. Native for passive: false.
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const onWheel = (e: WheelEvent) => e.preventDefault();
    card.addEventListener("wheel", onWheel, { passive: false });
    return () => card.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={cardRef}
      className="scribblesvg-editor__zoom-card"
      onPointerDown={stopPropagation}
      onDoubleClick={stopPropagation}
    >
      {/* Slots stack above the row (a minimap later); the row stays put. */}
      <div className="scribblesvg-editor__zoom-row">
        <ZoomSlider zoom={zoom} onChange={onZoomChange} />
        <button
          type="button"
          className="scribblesvg-editor__zoom-fit"
          title="Zoom to fit (Shift+1)"
          aria-label="Zoom to fit"
          onClick={onFit}
        >
          <FitIcon />
        </button>
        <button
          type="button"
          className="scribblesvg-editor__zoom-reset"
          title="Reset to 100% (Shift+0)"
          aria-label={`Zoom ${percent}%, reset to 100%`}
          data-zoomed={percent !== 100 ? "true" : undefined}
          onClick={onReset}
        >
          {percent}%
        </button>
      </div>
    </div>
  );
}

function stopPropagation(e: React.SyntheticEvent) {
  e.stopPropagation();
}

/**
 * Slider on a log scale: filled track, round thumb, a soft notch at 100%.
 * A custom role="slider" rather than <input type="range">: the editor treats
 * inputs as text fields that keep focus and every key, while a press here
 * should hand focus to the canvas like the other buttons.
 */
function ZoomSlider({
  zoom,
  onChange,
}: {
  zoom: number;
  onChange: (zoom: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const position = `${zoomToSliderPosition(zoom) * 100}%`;
  const percent = toPercent(zoom);

  const zoomAtPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return zoom;
    const p = (clientX - rect.left) / rect.width;
    return snapZoomToHundred(sliderPositionToZoom(p));
  };

  /** The pointer dragging the thumb, captured so the drag can leave the card. */
  const dragPointerRef = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragPointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onChange(zoomAtPointer(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragPointerRef.current !== e.pointerId) return;
    onChange(zoomAtPointer(e.clientX));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragPointerRef.current === e.pointerId) dragPointerRef.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
      case "PageUp":
        next = stepZoom(zoom, 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
      case "PageDown":
        next = stepZoom(zoom, -1);
        break;
      case "Home":
        next = MIN_ZOOM;
        break;
      case "End":
        next = MAX_ZOOM;
        break;
    }
    if (next === null) return;
    e.preventDefault();
    onChange(next);
  };

  return (
    <div
      className="scribblesvg-editor__zoom-slider"
      role="slider"
      tabIndex={0}
      aria-label="Zoom"
      aria-orientation="horizontal"
      aria-valuemin={toPercent(MIN_ZOOM)}
      aria-valuemax={toPercent(MAX_ZOOM)}
      aria-valuenow={percent}
      aria-valuetext={`${percent}%`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onKeyDown={handleKeyDown}
    >
      <div ref={trackRef} className="scribblesvg-editor__zoom-slider-inner">
        <div className="scribblesvg-editor__zoom-slider-track">
          <div
            className="scribblesvg-editor__zoom-slider-range"
            style={{ width: position }}
          />
        </div>
        <div
          className="scribblesvg-editor__zoom-slider-thumb"
          style={{ left: position }}
        />
      </div>
    </div>
  );
}
