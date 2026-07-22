// Canvas components
export { DiagramCanvas } from "./DiagramCanvas";
export type { DiagramCanvasProps } from "./DiagramCanvas";
export { Toolbar } from "./Toolbar";
export { ElementRenderer } from "./ElementRenderer";
export { GridBackground } from "./GridBackground";
export { SelectionOverlay } from "./SelectionOverlay";
export { ResizeHandles } from "./ResizeHandles";
export { ArrowPreview } from "./ArrowPreview";
export { TextRenderer } from "./TextRenderer";
export { InlineTextEditor } from "./InlineTextEditor";
export type { EditingTarget } from "./InlineTextEditor";

// Icons catalog
export type {
  DiagramIcon,
  IconRenderMode,
  ParsedIconSvg,
  CatalogPartition,
} from "../icons";
export {
  resolveDiagramIcon,
  getIconRenderMode,
  partitionIconCatalog,
  parseIconSvg,
} from "../icons";

// State management
export { useCanvasReducer, canvasReducer } from "./useCanvasReducer";
export type { CanvasState, CanvasAction, ToolType } from "./useCanvasReducer";

// Coordinate utilities
export { screenToCanvas, canvasToScreen, getViewBox } from "./coordinate-utils";

// Hit testing
export {
  hitTest,
  hitTestElement,
  hitTestResizeHandle,
  getResizeHandles,
} from "./hit-test";
export type { HandlePosition, HandleInfo } from "./hit-test";

// Interaction hooks
export { useCanvasInteraction } from "./useCanvasInteraction";
export { useElementDrag } from "./useElementDrag";
export { useElementResize } from "./useElementResize";
export { useArrowCreation } from "./useArrowCreation";
