import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_SHAPE_LABEL_FONT_SIZE,
  DEFAULT_TEXT_FONT_SIZE,
  generateSeed,
  getElementBounds,
  type CircleElement,
  type CylinderElement,
  type DiagramDocument,
  type DiagramElement,
  type IconElement,
  type RectangleElement,
  type TextElement,
  type Viewport,
} from "@scribblesvg/core";
import { screenToCanvas } from "./coordinate-utils";
import { hitTest, hitTestResizeHandle, hitTestConnectionPoint } from "./hit-test";
import type { HandlePosition, ConnectionPointHit } from "./hit-test";
import { useElementDrag } from "./useElementDrag";
import { useElementResize } from "./useElementResize";
import { useArrowCreation } from "./useArrowCreation";
import type { CanvasAction, ToolType, CanvasState } from "./useCanvasReducer";
import type { EditingTarget } from "./InlineTextEditor";

// ── Default element sizes ──
const DEFAULT_RECT_SIZE = { width: 150, height: 80 };
const DEFAULT_CIRCLE_RADIUS = 50;
const DEFAULT_CYLINDER_SIZE = { width: 100, height: 120 };
const DEFAULT_ICON_SIZE = { width: 150, height: 80 };
/** Default opaque iconId for icons placed via the built-in toolbar tool. */
const DEFAULT_ICON_ID = "custom";

/** Handle half-size in canvas-space pixels */
const HANDLE_SIZE = 5;

/**
 * What the current pointer interaction is.
 */
type InteractionMode =
  | "none"
  | "panning"
  | "dragging"
  | "resizing"
  | "creating"; // click-drag to define size

interface CreationState {
  type: "rectangle" | "circle" | "cylinder" | "icon";
  startPoint: { x: number; y: number };
  elementId: string;
  seed: number;
}

/**
 * Top-level hook that composes all canvas interactions:
 * - Pan/zoom
 * - Element creation (click or click-drag)
 * - Text tool creation + inline editing
 * - Selection (click, shift-click)
 * - Dragging elements
 * - Resizing via handles
 * - Arrow creation (two-click)
 * - Deletion (Delete/Backspace)
 * - Double-click to edit text on any text/shape element
 */
