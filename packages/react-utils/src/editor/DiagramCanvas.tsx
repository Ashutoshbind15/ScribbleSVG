import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_SHAPE_LABEL_FONT_SIZE,
  DEFAULT_TEXT_FONT_SIZE,
  getElementBounds,
  type DiagramDocument,
} from "@scribblesvg/core";
import { useCanvasReducer } from "./useCanvasReducer";
import { getViewBox } from "./coordinate-utils";
import { screenToCanvas, canvasToScreen } from "./coordinate-utils";
import { GridBackground } from "./GridBackground";
import { ElementRenderer } from "./ElementRenderer";
import { SelectionOverlay } from "./SelectionOverlay";
import { ResizeHandles } from "./ResizeHandles";
import { ConnectionPoints } from "./ConnectionPoints";
import { ArrowPreview } from "./ArrowPreview";
import { InlineTextEditor } from "./InlineTextEditor";
import { Toolbar } from "./Toolbar";
import { FontSizePopup } from "./FontSizePopup";
import { useCanvasInteraction } from "./useCanvasInteraction";

// ── Zoom limits ──
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_SENSITIVITY = 0.001;

interface DiagramCanvasProps {
  /** Initial document to render (e.g. loaded from DB) */
  initialDocument?: DiagramDocument;
  /** Called whenever the document changes (for parent state tracking) */
  onChange?: (document: DiagramDocument) => void;
}

/**
 * Main SVG canvas component with pan/zoom, element creation,
 * selection, dragging, resizing, arrow creation, and text editing.
 */
export function DiagramCanvas({
  initialDocument,
  onChange,
}: DiagramCanvasProps) {
  const [state, dispatch] = useCanvasReducer(initialDocument);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Container dimensions for viewBox computation
  const [size, setSize] = useState({ width: 800, height: 600 });

  // ── Resize observer ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Notify parent of document changes ──
  useEffect(() => {
    onChange?.(state.document);
  }, [state.document, onChange]);

  // ── Interaction hook ──
  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
    handleResizeHandlePointerDown,
    handleConnectionPointPointerDown,
    getCursor,
    arrowStart,
    previewEnd,
    hoveredConnectionPoint,
    spaceHeld,
    handleSize,
    // Text editing
    editingTarget,
    commitTextEditing,
    cancelTextEditing,
  } = useCanvasInteraction(state, dispatch, svgRef, size);

  // ── Wheel zoom (native listener for non-passive preventDefault) ──
  // Store latest values in refs so the native listener always sees current state
  const viewportRef = useRef(state.document.viewport);
  viewportRef.current = state.document.viewport;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = svg.getBoundingClientRect();
      const pointerScreenX = e.clientX - rect.left;
      const pointerScreenY = e.clientY - rect.top;

      const viewport = viewportRef.current;
      const currentSize = sizeRef.current;

      // Canvas coords under cursor before zoom
      const canvasBefore = screenToCanvas(
        pointerScreenX,
        pointerScreenY,
        viewport,
        { width: currentSize.width, height: currentSize.height },
      );

      // Compute new zoom
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      const newZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, viewport.zoom * (1 + delta)),
      );

      // Canvas coords under cursor after zoom (with same viewport origin)
      const canvasAfter = screenToCanvas(
        pointerScreenX,
        pointerScreenY,
        { ...viewport, zoom: newZoom },
        { width: currentSize.width, height: currentSize.height },
      );

      // Adjust viewport so the point under cursor stays fixed
      dispatchRef.current({
        type: "SET_VIEWPORT",
        viewport: {
          x: viewport.x + (canvasBefore.x - canvasAfter.x),
          y: viewport.y + (canvasBefore.y - canvasAfter.y),
          zoom: newZoom,
        },
      });
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, []); // svgRef is stable; refs handle changing state

  const viewBox = getViewBox(state.document.viewport, size.width, size.height);

  // Determine the single selected element for resize handles
  const singleSelectedElement =
    state.selectedIds.size === 1
      ? state.document.elements.find((el) => state.selectedIds.has(el.id))
      : null;

  // Handle size in canvas-space (adjust for zoom)
  const handleSizeCanvas = handleSize / state.document.viewport.zoom;

  // ── Font size popup: shown for a single selected element that has
  // (or can have) text, so its font size can be changed independently
  // of the parent element's width/height. ──
  const fontSizeElement =
    !editingTarget &&
    singleSelectedElement &&
    singleSelectedElement.type !== "arrow" &&
    (singleSelectedElement.type === "text" ||
      ("text" in singleSelectedElement && !!singleSelectedElement.text))
      ? singleSelectedElement
      : null;

  let fontSizePopup: React.ReactNode = null;
  if (fontSizeElement) {
    const bounds = getElementBounds(fontSizeElement);
    const anchor = canvasToScreen(
      bounds.x + bounds.width / 2,
      bounds.y,
      state.document.viewport,
      size,
    );
    const defaultFontSize =
      fontSizeElement.type === "text"
        ? DEFAULT_TEXT_FONT_SIZE
        : DEFAULT_SHAPE_LABEL_FONT_SIZE;
    fontSizePopup = (
      <FontSizePopup
        fontSize={fontSizeElement.fontSize ?? defaultFontSize}
        screenX={anchor.x}
        screenY={anchor.y}
        onChange={(fontSize) =>
          dispatch({
            type: "UPDATE_ELEMENT",
            id: fontSizeElement.id,
            patch: { fontSize },
          })
        }
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Toolbar
          activeTool={state.tool}
          onToolChange={(tool) => dispatch({ type: "SET_TOOL", tool })}
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {Math.round(state.document.viewport.zoom * 100)}%
        </span>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-background"
      >
        <svg
          ref={svgRef}
          viewBox={viewBox}
          width={size.width}
          height={size.height}
          className="absolute inset-0"
          style={{ cursor: getCursor() }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
        >
          <GridBackground />

          {/* Elements in array order (first = bottom, last = top) */}
          {state.document.elements.map((el) => (
            <ElementRenderer
              key={el.id}
              element={el}
              isSelected={state.selectedIds.has(el.id)}
              isEditingText={editingTarget?.elementId === el.id}
            />
          ))}

          {/* Selection overlay on top of elements */}
          <SelectionOverlay
            elements={state.document.elements}
            selectedIds={state.selectedIds}
          />

          {/* Resize handles for single selected element */}
          {!editingTarget &&
            singleSelectedElement &&
            singleSelectedElement.type !== "arrow" && (
              <ResizeHandles
                element={singleSelectedElement}
                handleSize={handleSizeCanvas}
                onHandlePointerDown={handleResizeHandlePointerDown}
              />
            )}

          {/* Connection points while arrow tool is active */}
          {!editingTarget && state.tool === "arrow" && (
            <ConnectionPoints
              elements={state.document.elements}
              pointRadius={handleSizeCanvas}
              hoveredPoint={hoveredConnectionPoint}
              activeStartPoint={arrowStart?.point ?? null}
              onPointerDown={handleConnectionPointPointerDown}
            />
          )}

          {/* Arrow creation preview */}
          {arrowStart && previewEnd && (
            <ArrowPreview
              startX={arrowStart.point.x}
              startY={arrowStart.point.y}
              endX={previewEnd.x}
              endY={previewEnd.y}
            />
          )}

          {/* Inline text editor overlay */}
          {editingTarget && (
            <InlineTextEditor
              target={editingTarget}
              onCommit={commitTextEditing}
              onCancel={cancelTextEditing}
            />
          )}
        </svg>

        {/* Font size popup for the selected text-bearing element */}
        {fontSizePopup}
      </div>
    </div>
  );
}
