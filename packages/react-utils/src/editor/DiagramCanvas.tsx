import { useEffect, useMemo, useRef, useState } from "react";
import { RedoIcon, UndoIcon } from "./toolbarIcons";
import {
  DEFAULT_TEXT_FONT_SIZE,
  getElementBounds,
  isConnector,
  type DiagramDocument,
} from "@scribblesvg/core";
import { useCanvasReducer } from "./useCanvasReducer";
import { getViewBox } from "./coordinate-utils";
import { screenToCanvas, canvasToScreen } from "./coordinate-utils";
import { ElementRenderer } from "./ElementRenderer";
import { SelectionOverlay } from "./SelectionOverlay";
import { MarqueeOverlay } from "./MarqueeOverlay";
import { ResizeHandles } from "./ResizeHandles";
import { ConnectionPoints } from "./ConnectionPoints";
import { ArrowPreview } from "./ArrowPreview";
import { InlineTextEditor } from "./InlineTextEditor";
import { Toolbar } from "./Toolbar";
import { FontSizePopup } from "./FontSizePopup";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { measureDomTextSize } from "./measureDomText";
import { useCanvasInteraction } from "./useCanvasInteraction";
import { partitionIconCatalog, type DiagramIcon } from "../icons";

// ── Zoom limits ──
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
/** Trackpad pinch (browser sets ctrlKey without a physical Ctrl press). */
const PINCH_ZOOM_SENSITIVITY = 0.016;
/** Physical Ctrl/Cmd + scroll — scroll deltas are large, so keep this low. */
const CTRL_ZOOM_SENSITIVITY = 0.003;
/** Mouse wheel (line/page deltas, no modifier). */
const MOUSE_ZOOM_SENSITIVITY = 0.012;

export interface DiagramCanvasProps {
  /** Initial document to render (e.g. loaded from DB) */
  initialDocument?: DiagramDocument;
  /** Called whenever the document changes (for parent state tracking) */
  onChange?: (document: DiagramDocument) => void;
  /**
   * Icon catalog for resolving `icon` elements by `iconId`.
   * Valid entries become toolbar placement tools; documents only store `iconId`.
   */
  icons?: DiagramIcon[];
  /** Optional class on the editor root (e.g. for a fixed height). Requires editor.css. */
  className?: string;
}

/**
 * Main SVG canvas component with pan/zoom, element creation,
 * selection, dragging, resizing, arrow creation, and text editing.
 */
