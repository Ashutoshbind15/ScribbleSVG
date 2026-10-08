import { useEffect, useMemo, useRef, useState } from "react";
import { RedoIcon, UndoIcon } from "./toolbarIcons";
import {
  DEFAULT_SHAPE_LABEL_FONT_SIZE,
  DEFAULT_TEXT_FONT_SIZE,
  getElementBounds,
  isConnector,
  type Bounds,
  type DiagramDocument,
} from "@scribblesvg/core";
import { useCanvasReducer } from "./useCanvasReducer";
import { getViewBox } from "./coordinate-utils";
import { screenToCanvas } from "./coordinate-utils";
import { ElementRenderer } from "./ElementRenderer";
import { SelectionOverlay } from "./SelectionOverlay";
import { MarqueeOverlay } from "./MarqueeOverlay";
import { ResizeHandles } from "./ResizeHandles";
import { CORNER_HANDLES, getGroupSelectionBounds } from "./hit-test";
import { ConnectionPoints } from "./ConnectionPoints";
import { ArrowPreview } from "./ArrowPreview";
import { InlineTextEditor } from "./InlineTextEditor";
import { Toolbar } from "./Toolbar";
import { TextSizeGrip } from "./TextSizeGrip";
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
    previewStart,
    hoveredConnectionPoint,
    marqueeBounds,
    spaceHeld,
    handleSize,
    // Text editing
    editingTarget,
    commitTextEditing,
    cancelTextEditing,
    changeEditingFontSize,
    stepEditingFontSize,
    updateEditingLayout,
    updateEditingText,
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

  // A multi-selection scales from the corners of its group box
  const groupSelectionBounds = useMemo(
    () => getGroupSelectionBounds(state.document.elements, state.selectedIds),
    [state.document.elements, state.selectedIds],
  );

  // Handle size in canvas-space (adjust for zoom)
  const handleSizeCanvas = handleSize / state.document.viewport.zoom;

  // ── Text size grip ──
  // Replaces box handles for standalone text and sizes shape labels. While
  // typing it shrinks to a quiet dot so the text stays the focus.
  let textSizeGrip: React.ReactNode = null;
  const zoom = state.document.viewport.zoom;
  const beginHistory = () => dispatch({ type: "BEGIN_HISTORY" });
  const endHistory = () => dispatch({ type: "END_HISTORY" });
  if (editingTarget) {
    const bounds =
      editingTarget.kind === "standalone-text"
        ? {
            x: editingTarget.x,
            y: editingTarget.y,
            width: editingTarget.width,
            height: editingTarget.height,
          }
        : centeredLabelBounds(
            editingTarget,
            editingTarget.text,
            editingTarget.fontSize,
          );
    textSizeGrip = (
      <TextSizeGrip
        bounds={bounds}
        anchor={editingTarget.kind === "standalone-text" ? "top-left" : "center"}
        fontSize={editingTarget.fontSize}
        zoom={zoom}
        showFrame={editingTarget.kind === "shape-label"}
        quiet
        activityKey={editingTarget.text}
        onStart={beginHistory}
        onChange={changeEditingFontSize}
        onEnd={endHistory}
      />
    );
  } else if (singleSelectedElement?.type === "text") {
    const element = singleSelectedElement;
    textSizeGrip = (
      <TextSizeGrip
        bounds={getElementBounds(element)}
        anchor="top-left"
        fontSize={element.fontSize ?? DEFAULT_TEXT_FONT_SIZE}
        zoom={zoom}
        onStart={beginHistory}
        onChange={(next) => {
          const size = measureDomTextSize(element.text, next);
          dispatch({
            type: "UPDATE_ELEMENT",
            id: element.id,
            patch: { fontSize: next, width: size.width, height: size.height },
          });
        }}
        onEnd={endHistory}
      />
    );
  } else if (
    singleSelectedElement &&
    !isConnector(singleSelectedElement) &&
    singleSelectedElement.text
  ) {
    const element = singleSelectedElement;
    const fontSize = element.fontSize ?? DEFAULT_SHAPE_LABEL_FONT_SIZE;
    textSizeGrip = (
      <TextSizeGrip
        bounds={centeredLabelBounds(
          getElementBounds(element),
          element.text ?? "",
          fontSize,
        )}
        anchor="center"
        fontSize={fontSize}
        zoom={zoom}
        showFrame
        onStart={beginHistory}
        onChange={(next) =>
          dispatch({
            type: "UPDATE_ELEMENT",
            id: element.id,
            patch: { fontSize: next },
          })
        }
        onEnd={endHistory}
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

          {/* Resize handles for single selected shape (text uses its grip) */}
          {!editingTarget &&
            singleSelectedElement &&
            singleSelectedElement.type !== "text" &&
            !isConnector(singleSelectedElement) && (
              <ResizeHandles
                element={singleSelectedElement}
                handleSize={handleSizeCanvas}
                onHandlePointerDown={handleResizeHandlePointerDown}
              />
            )}

          {/* Corner scale handles for a multi-selection */}
          {!editingTarget && groupSelectionBounds && (
            <ResizeHandles
              bounds={groupSelectionBounds}
              positions={CORNER_HANDLES}
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
          {previewStart && previewEnd && (
            <ArrowPreview
              startX={previewStart.x}
              startY={previewStart.y}
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
              onTextChange={updateEditingText}
              onFontSizeStep={stepEditingFontSize}
            />
          )}

          {/* Drag-to-resize grip for label / edited text */}
          {textSizeGrip}
        </svg>

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

/** Box a shape label's glyphs occupy, centered in the shape like TextRenderer. */
function centeredLabelBounds(
  shape: Bounds,
  text: string,
  fontSize: number,
): Bounds {
  const size = measureDomTextSize(text || " ", fontSize);
  return {
    x: shape.x + (shape.width - size.width) / 2,
    y: shape.y + (shape.height - size.height) / 2,
    width: size.width,
    height: size.height,
  };
}
