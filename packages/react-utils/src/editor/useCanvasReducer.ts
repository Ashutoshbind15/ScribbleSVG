import { useReducer } from "react";
import {
  EMPTY_DOCUMENT,
  getContentBounds,
  isDiagramElement,
  type DiagramDocument,
  type DiagramElement,
  type ImageElement,
  type Viewport,
} from "@scribblesvg/core";
import { getBoundArrowAnchorUpdates } from "./arrowAnchors";
import { screenToCanvas } from "./coordinate-utils";
import { fitImageToViewport } from "./image-fit";
import { fitViewport, zoomAround } from "./zoom";

// ── Tool types ──

export type ToolType =
  | "select"
  | "rectangle"
  | "circle"
  | "cylinder"
  | "diamond"
  | "icon"
  | "text"
  | "arrow"
  | "line";

// ── History ──

const MAX_HISTORY = 100;

/** Snapshot of undoable document state (viewport is excluded). */
export interface HistorySnapshot {
  elements: DiagramElement[];
  selectedIds: string[];
}

// ── Canvas state ──

export interface CanvasState {
  document: DiagramDocument;
  selectedIds: Set<string>;
  tool: ToolType;
  /** Catalog iconId used when the icon tool places a new element. */
  activeIconId: string | null;
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  /**
   * When > 0, document mutations do not push new history entries.
   * Use BEGIN_HISTORY / END_HISTORY to group a gesture into one undo step.
   */
  historyBatchDepth: number;
  /** Canvas size in screen pixels. A guess until the first `RESIZE`. */
  size: { width: number; height: number };
  /** Fit the content to the first non-empty `RESIZE` (the `fitOnLoad` prop). */
  fitPending: boolean;
}

// ── Actions ──

export type CanvasAction =
  | { type: "SET_DOCUMENT"; document: DiagramDocument }
  | { type: "SET_TOOL"; tool: ToolType; activeIconId?: string | null }
  | { type: "SET_VIEWPORT"; viewport: Viewport }
  | { type: "RESIZE"; size: { width: number; height: number } }
  /**
   * Zoom by `factor`, keeping the canvas point under `screenPoint` (pixels
   * from the canvas's top-left) in place.
   */
  | { type: "ZOOM_AT"; factor: number; screenPoint: { x: number; y: number } }
  /** Scroll the viewport by screen pixels. */
  | { type: "PAN_BY"; dx: number; dy: number }
  /**
   * Add an image centred in the viewport, select it and switch to the select
   * tool. An image that fails validation is skipped.
   */
  | {
      type: "INSERT_IMAGE";
      image: Omit<ImageElement, "x" | "y" | "width" | "height">;
    }
  | { type: "PLACE_ELEMENT"; element: DiagramElement }
  | { type: "SELECT_ELEMENT"; id: string }
  | { type: "ADD_ELEMENT"; element: DiagramElement }
  | {
      type: "ADD_ELEMENTS";
      elements: DiagramElement[];
      /** When true, selection becomes the newly added element ids. */
      select?: boolean;
    }
  | { type: "UPDATE_ELEMENT"; id: string; patch: Partial<DiagramElement> }
  | {
      type: "UPDATE_ELEMENTS";
      updates: { id: string; patch: Partial<DiagramElement> }[];
      /** Recompute bound endpoints from the patched document in this transition. */
      reanchor?: boolean;
    }
  | { type: "DELETE_ELEMENTS"; ids: string[] }
  | { type: "SET_SELECTION"; ids: string[] }
  | { type: "CLEAR_SELECTION" }
  | { type: "BEGIN_HISTORY" }
  | { type: "END_HISTORY" }
  | { type: "UNDO" }
  | { type: "REDO" };

// ── History helpers ──

function takeSnapshot(state: CanvasState): HistorySnapshot {
  return {
    elements: state.document.elements,
    selectedIds: Array.from(state.selectedIds),
  };
}

