import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RedoIcon, UndoIcon } from "./toolbarIcons";
import {
  DEFAULT_SHAPE_LABEL_FONT_SIZE,
  DEFAULT_TEXT_FONT_SIZE,
  getContentBounds,
  getElementBounds,
  generateSeed,
  isConnector,
  isLabeledShape,
  type Bounds,
  type DiagramDocument,
} from "@scribblesvg/core";
import { measureImage } from "./image-fit";
import { useCanvasReducer } from "./useCanvasReducer";
import { getViewBox } from "./coordinate-utils";
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
import {
  handleShortcutKey,
  isApplePlatform,
  isTextEntry,
  type Command,
} from "./keymap";
import { useHeldModifiers } from "./useHeldModifiers";
import { measureDomTextSize } from "./measureDomText";
import { useCanvasInteraction } from "./useCanvasInteraction";
import { partitionIconCatalog, type DiagramIcon } from "../icons";
import { ZoomControls } from "./ZoomControls";
import { fitViewport, stepZoom, zoomAround } from "./zoom";

// ── Wheel zoom sensitivity ──
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
  /**
   * Shows an Image toolbar button. Resolve with the image to insert (its
   * `src` is stored as-is in the document), or `null` to cancel.
   * The editor loads the image to measure its natural size.
   */
  onRequestImage?: () => Promise<{
    src: string;
    alt?: string;
  } | null>;
  /** Optional class on the editor root (e.g. for a fixed height). Requires editor.css. */
  className?: string;
  /**
   * Focus the canvas on mount, so shortcuts work before the first click.
   * Shortcuts only reach the editor while focus is inside it.
   */
  autoFocus?: boolean;
  /**
   * On mount, once the canvas has a size, frame the initial document's
   * content (never zooming in past 100%). Off by default: the document's
   * saved viewport is kept.
   */
  fitOnLoad?: boolean;
}

/**
 * Main SVG canvas component with pan/zoom, element creation,
 * selection, dragging, resizing, arrow creation, and text editing.
 */
