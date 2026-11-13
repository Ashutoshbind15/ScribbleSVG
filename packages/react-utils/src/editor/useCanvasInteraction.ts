import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_SHAPE_LABEL_FONT_SIZE,
  DEFAULT_TEXT_FONT_SIZE,
  generateSeed,
  getElementBounds,
  isConnector,
  isLabeledShape,
  type Bounds,
  type CircleElement,
  type CylinderElement,
  type DiagramDocument,
  type DiagramElement,
  type DiamondElement,
  type IconElement,
  type RectangleElement,
  type TextElement,
  type Viewport,
} from "@scribblesvg/core";
import { screenToCanvas } from "./coordinate-utils";
import {
  boundsFromPoints,
  CORNER_HANDLES,
  getGroupSelectionBounds,
  HANDLE_CURSORS,
  hitTestGroupSelection,
  hitTestSelection,
  hitTestTextTarget,
  hitTestResizeHandle,
  hitTestConnectionPoint,
  resolveMarqueeSelection,
} from "./hit-test";
import type { HandlePosition, ConnectionPointHit } from "./hit-test";
import { useElementDrag } from "./useElementDrag";
import { useElementResize } from "./useElementResize";
import { useArrowCreation } from "./useArrowCreation";
import type { CanvasAction, ToolType, CanvasState } from "./useCanvasReducer";
import type { EditingTarget } from "./InlineTextEditor";
import { measureDomTextSize } from "./measureDomText";
import { stepFontSize } from "./text-size";
import { resolveDiagramIcon, type DiagramIcon } from "../icons";
import {
  cloneElementsForPaste,
  collectCopyElements,
  getEditorClipboard,
  readSystemClipboard,
  setEditorClipboard,
  writeSystemClipboard,
} from "./clipboard";

// ── Default element sizes ──
const DEFAULT_RECT_SIZE = { width: 150, height: 80 };
const DEFAULT_CIRCLE_RADIUS = 50;
const DEFAULT_CYLINDER_SIZE = { width: 100, height: 120 };
const DEFAULT_DIAMOND_SIZE = { width: 120, height: 120 };
const DEFAULT_ICON_SIZE = { width: 150, height: 80 };

/** Handle half-size in canvas-space pixels */
const HANDLE_SIZE = 5;

/** Screen-space pointer travel below which a press-release counts as a click. */
const CLICK_SLOP_PX = 3;

/** Current value of the inline editor's textarea (state lags keystrokes). */
function readLiveEditorText(fallback: string): string {
  const textarea = document.querySelector(
    ".scribblesvg-editor__viewport textarea",
  );
  return textarea instanceof HTMLTextAreaElement ? textarea.value : fallback;
}

function isConnectorTool(tool: ToolType): tool is "arrow" | "line" {
  return tool === "arrow" || tool === "line";
}

type Point = { x: number; y: number };
type ShapeTool = "rectangle" | "circle" | "cylinder" | "diamond";

/** A new shape at its default size, placed at `point`. */
function createShapeElement(
  tool: ShapeTool,
  point: Point,
  id: string,
  seed: number,
): DiagramElement {
  const box = { id, seed, x: point.x, y: point.y };
  switch (tool) {
    case "rectangle":
      return { ...box, type: "rectangle", ...DEFAULT_RECT_SIZE } satisfies RectangleElement;
    case "diamond":
      return { ...box, type: "diamond", ...DEFAULT_DIAMOND_SIZE } satisfies DiamondElement;
    case "cylinder":
      return { ...box, type: "cylinder", ...DEFAULT_CYLINDER_SIZE } satisfies CylinderElement;
    case "circle":
      return {
        id,
        seed,
        type: "circle",
        cx: point.x,
        cy: point.y,
        radius: DEFAULT_CIRCLE_RADIUS,
      } satisfies CircleElement;
  }
}

/** A new icon at its catalog size (or the default), placed at `point`. */
function createIconElement(
  icons: DiagramIcon[] | undefined,
  iconId: string,
  point: Point,
  id: string,
  seed: number,
): IconElement {
  const icon = resolveDiagramIcon(icons, iconId);
  return {
    id,
    type: "icon",
    seed,
    iconId,
    x: point.x,
    y: point.y,
    width: icon?.defaultWidth ?? DEFAULT_ICON_SIZE.width,
    height: icon?.defaultHeight ?? DEFAULT_ICON_SIZE.height,
  };
}

