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
  | "text"
  | "arrow";

// ── Canvas state ──

export interface CanvasState {
  document: DiagramDocument;
  selectedIds: Set<string>;
  tool: ToolType;
}

// ── Actions ──

export type CanvasAction =
  | { type: "SET_DOCUMENT"; document: DiagramDocument }
  | { type: "SET_TOOL"; tool: ToolType }
  | { type: "SET_VIEWPORT"; viewport: Viewport }
  | { type: "ADD_ELEMENT"; element: DiagramElement }
  | { type: "UPDATE_ELEMENT"; id: string; patch: Partial<DiagramElement> }
  | {
      type: "UPDATE_ELEMENTS";
      updates: { id: string; patch: Partial<DiagramElement> }[];
    }
  | { type: "DELETE_ELEMENTS"; ids: string[] }
  | { type: "SET_SELECTION"; ids: string[] }
  | { type: "CLEAR_SELECTION" };

// ── Reducer ──

function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case "SET_DOCUMENT":
      return {
        ...state,
        document: action.document,
        selectedIds: new Set(),
      };

    case "SET_TOOL":
      return { ...state, tool: action.tool };

    case "SET_VIEWPORT":
      return {
        ...state,
        document: { ...state.document, viewport: action.viewport },
      };

    case "ADD_ELEMENT":
      return {
        ...state,
        document: {
          ...state.document,
          elements: [...state.document.elements, action.element],
        },
      };

    case "UPDATE_ELEMENT":
      return {
        ...state,
        document: {
          ...state.document,
          elements: state.document.elements.map((el) =>
            el.id === action.id
              ? ({ ...el, ...action.patch } as DiagramElement)
              : el,
          ),
        },
      };

    case "UPDATE_ELEMENTS": {
      const patchMap = new Map(action.updates.map((u) => [u.id, u.patch]));
      return {
        ...state,
        document: {
          ...state.document,
          elements: state.document.elements.map((el) => {
            const patch = patchMap.get(el.id);
            return patch ? ({ ...el, ...patch } as DiagramElement) : el;
          }),
        },
      };
    }

    case "DELETE_ELEMENTS": {
      const deleteSet = new Set(action.ids);
      const nextSelected = new Set(state.selectedIds);
      for (const id of action.ids) {
        nextSelected.delete(id);
      }
      return {
        ...state,
        document: {
          ...state.document,
          elements: state.document.elements.filter(
            (el) => !deleteSet.has(el.id),
          ),
        },
        selectedIds: nextSelected,
      };
    }

    case "SET_SELECTION":
      return { ...state, selectedIds: new Set(action.ids) };

    case "CLEAR_SELECTION":
      return { ...state, selectedIds: new Set() };

    default:
      return state;
  }
}

// ── Hook ──

const INITIAL_STATE: CanvasState = {
  document: EMPTY_DOCUMENT,
  selectedIds: new Set(),
  tool: "select",
};

export function useCanvasReducer(initialDoc?: DiagramDocument) {
  return useReducer(canvasReducer, {
    ...INITIAL_STATE,
    document: initialDoc ?? EMPTY_DOCUMENT,
  });
}

// Export the reducer for testing purposes
export { canvasReducer };
