import { useReducer } from "react";
import {
  EMPTY_DOCUMENT,
  type DiagramDocument,
  type DiagramElement,
  type Viewport,
} from "@scribblesvg/core";

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
}

// ── Actions ──

export type CanvasAction =
  | { type: "SET_DOCUMENT"; document: DiagramDocument }
  | { type: "SET_TOOL"; tool: ToolType; activeIconId?: string | null }
  | { type: "SET_VIEWPORT"; viewport: Viewport }
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
      const elements = state.document.elements.map((el) => {
        const patch = patchMap.get(el.id);
        if (!patch) return el;
        changed = true;
        return { ...el, ...patch } as DiagramElement;
      });
      if (!changed) return state;
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
};

export function useCanvasReducer(initialDoc?: DiagramDocument) {
  return useReducer(canvasReducer, {
    ...INITIAL_STATE,
    document: initialDoc ?? EMPTY_DOCUMENT,
  });
}

// Export the reducer for testing purposes
export { canvasReducer };