/** Size patch for an element being click-dragged out from `creation.startPoint`. */
function creationPatch(creation: CreationState, point: Point): Partial<DiagramElement> {
  const start = creation.startPoint;
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  if (creation.type === "circle") {
    return { cx: start.x, cy: start.y, radius: Math.max(10, Math.hypot(dx, dy)) };
  }
  return {
    x: Math.min(start.x, point.x),
    y: Math.min(start.y, point.y),
    width: Math.max(20, Math.abs(dx)),
    height: Math.max(20, Math.abs(dy)),
  };
}

/**
 * The resize handle under `point` for the current selection: the corner
 * handles of a multi-selection's group box, or a single element's box handles.
 * Connectors and standalone text (which has its own size grip) have none.
 */
function hitTestSelectionHandle(
  point: Point,
  elements: DiagramElement[],
  selectedIds: Set<string>,
  zoom: number,
): HandlePosition | null {
  const handleSize = HANDLE_SIZE / zoom;
  if (selectedIds.size > 1) {
    const groupBounds = getGroupSelectionBounds(elements, selectedIds);
    return groupBounds && hitTestResizeHandle(point, groupBounds, handleSize, CORNER_HANDLES);
  }
  const [selectedId] = selectedIds;
  const selected = elements.find((el) => el.id === selectedId);
  const hasBoxHandles = selected && !isConnector(selected) && selected.type !== "text";
  return hasBoxHandles
    ? hitTestResizeHandle(point, getElementBounds(selected), handleSize)
    : null;
}

/**
 * What the current pointer interaction is.
 */
type InteractionMode =
  | "none"
  | "panning"
  | "dragging"
  | "resizing"
  | "creating" // click-drag to define size
  | "marqueeing"; // drag a virtual rect to multi-select

interface CreationState {
  type: "rectangle" | "circle" | "cylinder" | "diamond" | "icon";
  startPoint: { x: number; y: number };
  elementId: string;
  seed: number;
}

interface MarqueeState {
  startPoint: { x: number; y: number };
  currentPoint: { x: number; y: number };
  /** Screen coords at pointer-down — used to distinguish click vs drag. */
  screenStart: { x: number; y: number };
  /** Shift held at start → union with existing selection on release. */
  additive: boolean;
}

/**
 * Top-level hook that composes all canvas interactions:
 * - Pan/zoom
 * - Element creation (click or click-drag)
 * - Text tool creation + inline editing
 * - Selection (click, shift-click, marquee/box-select)
 * - Dragging elements
 * - Resizing via handles
 * - Arrow creation (two-click)
 * - Deletion (Delete/Backspace)
 * - Copy / cut / paste (Ctrl/Cmd+C/X/V)
 * - Undo / redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y)
 * - Click a selected element again to edit its text; double-click adds free text
 */