export function DiagramCanvas({
  initialDocument,
  onChange,
  icons,
  className,
}: DiagramCanvasProps) {
  const [state, dispatch] = useCanvasReducer(initialDocument);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const catalog = useMemo(() => partitionIconCatalog(icons), [icons]);

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
    marqueeBounds,
    spaceHeld,
    handleSize,
    // Text editing
    editingTarget,
    commitTextEditing,
    cancelTextEditing,
    changeEditingFontSize,
    updateEditingLayout,
  } = useCanvasInteraction(state, dispatch, svgRef, size, catalog.valid);

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

    // Pinch synthesizes ctrlKey on wheel events; a real Ctrl/Cmd keydown does not.
    let modKeyHeld = false;
    const isZoomModKey = (key: string) => key === "Control" || key === "Meta";
    const onKeyDown = (e: KeyboardEvent) => {
      if (isZoomModKey(e.key)) modKeyHeld = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isZoomModKey(e.key)) modKeyHeld = false;
    };
    const onBlur = () => {
      modKeyHeld = false;
    };

    const applyZoom = (e: WheelEvent, sensitivity: number) => {
      const viewport = viewportRef.current;
      const currentSize = sizeRef.current;
      const rect = svg.getBoundingClientRect();
      const pointerScreenX = e.clientX - rect.left;
      const pointerScreenY = e.clientY - rect.top;

      const canvasBefore = screenToCanvas(
        pointerScreenX,
        pointerScreenY,
        viewport,
        { width: currentSize.width, height: currentSize.height },
      );

      const rawDelta =
        e.deltaMode === 1
          ? e.deltaY * 16
          : e.deltaMode === 2
            ? e.deltaY * 800
            : e.deltaY;
      const newZoom = Math.min(
        MAX_ZOOM,
        Math.max(
          MIN_ZOOM,
          viewport.zoom * Math.exp(-rawDelta * sensitivity),
        ),
      );

      const canvasAfter = screenToCanvas(
        pointerScreenX,
        pointerScreenY,
        { ...viewport, zoom: newZoom },
        { width: currentSize.width, height: currentSize.height },
      );

      dispatchRef.current({
        type: "SET_VIEWPORT",
        viewport: {
          x: viewport.x + (canvasBefore.x - canvasAfter.x),
          y: viewport.y + (canvasBefore.y - canvasAfter.y),
          zoom: newZoom,
        },
      });
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const viewport = viewportRef.current;

      // ctrlKey on the event: pinch (synthetic) or Ctrl/Cmd+scroll (physical).
      if (e.ctrlKey || e.metaKey) {
        applyZoom(
          e,
          modKeyHeld ? CTRL_ZOOM_SENSITIVITY : PINCH_ZOOM_SENSITIVITY,
        );
        return;
      }

      // Mouse wheels usually report line/page mode; trackpads use pixel pan.
      if (e.deltaMode === 1 || e.deltaMode === 2) {
        applyZoom(e, MOUSE_ZOOM_SENSITIVITY);
        return;
      }

      const scale = 1;
      dispatchRef.current({
        type: "SET_VIEWPORT",
        viewport: {
          ...viewport,
          x: viewport.x + (e.deltaX * scale) / viewport.zoom,
          y: viewport.y + (e.deltaY * scale) / viewport.zoom,
        },
      });
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      svg.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []); // svgRef is stable; refs handle changing state

  const viewBox = getViewBox(state.document.viewport, size.width, size.height);

  // Determine the single selected element for resize handles
  const singleSelectedElement =
    state.selectedIds.size === 1
      ? state.document.elements.find((el) => state.selectedIds.has(el.id))
      : null;

  // Handle size in canvas-space (adjust for zoom)
  const handleSizeCanvas = handleSize / state.document.viewport.zoom;

  // ── Font size popup ──
  // Mode-split: standalone text shows it on select; shape labels only while
  // editing (so selection chrome stays geometry-only).
  let fontSizePopup: React.ReactNode = null;
  if (editingTarget) {
    const anchor = canvasToScreen(
      editingTarget.x + editingTarget.width / 2,
      editingTarget.y,
      state.document.viewport,
      size,
    );
    fontSizePopup = (
      <FontSizePopup
        fontSize={editingTarget.fontSize}
        screenX={anchor.x}
        screenY={anchor.y}
        onChange={changeEditingFontSize}
      />
    );
  } else if (singleSelectedElement?.type === "text") {
    const bounds = getElementBounds(singleSelectedElement);
    const anchor = canvasToScreen(
      bounds.x + bounds.width / 2,
      bounds.y,
      state.document.viewport,
      size,
    );
    fontSizePopup = (
      <FontSizePopup
        fontSize={singleSelectedElement.fontSize ?? DEFAULT_TEXT_FONT_SIZE}
        screenX={anchor.x}
        screenY={anchor.y}
        onChange={(fontSize) => {
          const textSize = measureDomTextSize(
            singleSelectedElement.text,
            fontSize,
          );
          dispatch({
            type: "UPDATE_ELEMENT",
            id: singleSelectedElement.id,
            patch: {
              fontSize,
              width: textSize.width,
              height: textSize.height,
            },
          });
        }}
      />
    );
  }

  return (
    <div
      className={["scribblesvg-editor", className].filter(Boolean).join(" ")}
    >
      <div className="scribblesvg-editor__header">
        <Toolbar
          activeTool={state.tool}
          activeIconId={state.activeIconId}
          catalogIcons={catalog.valid}
          onToolChange={(tool, activeIconId) =>
            dispatch({ type: "SET_TOOL", tool, activeIconId })
          }
        />
        <div className="scribblesvg-editor__history">
          <button
            type="button"
            title="Undo"
            aria-label="Undo"
            disabled={state.past.length === 0}
            onClick={() => dispatch({ type: "UNDO" })}
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            title="Redo"
            aria-label="Redo"
            disabled={state.future.length === 0}
            onClick={() => dispatch({ type: "REDO" })}
          >
            <RedoIcon />
          </button>
        </div>
        <KeyboardShortcuts />
        <span className="scribblesvg-editor__zoom">
          {Math.round(state.document.viewport.zoom * 100)}%
        </span>
      </div>

      <div ref={containerRef} className="scribblesvg-editor__viewport">
        <svg
          ref={svgRef}
          viewBox={viewBox}
          width={size.width}
          height={size.height}
          className="scribblesvg-editor__svg"
          style={{ cursor: getCursor() }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
        >
          {/* Elements in array order (first = bottom, last = top) */}
          {state.document.elements.map((el) => (
            <ElementRenderer
              key={el.id}
              element={el}
              isSelected={state.selectedIds.has(el.id)}
              isEditingText={editingTarget?.elementId === el.id}
              icons={catalog.valid}
            />
          ))}

          {/* Selection overlay on top of elements */}
          <SelectionOverlay
            elements={state.document.elements}
            selectedIds={state.selectedIds}
            editingTarget={editingTarget}
          />

          {/* Marquee (box) selection preview */}
          {marqueeBounds && <MarqueeOverlay bounds={marqueeBounds} />}

          {/* Resize handles for single selected element */}
          {!editingTarget &&
            singleSelectedElement &&
            !isConnector(singleSelectedElement) && (
              <ResizeHandles
                element={singleSelectedElement}
                handleSize={handleSizeCanvas}
                onHandlePointerDown={handleResizeHandlePointerDown}
              />
            )}

          {/* Connection points while a connector tool is active */}
          {!editingTarget &&
            (state.tool === "arrow" || state.tool === "line") && (
              <ConnectionPoints
                elements={state.document.elements}
                pointRadius={handleSizeCanvas}
                hoveredPoint={hoveredConnectionPoint}
                activeStartPoint={arrowStart?.point ?? null}
                onPointerDown={handleConnectionPointPointerDown}
              />
            )}

          {/* Connector creation preview */}
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
              onLayoutChange={updateEditingLayout}
            />
          )}
        </svg>

        {/* Font size popup for the selected text-bearing element */}
        {fontSizePopup}

        {catalog.warnings.length > 0 && (
          <div
            className="scribblesvg-editor__icon-warn"
            role="status"
            title={catalog.warnings.join("\n")}
          >
            Skipped {catalog.warnings.length} invalid icon
            {catalog.warnings.length === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </div>
  );
}