export function useCanvasInteraction(
  state: CanvasState,
  dispatch: React.Dispatch<CanvasAction>,
  svgRef: React.RefObject<SVGSVGElement | null>,
  containerSize: { width: number; height: number },
) {
  const { document: doc, selectedIds, tool } = state;
  const elements = doc.elements;
  const viewport = doc.viewport;

  // Sub-hooks
  const { startDrag, continueDrag, endDrag, isDragging } = useElementDrag(
    elements,
    dispatch,
  );
  const { startResize, continueResize, endResize, isResizing } =
    useElementResize(elements, dispatch);
  const {
    arrowStart,
    previewEnd,
    handleArrowClick,
    handleArrowPointClick,
    updatePreview,
    cancelArrow,
  } = useArrowCreation(elements, dispatch);

  // Hovered connection point while arrow tool is active
  const [hoveredConnectionPoint, setHoveredConnectionPoint] =
    useState<ConnectionPointHit | null>(null);

  useEffect(() => {
    if (tool !== "arrow") {
      setHoveredConnectionPoint(null);
    }
  }, [tool]);

  // Interaction mode
  const [mode, setMode] = useState<InteractionMode>("none");

  // Pan state
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [panViewportStart, setPanViewportStart] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Space key for space+click panning
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Creation drag state
  const creationRef = useRef<CreationState | null>(null);

  // ── Text editing state ──
  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>(
    null,
  );

  // ── Keyboard events ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't process keyboard shortcuts while editing text
      if (editingTarget) return;

      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
      }
      if (
        (e.code === "Delete" || e.code === "Backspace") &&
        selectedIds.size > 0
      ) {
        e.preventDefault();
        handleDelete();
      }
      if (e.code === "Escape") {
        cancelArrow();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceHeld(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedIds, elements, editingTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Delete handler ──
  const handleDelete = useCallback(() => {
    const idsToDelete = new Set(selectedIds);

    // Cascade: find arrows bound to deleted elements
    for (const el of elements) {
      if (el.type !== "arrow") continue;
      if (
        (el.startBinding && idsToDelete.has(el.startBinding)) ||
        (el.endBinding && idsToDelete.has(el.endBinding))
      ) {
        idsToDelete.add(el.id);
      }
    }

    dispatch({ type: "DELETE_ELEMENTS", ids: Array.from(idsToDelete) });
  }, [selectedIds, elements, dispatch]);

  // ── Canvas-space point from pointer event ──
  const getCanvasPoint = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      return screenToCanvas(
        e.clientX - rect.left,
        e.clientY - rect.top,
        viewport,
        containerSize,
      );
    },
    [svgRef, viewport, containerSize],
  );

  // ── Open inline text editor for an element ──
  const openTextEditor = useCallback((element: DiagramElement) => {
    if (element.type === "text") {
      const bounds = getElementBounds(element);
      setEditingTarget({
        elementId: element.id,
        kind: "standalone-text",
        text: element.text,
        x: element.x,
        y: element.y,
        width: Math.max(bounds.width, 100),
        height: Math.max(bounds.height, 24),
        fontSize: element.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
      });
    } else if (
      element.type === "rectangle" ||
      element.type === "circle" ||
      element.type === "cylinder" ||
      element.type === "icon"
    ) {
      const bounds = getElementBounds(element);
      const currentText = "text" in element && element.text ? element.text : "";
      setEditingTarget({
        elementId: element.id,
        kind: "shape-label",
        text: currentText,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        fontSize: element.fontSize ?? DEFAULT_SHAPE_LABEL_FONT_SIZE,
      });
    }
  }, []);

  // ── Commit text editing ──
  const commitTextEditing = useCallback(
    (elementId: string, text: string, kind: EditingTarget["kind"]) => {
      const trimmedText = text.trim();

      if (kind === "standalone-text") {
        if (trimmedText === "") {
          // Empty standalone text → delete the element
          dispatch({ type: "DELETE_ELEMENTS", ids: [elementId] });
        } else {
          dispatch({
            type: "UPDATE_ELEMENT",
            id: elementId,
            patch: { text: trimmedText },
          });
        }
      } else {
        // shape-label: update the text field (empty string clears it)
        dispatch({
          type: "UPDATE_ELEMENT",
          id: elementId,
          patch: { text: trimmedText || undefined },
        });
      }

      setEditingTarget(null);
    },
    [dispatch],
  );

  // ── Cancel text editing ──
  const cancelTextEditing = useCallback(() => {
    setEditingTarget(null);
  }, []);

  // ── Pointer down on a connection point (arrow tool) ──
  const handleConnectionPointPointerDown = useCallback(
    (e: React.PointerEvent, elementId: string, point: { x: number; y: number }) => {
      if (editingTarget || tool !== "arrow") return;

      e.preventDefault();
      e.stopPropagation();
      handleArrowPointClick(point, elementId);
    },
    [editingTarget, tool, handleArrowPointClick],
  );

  // ── Pointer down on a visible resize handle (rendered above the canvas hit layer) ──
  const handleResizeHandlePointerDown = useCallback(
    (e: React.PointerEvent, handle: HandlePosition) => {
      if (editingTarget) return;
      if (tool !== "select" || selectedIds.size !== 1) return;

      const selectedId = Array.from(selectedIds)[0];
      const selectedEl = elements.find((el) => el.id === selectedId);
      if (!selectedEl || selectedEl.type === "arrow") return;

      const svg = svgRef.current;
      if (!svg) return;

      e.preventDefault();
      e.stopPropagation();

      const canvasPoint = getCanvasPoint(e);
      setMode("resizing");
      startResize(selectedId, handle, canvasPoint);
      svg.setPointerCapture(e.pointerId);
    },
    [
      editingTarget,
      tool,
      selectedIds,
      elements,
      svgRef,
      getCanvasPoint,
      startResize,
    ],
  );

  // ── Pointer down on SVG ──
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // If currently editing text, ignore pointer events on canvas
      // (the editor handles its own events)
      if (editingTarget) return;

      const svg = svgRef.current;
      if (!svg) return;
      const canvasPoint = getCanvasPoint(e);

      // Middle-click or space+left-click → pan
      const shouldPan = e.button === 1 || (e.button === 0 && spaceHeld);
      if (shouldPan) {
        e.preventDefault();
        setMode("panning");
        setPanStart({ x: e.clientX, y: e.clientY });
        setPanViewportStart({ x: viewport.x, y: viewport.y });
        svg.setPointerCapture(e.pointerId);
        return;
      }

      if (e.button !== 0) return; // only left-click below

      // Arrow tool
      if (tool === "arrow") {
        const snapThreshold = HANDLE_SIZE / viewport.zoom;
        handleArrowClick(canvasPoint, snapThreshold);
        return;
      }

      // Text tool: clicking directly on an existing element inserts/edits
      // text within that element (its "parent") in place, rather than
      // stacking an unrelated standalone text element on top of it.
      if (tool === "text") {
        e.preventDefault();

        const hitElement = hitTest(canvasPoint, elements);
        if (hitElement && hitElement.type !== "arrow") {
          dispatch({ type: "SET_TOOL", tool: "select" });
          dispatch({ type: "SET_SELECTION", ids: [hitElement.id] });
          openTextEditor(hitElement);
          return;
        }

        // Empty canvas: create a new standalone text element
        // todo [medium]: not working atm.
        const elementId = crypto.randomUUID();
        const seed = generateSeed();
        const fontSize = DEFAULT_TEXT_FONT_SIZE;

        const element: TextElement = {
          id: elementId,
          type: "text",
          seed,
          x: canvasPoint.x,
          y: canvasPoint.y,
          text: "",
          fontSize,
        };

        dispatch({ type: "ADD_ELEMENT", element });
        dispatch({ type: "SET_TOOL", tool: "select" });
        dispatch({ type: "SET_SELECTION", ids: [elementId] });

        // Open inline editor immediately for the new text element
        setEditingTarget({
          elementId,
          kind: "standalone-text",
          text: "",
          x: canvasPoint.x,
          y: canvasPoint.y,
          width: 150,
          height: fontSize * 1.2 + 4,
          fontSize,
        });
        return;
      }

      // Creation tools: rectangle, circle, cylinder, icon
      if (
        tool === "rectangle" ||
        tool === "circle" ||
        tool === "cylinder" ||
        tool === "icon"
      ) {
        e.preventDefault();
        const elementId = crypto.randomUUID();
        const seed = generateSeed();

        let element: DiagramElement;
        if (tool === "rectangle") {
          element = {
            id: elementId,
            type: "rectangle",
            seed,
            x: canvasPoint.x,
            y: canvasPoint.y,
            width: DEFAULT_RECT_SIZE.width,
            height: DEFAULT_RECT_SIZE.height,
          } satisfies RectangleElement;
        } else if (tool === "circle") {
          element = {
            id: elementId,
            type: "circle",
            seed,
            cx: canvasPoint.x,
            cy: canvasPoint.y,
            radius: DEFAULT_CIRCLE_RADIUS,
          } satisfies CircleElement;
        } else if (tool === "cylinder") {
          element = {
            id: elementId,
            type: "cylinder",
            seed,
            x: canvasPoint.x,
            y: canvasPoint.y,
            width: DEFAULT_CYLINDER_SIZE.width,
            height: DEFAULT_CYLINDER_SIZE.height,
          } satisfies CylinderElement;
        } else {
          element = {
            id: elementId,
            type: "icon",
            seed,
            iconId: DEFAULT_ICON_ID,
            x: canvasPoint.x,
            y: canvasPoint.y,
            width: DEFAULT_ICON_SIZE.width,
            height: DEFAULT_ICON_SIZE.height,
          } satisfies IconElement;
        }

        // Start creation drag
        creationRef.current = {
          type: tool,
          startPoint: canvasPoint,
          elementId,
          seed,
        };
        setMode("creating");
        dispatch({ type: "ADD_ELEMENT", element });
        dispatch({ type: "SET_TOOL", tool: "select" });
        dispatch({ type: "SET_SELECTION", ids: [elementId] });
        svg.setPointerCapture(e.pointerId);
        return;
      }

      // Select tool interactions
      if (tool === "select") {
        // Check if pointer is on a resize handle of a selected element
        if (selectedIds.size === 1) {
          const selectedId = Array.from(selectedIds)[0];
          const selectedEl = elements.find((el) => el.id === selectedId);
          if (selectedEl && selectedEl.type !== "arrow") {
            const bounds = getElementBounds(selectedEl);
            // Adjust handle size based on zoom
            const handleSizeCanvas = HANDLE_SIZE / viewport.zoom;
            const handle = hitTestResizeHandle(
              canvasPoint,
              bounds,
              handleSizeCanvas,
            );
            if (handle) {
              e.preventDefault();
              setMode("resizing");
              startResize(selectedId, handle, canvasPoint);
              svg.setPointerCapture(e.pointerId);
              return;
            }
          }
        }

        // Hit test elements
        const hitElement = hitTest(canvasPoint, elements);

        if (hitElement) {
          e.stopPropagation();

          if (e.shiftKey) {
            // Toggle selection
            const next = new Set(selectedIds);
            if (next.has(hitElement.id)) {
              next.delete(hitElement.id);
            } else {
              next.add(hitElement.id);
            }
            dispatch({
              type: "SET_SELECTION",
              ids: Array.from(next),
            });
          } else {
            // If not already selected, select it
            if (!selectedIds.has(hitElement.id)) {
              dispatch({
                type: "SET_SELECTION",
                ids: [hitElement.id],
              });
            }
          }

          // Start drag for the selected elements
          const dragIds = selectedIds.has(hitElement.id)
            ? Array.from(selectedIds)
            : [hitElement.id];
          setMode("dragging");
          startDrag(dragIds, canvasPoint);
          svg.setPointerCapture(e.pointerId);
        } else {
          // Clicked empty canvas → clear selection and start panning
          dispatch({ type: "CLEAR_SELECTION" });
          setMode("panning");
          setPanStart({ x: e.clientX, y: e.clientY });
          setPanViewportStart({ x: viewport.x, y: viewport.y });
          svg.setPointerCapture(e.pointerId);
        }
      }
    },
    [
      svgRef,
      getCanvasPoint,
      spaceHeld,
      viewport,
      tool,
      selectedIds,
      elements,
      dispatch,
      handleArrowClick,
      startDrag,
      startResize,
      editingTarget,
      openTextEditor,
    ],
  );

  // ── Double-click on SVG → open text editor ──
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (editingTarget) return;
      if (e.button !== 0) return;

      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const canvasPoint = screenToCanvas(
        e.clientX - rect.left,
        e.clientY - rect.top,
        viewport,
        containerSize,
      );

      const hitElement = hitTest(canvasPoint, elements);
      if (!hitElement) return;

      // Only open editor for text elements and shapes (not arrows)
      if (hitElement.type === "arrow") return;

      e.preventDefault();
      e.stopPropagation();

      // Select the element
      dispatch({ type: "SET_SELECTION", ids: [hitElement.id] });

      // Open the text editor
      openTextEditor(hitElement);
    },
    [
      svgRef,
      viewport,
      containerSize,
      elements,
      dispatch,
      openTextEditor,
      editingTarget,
    ],
  );

  // ── Pointer move on SVG ──
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const canvasPoint = getCanvasPoint(e);

      if (mode === "panning" && panStart && panViewportStart) {
        const dx = (e.clientX - panStart.x) / viewport.zoom;
        const dy = (e.clientY - panStart.y) / viewport.zoom;
        dispatch({
          type: "SET_VIEWPORT",
          viewport: {
            ...viewport,
            x: panViewportStart.x - dx,
            y: panViewportStart.y - dy,
          },
        });
        return;
      }

      if (mode === "dragging") {
        continueDrag(canvasPoint);
        return;
      }

      if (mode === "resizing") {
        continueResize(canvasPoint);
        return;
      }

      if (mode === "creating" && creationRef.current) {
        const creation = creationRef.current;
        const dx = canvasPoint.x - creation.startPoint.x;
        const dy = canvasPoint.y - creation.startPoint.y;

        // Update element size based on drag
        let patch: Partial<DiagramElement> = {};
        if (
          creation.type === "rectangle" ||
          creation.type === "cylinder" ||
          creation.type === "icon"
        ) {
          const x = dx >= 0 ? creation.startPoint.x : canvasPoint.x;
          const y = dy >= 0 ? creation.startPoint.y : canvasPoint.y;
          const width = Math.max(20, Math.abs(dx));
          const height = Math.max(20, Math.abs(dy));
          patch = { x, y, width, height };
        } else if (creation.type === "circle") {
          const radius = Math.max(10, Math.sqrt(dx * dx + dy * dy));
          patch = {
            cx: creation.startPoint.x,
            cy: creation.startPoint.y,
            radius,
          };
        }

        dispatch({
          type: "UPDATE_ELEMENT",
          id: creation.elementId,
          patch,
        });
        return;
      }

      // Arrow tool: track hovered connection point and preview snap
      if (tool === "arrow") {
        const snapThreshold = HANDLE_SIZE / viewport.zoom;
        setHoveredConnectionPoint(
          hitTestConnectionPoint(canvasPoint, elements, snapThreshold),
        );
        if (arrowStart) {
          updatePreview(canvasPoint, snapThreshold);
        }
        return;
      }
    },
    [
      getCanvasPoint,
      mode,
      panStart,
      panViewportStart,
      viewport,
      dispatch,
      continueDrag,
      continueResize,
      tool,
      arrowStart,
      updatePreview,
      elements,
    ],
  );

  // ── Pointer up on SVG ──
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;

      if (mode === "panning") {
        setMode("none");
        setPanStart(null);
        setPanViewportStart(null);
        svg.releasePointerCapture(e.pointerId);
        return;
      }

      if (mode === "dragging") {
        endDrag();
        setMode("none");
        svg.releasePointerCapture(e.pointerId);
        return;
      }

      if (mode === "resizing") {
        endResize();
        setMode("none");
        svg.releasePointerCapture(e.pointerId);
        return;
      }

      if (mode === "creating") {
        creationRef.current = null;
        setMode("none");
        svg.releasePointerCapture(e.pointerId);
        return;
      }
    },
    [svgRef, mode, endDrag, endResize],
  );

  // ── Cursor ──
  const getCursor = useCallback(() => {
    if (editingTarget) return "text";
    if (mode === "panning") return "grabbing";
    if (mode === "resizing") return "nwse-resize";
    if (mode === "dragging") return "move";
    if (spaceHeld) return "grab";
    if (tool === "select") return "default";
    return "crosshair";
  }, [mode, spaceHeld, tool, editingTarget]);

  return {
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
    handleSize: HANDLE_SIZE,
    // Text editing
    editingTarget,
    commitTextEditing,
    cancelTextEditing,
  };
}