function pushPast(
  past: HistorySnapshot[],
  snapshot: HistorySnapshot,
): HistorySnapshot[] {
  const next = [...past, snapshot];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

/**
 * Apply a document-mutating next state, pushing history unless we're inside
 * an open undo group or the elements array is unchanged by reference.
 */
function withHistory(state: CanvasState, next: CanvasState): CanvasState {
  if (
    state.historyBatchDepth > 0 ||
    next.document.elements === state.document.elements
  ) {
    return {
      ...next,
      past: state.past,
      future: state.future,
      historyBatchDepth: state.historyBatchDepth,
    };
  }

  return {
    ...next,
    past: pushPast(state.past, takeSnapshot(state)),
    future: [],
    historyBatchDepth: state.historyBatchDepth,
  };
}

function restoreSnapshot(
  state: CanvasState,
  snapshot: HistorySnapshot,
): Pick<CanvasState, "document" | "selectedIds"> {
  return {
    document: {
      ...state.document,
      elements: snapshot.elements,
    },
    selectedIds: new Set(snapshot.selectedIds),
  };
}

// ── Reducer ──

function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case "SET_DOCUMENT":
      return {
        ...state,
        document: action.document,
        selectedIds: new Set(),
        past: [],
        future: [],
        historyBatchDepth: 0,
      };

    case "SET_TOOL":
      return {
        ...state,
        tool: action.tool,
        activeIconId:
          action.tool === "icon"
            ? (action.activeIconId ?? state.activeIconId)
            : null,
      };

    case "SET_VIEWPORT":
      return {
        ...state,
        document: { ...state.document, viewport: action.viewport },
      };

    case "RESIZE": {
      const { size } = action;
      if (state.fitPending && size.width > 0 && size.height > 0) {
        return {
          ...state,
          size,
          fitPending: false,
          document: {
            ...state.document,
            viewport: fitViewport(getContentBounds(state.document.elements), size),
          },
        };
      }
      if (size.width === state.size.width && size.height === state.size.height) {
        return state;
      }
      return { ...state, size };
    }

    case "ZOOM_AT": {
      const { viewport } = state.document;
      const anchor = screenToCanvas(
        action.screenPoint.x,
        action.screenPoint.y,
        viewport,
        state.size,
      );
      return {
        ...state,
        document: {
          ...state.document,
          viewport: zoomAround(viewport, viewport.zoom * action.factor, anchor),
        },
      };
    }

    case "PAN_BY": {
      const { viewport } = state.document;
      return {
        ...state,
        document: {
          ...state.document,
          viewport: {
            ...viewport,
            x: viewport.x + action.dx / viewport.zoom,
            y: viewport.y + action.dy / viewport.zoom,
          },
        },
      };
    }

    case "INSERT_IMAGE": {
      const { image } = action;
      const element: ImageElement = {
        ...image,
        ...fitImageToViewport(
          { width: image.naturalWidth, height: image.naturalHeight },
          state.document.viewport,
          state.size,
        ),
      };
      // Never let a bad host result into the document.
      if (!isDiagramElement(element)) return state;
      return canvasReducer(state, { type: "PLACE_ELEMENT", element });
    }

    case "SELECT_ELEMENT":
      return {
        ...state,
        tool: "select",
        activeIconId: null,
        selectedIds: new Set([action.id]),
      };

    case "PLACE_ELEMENT":
      return withHistory(state, {
        ...canvasReducer(state, { type: "SELECT_ELEMENT", id: action.element.id }),
        document: {
          ...state.document,
          elements: [...state.document.elements, action.element],
        },
      });

    case "ADD_ELEMENT":
      return withHistory(state, {
        ...state,
        document: {
          ...state.document,
          elements: [...state.document.elements, action.element],
        },
      });

    case "ADD_ELEMENTS":
      if (action.elements.length === 0) return state;
      return withHistory(state, {
        ...state,
        document: {
          ...state.document,
          elements: [...state.document.elements, ...action.elements],
        },
        selectedIds: action.select
          ? new Set(action.elements.map((el) => el.id))
          : state.selectedIds,
      });

    case "UPDATE_ELEMENT": {
      let changed = false;
      const elements = state.document.elements.map((el) => {
        if (el.id !== action.id) return el;
        changed = true;
        return { ...el, ...action.patch } as DiagramElement;
      });
      if (!changed) return state;
      return withHistory(state, {
        ...state,
        document: { ...state.document, elements },
      });
    }

    case "UPDATE_ELEMENTS": {
      if (action.updates.length === 0) return state;
      const patchMap = new Map(action.updates.map((u) => [u.id, u.patch]));
      let changed = false;
      let elements = state.document.elements.map((el) => {
        const patch = patchMap.get(el.id);
        if (!patch) return el;
        changed = true;
        return { ...el, ...patch } as DiagramElement;
      });
      if (!changed) return state;
      if (action.reanchor) {
        const anchors = new Map(getBoundArrowAnchorUpdates(
          new Set(action.updates.map((u) => u.id)),
          elements,
        ).map((u) => [u.id, u.patch]));
        elements = elements.map((el) => {
          const patch = anchors.get(el.id);
          return patch ? { ...el, ...patch } as DiagramElement : el;
        });
      }
      return withHistory(state, {
        ...state,
        document: { ...state.document, elements },
      });
    }

    case "DELETE_ELEMENTS": {
      const deleteSet = new Set(action.ids);
      const nextSelected = new Set(state.selectedIds);
      for (const id of action.ids) {
        nextSelected.delete(id);
      }
      return withHistory(state, {
        ...state,
        document: {
          ...state.document,
          elements: state.document.elements.filter(
            (el) => !deleteSet.has(el.id),
          ),
        },
        selectedIds: nextSelected,
      });
    }

    case "SET_SELECTION":
      return { ...state, selectedIds: new Set(action.ids) };

    case "CLEAR_SELECTION":
      return { ...state, selectedIds: new Set() };

    case "BEGIN_HISTORY":
      if (state.historyBatchDepth > 0) {
        return {
          ...state,
          historyBatchDepth: state.historyBatchDepth + 1,
        };
      }
      return {
        ...state,
        past: pushPast(state.past, takeSnapshot(state)),
        future: [],
        historyBatchDepth: 1,
      };

    case "END_HISTORY": {
      if (state.historyBatchDepth <= 0) return state;

      const depth = state.historyBatchDepth - 1;
      if (depth > 0) {
        return { ...state, historyBatchDepth: depth };
      }

      // Drop the snapshot if the gesture made no element changes.
      const last = state.past[state.past.length - 1];
      if (last && last.elements === state.document.elements) {
        return {
          ...state,
          past: state.past.slice(0, -1),
          historyBatchDepth: 0,
        };
      }

      return { ...state, historyBatchDepth: 0 };
    }

    case "UNDO": {
      if (state.past.length === 0 || state.historyBatchDepth > 0) {
        return state;
      }
      const previous = state.past[state.past.length - 1]!;
      return {
        ...state,
        ...restoreSnapshot(state, previous),
        past: state.past.slice(0, -1),
        future: [takeSnapshot(state), ...state.future].slice(0, MAX_HISTORY),
      };
    }

    case "REDO": {
      if (state.future.length === 0 || state.historyBatchDepth > 0) {
        return state;
      }
      const next = state.future[0]!;
      return {
        ...state,
        ...restoreSnapshot(state, next),
        past: pushPast(state.past, takeSnapshot(state)),
        future: state.future.slice(1),
      };
    }

    default:
      return state;
  }
}

// ── Hook ──

const INITIAL_STATE: CanvasState = {
  document: EMPTY_DOCUMENT,
  selectedIds: new Set(),
  tool: "select",
  activeIconId: null,
  past: [],
  future: [],
  historyBatchDepth: 0,
  size: { width: 800, height: 600 },
  fitPending: false,
};

/**
 * Editor state for `initialDoc`. With `fitOnLoad`, the first real canvas
 * size (`RESIZE`) also frames the document's content.
 */
export function useCanvasReducer(
  initialDoc?: DiagramDocument,
  { fitOnLoad = false }: { fitOnLoad?: boolean } = {},
) {
  return useReducer(canvasReducer, {
    ...INITIAL_STATE,
    document: initialDoc ?? EMPTY_DOCUMENT,
    fitPending: fitOnLoad,
  });
}

// Export the reducer for testing purposes
export { canvasReducer };