export function DiagramCanvas({
  initialDocument,
  onChange,
  icons,
  onRequestImage,
  className,
  autoFocus = false,
  fitOnLoad = false,
}: DiagramCanvasProps) {
  const [state, dispatch] = useCanvasReducer(initialDocument, { fitOnLoad });
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const catalog = useMemo(() => partitionIconCatalog(icons), [icons]);
  const { size } = state;

  // ── Resize observer ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        dispatch({ type: "RESIZE", size: { width, height } });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [dispatch]);

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
    handleDelete,
    handleCopy,
    handleCut,
    handlePaste,
    stepSelectionFontSize,
    cancelGesture,
    setSpaceHeld,
    setShiftSnap,
    releaseHeldKeys,
    // Text editing
    editingTarget,
    commitTextEditing,
    cancelTextEditing,
    changeEditingFontSize,
    stepEditingFontSize,
    updateEditingLayout,
    updateEditingText,
  } = useCanvasInteraction(state, dispatch, svgRef, catalog.valid);

  const [helpOpen, setHelpOpen] = useState(false);
  // Detected after mount so server and first client render agree.
  const [isApple, setIsApple] = useState(false);
  useEffect(() => {
    setIsApple(isApplePlatform());
  }, []);

  // ── Zoom commands (slider, buttons, keys): around the viewport centre ──
  const viewport = state.document.viewport;
  const setViewport = (next: typeof viewport) =>
    dispatch({ type: "SET_VIEWPORT", viewport: next });
  const zoomToCentre = (zoom: number) => setViewport(zoomAround(viewport, zoom));
  const zoomToFit = () =>
    setViewport(fitViewport(getContentBounds(state.document.elements), size));
  const resetZoom = () => zoomToCentre(1);

  const runCommand = (command: Command): boolean => {
    switch (command.type) {
      case "undo":
        dispatch({ type: "UNDO" });
        return true;
      case "redo":
        dispatch({ type: "REDO" });
        return true;
      case "copy":
        return handleCopy();
      case "cut":
        handleCut();
        return true;
      case "paste":
        void handlePaste();
        return true;
      case "delete":
        handleDelete();
        return true;
      case "fontStep":
        stepSelectionFontSize(command.direction);
        return true;
      case "cancelGesture":
        cancelGesture();
        return true;
      case "toggleHelp":
        setHelpOpen((open) => !open);
        return true;
      case "closeHelp":
        setHelpOpen(false);
        if (command.cancelGesture) cancelGesture();
        return true;
      case "panHold":
      case "panRelease":
        setSpaceHeld(command.type === "panHold");
        return true;
      case "snapHold":
      case "snapRelease":
        setShiftSnap(command.type === "snapHold");
        return true;
      case "zoomStep":
        zoomToCentre(stepZoom(viewport.zoom, command.direction));
        return true;
      case "zoomFit":
        zoomToFit();
        return true;
      case "zoomReset":
        resetZoom();
        return true;
    }
  };

  const handleRootKey = (e: React.KeyboardEvent) =>
    handleShortcutKey(
      e,
      {
        hasSelection: state.selectedIds.size > 0,
        editingText: editingTarget !== null,
        helpOpen,
        isApple,
      },
      runCommand,
    );

  /**
   * Focus never comes from Tab here (presses, autoFocus, leaving the text
   * editor), so ask for no ring: Chrome otherwise shows :focus-visible for a
   * script focus inside a pointer press.
   */
  const focusViewport = useCallback(() => {
    containerRef.current?.focus({ preventScroll: true, focusVisible: false });
  }, []);

  const inlineEditorHasFocus = () => {
    const active = document.activeElement;
    return isTextEntry(active) && !!rootRef.current?.contains(active);
  };

  // Capture phase, so a child's preventDefault/stopPropagation can't skip it.
  const handleRootPointerDownCapture = (e: React.PointerEvent) => {
    if (isTextEntry(e.target)) return;
    if (
      inlineEditorHasFocus() &&
      containerRef.current?.contains(e.target as Node)
    ) {
      // Focusing now would blur (and commit) the inline editor before the
      // canvas's pointerdown runs, so that press would see editing already
      // over. Let the canvas act first: it commits the edit itself, or keeps
      // it open (text size grip). Then take focus if the editor closed.
      window.setTimeout(() => {
        if (!inlineEditorHasFocus()) focusViewport();
      });
      return;
    }
    focusViewport();
  };

  // Keeps toolbar buttons from taking focus on press.
  const handleRootMouseDownCapture = (e: React.MouseEvent) => {
    if (!isTextEntry(e.target)) e.preventDefault();
  };

  /**
   * Escape commits while the textarea still has focus: hand focus back to the
   * canvas so shortcuts keep working once it unmounts. A blur commit leaves
   * focus wherever the user put it.
   */
  const handleEditorCommit: typeof commitTextEditing = (...args) => {
    const refocus = inlineEditorHasFocus();
    commitTextEditing(...args);
    if (refocus) focusViewport();
  };

  const handleRootBlur = (e: React.FocusEvent) => {
    if (rootRef.current?.contains(e.relatedTarget as Node | null)) return;
    releaseHeldKeys();
    // Checked after focus settles: closing the text editor drops focus for a
    // moment before the canvas takes it back, and switching windows or tabs
    // (document loses focus) keeps the selection.
    window.setTimeout(() => {
      const root = rootRef.current;
      if (!root || !document.hasFocus()) return;
      if (root.contains(document.activeElement)) return;
      dispatch({ type: "CLEAR_SELECTION" });
    });
  };
  const releaseHeldKeysRef = useRef(releaseHeldKeys);
  releaseHeldKeysRef.current = releaseHeldKeys;
  useEffect(() => {
    const onWindowBlur = () => releaseHeldKeysRef.current();
    window.addEventListener("blur", onWindowBlur);
    return () => window.removeEventListener("blur", onWindowBlur);
  }, []);

  useEffect(() => {
    if (autoFocus) focusViewport();
    // Mount only: autoFocus is an initial-focus hint, like the HTML attribute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modKeyHeld = useHeldModifiers();

  /**
   * Asks the host for an image and inserts it centred in the viewport.
   * Cancelled, unloadable or invalid images are skipped; the host reports its own errors.
   */
  const insertRequestedImage = async () => {
    const result = await onRequestImage?.().catch(() => null);
    const natural = result && (await measureImage(result.src));
    if (!result || !natural) return;

    dispatch({
      type: "INSERT_IMAGE",
      image: {
        type: "image",
        id: crypto.randomUUID(),
        seed: generateSeed(),
        src: result.src,
        naturalWidth: natural.width,
        naturalHeight: natural.height,
        ...(result.alt ? { alt: result.alt } : {}),
      },
    });
  };

  // ── Wheel zoom (native listener for non-passive preventDefault) ──
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const applyZoom = (e: WheelEvent, sensitivity: number) => {
      const rect = svg.getBoundingClientRect();
      const rawDelta =
        e.deltaMode === 1
          ? e.deltaY * 16
          : e.deltaMode === 2
            ? e.deltaY * 800
            : e.deltaY;
      dispatch({
        type: "ZOOM_AT",
        factor: Math.exp(-rawDelta * sensitivity),
        screenPoint: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      });
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // ctrlKey on the event: pinch (synthetic) or Ctrl/Cmd+scroll (physical).
      if (e.ctrlKey || e.metaKey) {
        applyZoom(
          e,
          modKeyHeld.current ? CTRL_ZOOM_SENSITIVITY : PINCH_ZOOM_SENSITIVITY,
        );
        return;
      }

      // Mouse wheels usually report line/page mode; trackpads use pixel pan.
      if (e.deltaMode === 1 || e.deltaMode === 2) {
        applyZoom(e, MOUSE_ZOOM_SENSITIVITY);
        return;
      }

      dispatch({ type: "PAN_BY", dx: e.deltaX, dy: e.deltaY });
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [dispatch, modKeyHeld]);

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
    isLabeledShape(singleSelectedElement) &&
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
      ref={rootRef}
      className={["scribblesvg-editor", className].filter(Boolean).join(" ")}
      onKeyDown={handleRootKey}
      onKeyUp={handleRootKey}
      onPointerDownCapture={handleRootPointerDownCapture}
      onMouseDownCapture={handleRootMouseDownCapture}
      onBlur={handleRootBlur}
    >
      <div className="scribblesvg-editor__header">
        <Toolbar
          activeTool={state.tool}
          activeIconId={state.activeIconId}
          catalogIcons={catalog.valid}
          onImage={onRequestImage ? insertRequestedImage : undefined}
          onToolChange={(tool, activeIconId) =>
            dispatch({ type: "SET_TOOL", tool, activeIconId })
          }
          pencilSmoothing={state.pencilSmoothing}
          onPencilSmoothingChange={(enabled) =>
            dispatch({ type: "SET_PENCIL_SMOOTHING", enabled })
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
        <KeyboardShortcuts
          open={helpOpen}
          onOpenChange={setHelpOpen}
          isApple={isApple}
        />
      </div>

      <div
        ref={containerRef}
        className="scribblesvg-editor__viewport"
        tabIndex={0}
      >
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
              onCommit={handleEditorCommit}
              onCancel={cancelTextEditing}
              onLayoutChange={updateEditingLayout}
              onTextChange={updateEditingText}
              onFontSizeStep={stepEditingFontSize}
            />
          )}

          {/* Drag-to-resize grip for label / edited text */}
          {textSizeGrip}
        </svg>

        <ZoomControls
          zoom={viewport.zoom}
          onZoomChange={zoomToCentre}
          onFit={zoomToFit}
          onReset={resetZoom}
        />

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