export function useCanvasInteraction(
  state: CanvasState,
  dispatch: React.Dispatch<CanvasAction>,
  svgRef: React.RefObject<SVGSVGElement | null>,
  containerSize: { width: number; height: number },
  icons?: DiagramIcon[],
) {
  const { document: doc, selectedIds, tool, activeIconId } = state;
  const elements = doc.elements;
  const viewport = doc.viewport;

  // Sub-hooks
  const { startDrag, continueDrag, endDrag, isDragging } = useElementDrag(
    elements,
    dispatch,
  );
  const {
    startResize,
    startGroupScale,
    continueResize,
    endResize,
    isResizing,
  } = useElementResize(elements, dispatch);
  const {
    arrowStart,
    previewEnd,
    previewStart,
    handleArrowClick,
    updatePreview,
    cancelArrow,
  } = useArrowCreation(elements, dispatch);

  // Hovered connection point while a connector tool is active
  const [hoveredConnectionPoint, setHoveredConnectionPoint] =
    useState<ConnectionPointHit | null>(null);

  // Last cursor position while a connector tool is active — lets Shift
  // keydown/keyup re-snap the preview without waiting for pointer movement.
  const lastConnectorPointRef = useRef<{ x: number; y: number } | null>(null);

  const updateConnectorPreviewForShift = useCallback(
    (constrain: boolean) => {
      if (!arrowStart || !isConnectorTool(tool)) return;
      const point = lastConnectorPointRef.current;
      if (!point) return;
      updatePreview(tool, point, HANDLE_SIZE / viewport.zoom, constrain);
    },
    [arrowStart, tool, viewport.zoom, updatePreview],
  );

  useEffect(() => {
    if (!isConnectorTool(tool)) {
      setHoveredConnectionPoint(null);
      cancelArrow();
    }
  }, [tool]); // eslint-disable-line react-hooks/exhaustive-deps

  // Interaction mode
  const [mode, setMode] = useState<InteractionMode>("none");
  // Handle held during "resizing", for the cursor
  const [resizeHandle, setResizeHandle] = useState<HandlePosition>("se");

  // Select tool: whether the pointer is over something a click would pick up
  const [hoveringSelectable, setHoveringSelectable] = useState(false);

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

  // Marquee (box) selection state
  const marqueeRef = useRef<MarqueeState | null>(null);
  const [marqueeBounds, setMarqueeBounds] = useState<Bounds | null>(null);

  // ── Text editing state ──
  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>(
    null,
  );
  /** Live editing target; cleared on commit so a late blur can't commit twice. */
  const editingTargetRef = useRef(editingTarget);
  editingTargetRef.current = editingTarget;

  /**
   * Set when the press lands on the already sole-selected element; if it is
   * released without dragging, that click opens the element's text editor.
   */
  const pendingEditRef = useRef<{
    elementId: string;
    screenStart: { x: number; y: number };
  } | null>(null);

  /** True while a new standalone text element's create+edit is one undo group. */
  const textHistoryOpenRef = useRef(false);

  const endTextHistoryGroup = useCallback(() => {
    if (!textHistoryOpenRef.current) return;
    textHistoryOpenRef.current = false;
    dispatch({ type: "END_HISTORY" });
  }, [dispatch]);

  // ── Delete handler ──
  const handleDelete = useCallback(() => {
    const idsToDelete = new Set(selectedIds);

    // Cascade: find connectors bound to deleted elements
    for (const el of elements) {
      if (!isConnector(el)) continue;
      if (
        (el.startBinding && idsToDelete.has(el.startBinding)) ||
        (el.endBinding && idsToDelete.has(el.endBinding))
      ) {
        idsToDelete.add(el.id);
      }
    }

    dispatch({ type: "DELETE_ELEMENTS", ids: Array.from(idsToDelete) });
  }, [selectedIds, elements, dispatch]);

  // ── Clipboard ──
  const handleCopy = useCallback(() => {
    const copied = collectCopyElements(elements, selectedIds);
    if (copied.length === 0) return false;
    setEditorClipboard(copied);
    writeSystemClipboard(copied);
    return true;
  }, [elements, selectedIds]);

  const handleCut = useCallback(() => {
    if (!handleCopy()) return;
    handleDelete();
  }, [handleCopy, handleDelete]);

  const pasteElements = useCallback(
    (source: DiagramElement[]) => {
      if (source.length === 0) return;
      const pasted = cloneElementsForPaste(source);
      dispatch({ type: "ADD_ELEMENTS", elements: pasted, select: true });
      // Next paste steps further from the last paste, not the original copy.
      setEditorClipboard(pasted);
      writeSystemClipboard(pasted);
    },
    [dispatch],
  );

  const handlePaste = useCallback(async () => {
    const local = getEditorClipboard();
    if (local && local.length > 0) {
      pasteElements(local);
      return;
    }

    const fromSystem = await readSystemClipboard();
    if (fromSystem && fromSystem.length > 0) {
      setEditorClipboard(fromSystem);
      pasteElements(fromSystem);
    }
  }, [pasteElements]);

  // ── Step the font size of every selected text / labeled shape ──
  const stepSelectionFontSize = useCallback(
    (direction: 1 | -1) => {
      const updates: { id: string; patch: Partial<DiagramElement> }[] = [];
      for (const el of elements) {
        if (!selectedIds.has(el.id)) continue;
        if (el.type === "text") {
          const fontSize = stepFontSize(
            el.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
            direction,
          );
          const size = measureDomTextSize(el.text, fontSize);
          updates.push({
            id: el.id,
            patch: { fontSize, width: size.width, height: size.height },
          });
        } else if (isLabeledShape(el) && el.text) {
          updates.push({
            id: el.id,
            patch: {
              fontSize: stepFontSize(
                el.fontSize ?? DEFAULT_SHAPE_LABEL_FONT_SIZE,
                direction,
              ),
            },
          });
        }
      }
      dispatch({ type: "UPDATE_ELEMENTS", updates });
    },
    [elements, selectedIds, dispatch],
  );

  // ── Keyboard events ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't process keyboard shortcuts while editing text
      if (editingTarget) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Shift" && !e.repeat) {
        updateConnectorPreviewForShift(true);
      }
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
        // Clear marquee preview; pointer-up still ends the gesture / releases capture.
        if (marqueeRef.current) {
          marqueeRef.current = null;
          setMarqueeBounds(null);
        }
      }

      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.altKey) return;

      // Ctrl/Cmd+Shift+< / > — by code so the shifted glyph doesn't matter
      if (e.shiftKey && (e.code === "Period" || e.code === "Comma")) {
        e.preventDefault();
        stepSelectionFontSize(e.code === "Period" ? 1 : -1);
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "REDO" : "UNDO" });
      } else if (key === "y" && !e.metaKey) {
        // Ctrl+Y redo (Windows/Linux); skip on macOS where Cmd+Y is unused here
        e.preventDefault();
        dispatch({ type: "REDO" });
      } else if (key === "c") {
        if (handleCopy()) e.preventDefault();
      } else if (key === "x") {
        if (selectedIds.size > 0) {
          e.preventDefault();
          handleCut();
        }
      } else if (key === "v") {
        e.preventDefault();
        void handlePaste();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        updateConnectorPreviewForShift(false);
      }
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
  }, [
    selectedIds,
    editingTarget,
    dispatch,
    handleDelete,
    handleCopy,
    handleCut,
    handlePaste,
    cancelArrow,
    updateConnectorPreviewForShift,
    stepSelectionFontSize,
  ]);

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
      const fontSize = element.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
      const size = measureDomTextSize(element.text, fontSize);
      setEditingTarget({
        elementId: element.id,
        kind: "standalone-text",
        text: element.text,
        x: element.x,
        y: element.y,
        width: Math.max(size.width + 8, 60),
        height: Math.max(size.height + 8, 24),
        fontSize,
      });
    } else if (
      element.type === "rectangle" ||
      element.type === "circle" ||
      element.type === "cylinder" ||
      element.type === "diamond" ||
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

  // ── Create an empty standalone text element and start editing it ──
  const createTextAt = useCallback(
    (point: { x: number; y: number }) => {
      const elementId = crypto.randomUUID();
      const fontSize = DEFAULT_TEXT_FONT_SIZE;

      const element: TextElement = {
        id: elementId,
        type: "text",
        seed: generateSeed(),
        x: point.x,
        y: point.y,
        text: "",
        fontSize,
      };

      dispatch({ type: "BEGIN_HISTORY" });
      textHistoryOpenRef.current = true;
      dispatch({ type: "ADD_ELEMENT", element });
      dispatch({ type: "SET_TOOL", tool: "select" });
      dispatch({ type: "SET_SELECTION", ids: [elementId] });

      // Open inline editor immediately; box grows with typed content.
      const size = measureDomTextSize("", fontSize);
      setEditingTarget({
        elementId,
        kind: "standalone-text",
        text: "",
        x: point.x,
        y: point.y,
        width: Math.max(size.width + 8, 60),
        height: Math.max(size.height + 8, 24),
        fontSize,
      });
    },
    [dispatch],
  );

  // ── Commit text editing ──
  const commitTextEditing = useCallback(
    (elementId: string, text: string, kind: EditingTarget["kind"]) => {
      if (editingTargetRef.current?.elementId !== elementId) return;
      editingTargetRef.current = null;
      const trimmedText = text.trim();

      if (kind === "standalone-text") {
        if (trimmedText === "") {
          // Empty standalone text → delete the element
          dispatch({ type: "DELETE_ELEMENTS", ids: [elementId] });
        } else {
          const existing = elements.find((el) => el.id === elementId);
          const fontSize =
            existing && existing.type === "text"
              ? (existing.fontSize ?? DEFAULT_TEXT_FONT_SIZE)
              : DEFAULT_TEXT_FONT_SIZE;
          const size = measureDomTextSize(trimmedText, fontSize);
          dispatch({
            type: "UPDATE_ELEMENT",
            id: elementId,
            patch: {
              text: trimmedText,
              width: size.width,
              height: size.height,
            },
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

      endTextHistoryGroup();
      setEditingTarget(null);
    },
    [dispatch, endTextHistoryGroup, elements],
  );

  // ── Cancel text editing ──
  const cancelTextEditing = useCallback(() => {
    editingTargetRef.current = null;
    endTextHistoryGroup();
    setEditingTarget(null);
  }, [endTextHistoryGroup]);

  /**
   * Grow the standalone text editor box while typing / after font changes.
   * Element width/height are written on commit (and on font-size when not
   * editing) so keystrokes don't flood undo history.
   */
  const updateEditingLayout = useCallback(
    (layout: { width: number; height: number; text: string }) => {
      setEditingTarget((current) => {
        if (!current || current.kind !== "standalone-text") return current;
        if (
          current.width === layout.width &&
          current.height === layout.height &&
          current.text === layout.text
        ) {
          return current;
        }
        return {
          ...current,
          text: layout.text,
          width: layout.width,
          height: layout.height,
        };
      });
    },
    [],
  );

  /** Track live text so the size grip hugs the glyphs and knows about typing. */
  const updateEditingText = useCallback((text: string) => {
    setEditingTarget((current) =>
      current && current.text !== text
        ? { ...current, text }
        : current,
    );
  }, []);

  /**
   * Apply a font-size change while inline-editing. Layout is re-measured by
   * InlineTextEditor after the new font size is applied.
   */
  const changeEditingFontSize = useCallback(
    (fontSize: number) => {
      if (!editingTarget) return;

      const liveText = readLiveEditorText(editingTarget.text);
      const size =
        editingTarget.kind === "standalone-text"
          ? measureDomTextSize(liveText, fontSize)
          : null;

      dispatch({
        type: "UPDATE_ELEMENT",
        id: editingTarget.elementId,
        patch: size
          ? {
              fontSize,
              width: size.width,
              height: size.height,
            }
          : { fontSize },
      });
      setEditingTarget({
        ...editingTarget,
        text: liveText,
        fontSize,
        ...(size
          ? {
              width: Math.max(size.width + 8, 60),
              height: Math.max(size.height + 8, 24),
            }
          : {}),
      });
    },
    [editingTarget, dispatch],
  );

  /** Ctrl/Cmd+Shift+< / > while inline-editing. */
  const stepEditingFontSize = useCallback(
    (direction: 1 | -1) => {
      if (!editingTarget) return;
      changeEditingFontSize(stepFontSize(editingTarget.fontSize, direction));
    },
    [editingTarget, changeEditingFontSize],
  );

  // ── Pointer down on a connection point (connector tool) ──
  const handleConnectionPointPointerDown = useCallback(
    (e: React.PointerEvent, elementId: string, point: { x: number; y: number }) => {
      if (editingTarget || !isConnectorTool(tool)) return;

      e.preventDefault();
      e.stopPropagation();
      handleArrowClick(tool, getCanvasPoint(e), undefined, e.shiftKey, {
        point,
        elementId,
      });
    },
    [editingTarget, tool, handleArrowClick, getCanvasPoint],
  );

  // ── Pointer down on a visible resize handle (rendered above the canvas hit layer) ──
  const handleResizeHandlePointerDown = useCallback(
    (e: React.PointerEvent, handle: HandlePosition) => {
      if (editingTarget || tool !== "select") return;

      const svg = svgRef.current;
      if (!svg) return;

      // Multi-selection: corner handles scale the whole group
      if (selectedIds.size > 1) {
        e.preventDefault();
        e.stopPropagation();
        if (startGroupScale(selectedIds, handle, getCanvasPoint(e))) {
          setMode("resizing");
          setResizeHandle(handle);
          svg.setPointerCapture(e.pointerId);
        }
        return;
      }
      if (selectedIds.size !== 1) return;

      const selectedId = Array.from(selectedIds)[0];
      const selectedEl = elements.find((el) => el.id === selectedId);
      if (!selectedEl || isConnector(selectedEl)) return;

      e.preventDefault();
      e.stopPropagation();

      const canvasPoint = getCanvasPoint(e);
      setMode("resizing");
      setResizeHandle(handle);
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
      startGroupScale,
    ],
  );

  /** Adds `element` and lets the user click-drag out its size. */
  const beginCreation = useCallback(
    (
      e: React.PointerEvent<SVGSVGElement>,
      svg: SVGSVGElement,
      type: CreationState["type"],
      element: DiagramElement,
      point: Point,
    ) => {
      e.preventDefault();
      creationRef.current = {
        type,
        startPoint: point,
        elementId: element.id,
        seed: element.seed,
      };
      setMode("creating");
      dispatch({ type: "BEGIN_HISTORY" });
      dispatch({ type: "ADD_ELEMENT", element });
      dispatch({ type: "SET_TOOL", tool: "select" });
      dispatch({ type: "SET_SELECTION", ids: [element.id] });
      svg.setPointerCapture(e.pointerId);
    },
    [dispatch],
  );

  /** Starts resizing the selection from `handle`; false if it can't be resized. */
  const startSelectionResize = useCallback(
    (handle: HandlePosition, point: Point) => {
      if (selectedIds.size > 1) return startGroupScale(selectedIds, handle, point);
      const [selectedId] = selectedIds;
      startResize(selectedId, handle, point);
      return true;
    },
    [selectedIds, startGroupScale, startResize],
  );

  /** Select tool press: resize from a handle, drag what's under the pointer, or start a marquee. */
  const pressWithSelectTool = useCallback(
    (
      e: React.PointerEvent<SVGSVGElement>,
      svg: SVGSVGElement,
      point: Point,
      targets: DiagramElement[],
    ) => {
      pendingEditRef.current = null;
      const beginGesture = (next: InteractionMode) => {
        setMode(next);
        svg.setPointerCapture(e.pointerId);
      };

      // A group that can't scale falls through to a normal press
      const handle = hitTestSelectionHandle(point, targets, selectedIds, viewport.zoom);
      const resizing = handle !== null && startSelectionResize(handle, point);
      const hitElement = resizing
        ? null
        : hitTestSelection(point, targets, viewport.zoom, selectedIds);

      if (resizing) {
        e.preventDefault();
        setResizeHandle(handle);
        beginGesture("resizing");
      } else if (hitElement) {
        e.stopPropagation();
        const alreadySelected = selectedIds.has(hitElement.id);
        if (e.shiftKey) {
          const next = new Set(selectedIds);
          if (alreadySelected) next.delete(hitElement.id);
          else next.add(hitElement.id);
          dispatch({ type: "SET_SELECTION", ids: Array.from(next) });
        } else if (!alreadySelected) {
          dispatch({ type: "SET_SELECTION", ids: [hitElement.id] });
        } else if (!editingTarget && selectedIds.size === 1) {
          // Clicking the sole selection again edits its text (on release)
          pendingEditRef.current = {
            elementId: hitElement.id,
            screenStart: { x: e.clientX, y: e.clientY },
          };
        }
        beginGesture("dragging");
        startDrag(alreadySelected ? Array.from(selectedIds) : [hitElement.id], point);
      } else if (!e.shiftKey && hitTestGroupSelection(point, targets, selectedIds)) {
        // Empty space inside a multi-selection's group box drags the group
        e.stopPropagation();
        beginGesture("dragging");
        startDrag(Array.from(selectedIds), point);
      } else {
        // Empty canvas → box selection (click without drag clears)
        e.preventDefault();
        marqueeRef.current = {
          startPoint: point,
          currentPoint: point,
          screenStart: { x: e.clientX, y: e.clientY },
          additive: e.shiftKey,
        };
        setMarqueeBounds(boundsFromPoints(point, point));
        beginGesture("marqueeing");
      }
    },
    [selectedIds, viewport.zoom, editingTarget, dispatch, startSelectionResize, startDrag],
  );

  // ── Pointer down on SVG ──
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;

      // A press outside the inline editor (its own presses don't reach here)
      // commits the edit and still acts as a normal click.
      let targets = elements;
      if (editingTarget) {
        const text = readLiveEditorText(editingTarget.text);
        commitTextEditing(editingTarget.elementId, text, editingTarget.kind);
        if (editingTarget.kind === "standalone-text" && text.trim() === "") {
          targets = elements.filter((el) => el.id !== editingTarget.elementId);
        }
      }
      const canvasPoint = getCanvasPoint(e);

      // Middle-click or space+left-click → pan, whatever the tool
      if (e.button === 1 || (e.button === 0 && spaceHeld)) {
        e.preventDefault();
        setMode("panning");
        setPanStart({ x: e.clientX, y: e.clientY });
        setPanViewportStart({ x: viewport.x, y: viewport.y });
        svg.setPointerCapture(e.pointerId);
        return;
      }
      if (e.button !== 0) return; // tools act on left-click only

      switch (tool) {
        case "arrow":
        case "line":
          handleArrowClick(tool, canvasPoint, HANDLE_SIZE / viewport.zoom, e.shiftKey);
          break;

        case "text": {
          e.preventDefault();
          const hitElement = hitTestTextTarget(canvasPoint, targets, viewport.zoom);
          if (hitElement) {
            dispatch({ type: "SET_TOOL", tool: "select" });
            dispatch({ type: "SET_SELECTION", ids: [hitElement.id] });
            openTextEditor(hitElement);
          } else {
            createTextAt(canvasPoint);
          }
          break;
        }

        case "rectangle":
        case "circle":
        case "cylinder":
        case "diamond": {
          const element = createShapeElement(tool, canvasPoint, crypto.randomUUID(), generateSeed());
          beginCreation(e, svg, tool, element, canvasPoint);
          break;
        }

        case "icon":
          if (activeIconId) {
            const element = createIconElement(
              icons,
              activeIconId,
              canvasPoint,
              crypto.randomUUID(),
              generateSeed(),
            );
            beginCreation(e, svg, "icon", element, canvasPoint);
          }
          break;

        case "select":
          pressWithSelectTool(e, svg, canvasPoint, targets);
          break;
      }
    },
    [
      svgRef,
      getCanvasPoint,
      spaceHeld,
      viewport,
      tool,
      elements,
      dispatch,
      handleArrowClick,
      editingTarget,
      openTextEditor,
      createTextAt,
      commitTextEditing,
      activeIconId,
      icons,
      beginCreation,
      pressWithSelectTool,
    ],
  );

  // ── Double-click on SVG → add free text at the pointer ──
  // On an element, the first click selects it and the second already opened
  // its editor, so editingTarget short-circuits this.
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (editingTarget) return;
      if (e.button !== 0) return;
      if (tool !== "select") return;

      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const canvasPoint = screenToCanvas(
        e.clientX - rect.left,
        e.clientY - rect.top,
        viewport,
        containerSize,
      );

      e.preventDefault();
      e.stopPropagation();
      createTextAt(canvasPoint);
    },
    [svgRef, viewport, containerSize, tool, createTextAt, editingTarget],
  );

  // ── Pointer move on SVG: continue the active gesture, or update hover feedback ──
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const canvasPoint = getCanvasPoint(e);

      switch (mode) {
        case "panning":
          if (panStart && panViewportStart) {
            dispatch({
              type: "SET_VIEWPORT",
              viewport: {
                ...viewport,
                x: panViewportStart.x - (e.clientX - panStart.x) / viewport.zoom,
                y: panViewportStart.y - (e.clientY - panStart.y) / viewport.zoom,
              },
            });
          }
          break;

        case "dragging":
          continueDrag(canvasPoint);
          break;

        case "resizing":
          continueResize(canvasPoint, e.shiftKey);
          break;

        case "creating": {
          const creation = creationRef.current;
          if (creation) {
            dispatch({
              type: "UPDATE_ELEMENT",
              id: creation.elementId,
              patch: creationPatch(creation, canvasPoint),
            });
          }
          break;
        }

        case "marqueeing": {
          const marquee = marqueeRef.current;
          if (marquee) {
            marqueeRef.current = { ...marquee, currentPoint: canvasPoint };
            setMarqueeBounds(boundsFromPoints(marquee.startPoint, canvasPoint));
          }
          break;
        }

        case "none":
          if (tool === "select") {
            setHoveringSelectable(
              hitTestSelection(canvasPoint, elements, viewport.zoom, selectedIds) !== null ||
                hitTestGroupSelection(canvasPoint, elements, selectedIds),
            );
          } else if (isConnectorTool(tool)) {
            // Track the hovered connection point and preview the snap
            const snapThreshold = HANDLE_SIZE / viewport.zoom;
            lastConnectorPointRef.current = canvasPoint;
            setHoveredConnectionPoint(
              hitTestConnectionPoint(canvasPoint, elements, snapThreshold),
            );
            if (arrowStart) {
              updatePreview(tool, canvasPoint, snapThreshold, e.shiftKey);
            }
          }
          break;
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
      selectedIds,
    ],
  );

  // ── Pointer up on SVG: end the active gesture ──
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || mode === "none") return;

      setMode("none");
      svg.releasePointerCapture(e.pointerId);

      switch (mode) {
        case "panning":
          setPanStart(null);
          setPanViewportStart(null);
          break;

        case "dragging": {
          endDrag();
          // A click (no real drag) on the sole selection opens its text editor
          const pendingEdit = pendingEditRef.current;
          pendingEditRef.current = null;
          const isClick =
            pendingEdit &&
            Math.hypot(
              e.clientX - pendingEdit.screenStart.x,
              e.clientY - pendingEdit.screenStart.y,
            ) < CLICK_SLOP_PX;
          const element = isClick && elements.find((el) => el.id === pendingEdit.elementId);
          if (element) openTextEditor(element);
          break;
        }

        case "resizing":
          endResize();
          break;

        case "creating":
          creationRef.current = null;
          dispatch({ type: "END_HISTORY" });
          break;

        case "marqueeing": {
          const marquee = marqueeRef.current;
          marqueeRef.current = null;
          setMarqueeBounds(null);
          // A null marquee was cancelled via Escape mid-gesture
          const result =
            marquee &&
            resolveMarqueeSelection({
              startPoint: marquee.startPoint,
              endPoint: getCanvasPoint(e),
              screenStart: marquee.screenStart,
              screenEnd: { x: e.clientX, y: e.clientY },
              additive: marquee.additive,
              selectedIds,
              elements,
            });
          if (result?.type === "clear") {
            dispatch({ type: "CLEAR_SELECTION" });
          } else if (result?.type === "set") {
            dispatch({ type: "SET_SELECTION", ids: result.ids });
          }
          break;
        }
      }
    },
    [
      svgRef,
      mode,
      endDrag,
      endResize,
      dispatch,
      elements,
      selectedIds,
      getCanvasPoint,
      openTextEditor,
    ],
  );

  // ── Cursor ──
  const getCursor = useCallback(() => {
    if (editingTarget) return "text";
    if (mode === "panning") return "grabbing";
    if (mode === "resizing") return HANDLE_CURSORS[resizeHandle];
    if (mode === "dragging") return "move";
    if (mode === "marqueeing") return "crosshair";
    if (spaceHeld) return "grab";
    if (tool === "select") return hoveringSelectable ? "move" : "default";
    return "crosshair";
  }, [mode, resizeHandle, spaceHeld, tool, editingTarget, hoveringSelectable]);

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
    previewStart,
    hoveredConnectionPoint,
    marqueeBounds,
    spaceHeld,
    handleSize: HANDLE_SIZE,
    // Text editing
    editingTarget,
    commitTextEditing,
    cancelTextEditing,
    changeEditingFontSize,
    stepEditingFontSize,
    updateEditingLayout,
    updateEditingText,
  };
}
