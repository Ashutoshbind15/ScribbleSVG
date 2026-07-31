// Canvas components
export { DiagramCanvas } from "./DiagramCanvas";
export type { DiagramCanvasProps } from "./DiagramCanvas";
export { Toolbar } from "./Toolbar";
export { ElementRenderer } from "./ElementRenderer";
export { SelectionOverlay } from "./SelectionOverlay";
export { MarqueeOverlay } from "./MarqueeOverlay";
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
export type {
  CanvasState,
  CanvasAction,
  ToolType,
  HistorySnapshot,
} from "./useCanvasReducer";

// Coordinate utilities
export { screenToCanvas, canvasToScreen, getViewBox } from "./coordinate-utils";

// Hit testing
export {
  hitTest,
  hitTestElement,
  hitTestResizeHandle,
  hitTestMarquee,
  resolveMarqueeSelection,
  boundsFromPoints,
  boundsIntersect,
  MARQUEE_CLICK_THRESHOLD_PX,
  getResizeHandles,
} from "./hit-test";
export type {
  HandlePosition,
  HandleInfo,
  MarqueeSelectionResult,
} from "./hit-test";

// Interaction hooks
export { useCanvasInteraction } from "./useCanvasInteraction";
export { useElementDrag } from "./useElementDrag";
export { useElementResize } from "./useElementResize";
export { useArrowCreation } from "./useArrowCreation";
export type { ConnectorKind, ArrowStartState } from "./useArrowCreation";

// Clipboard
export {
  PASTE_OFFSET,
  collectCopyElements,
  cloneElementsForPaste,
  translateElement,
  serializeClipboard,
  parseClipboard,
  getEditorClipboard,
  setEditorClipboard,
  clearEditorClipboard,
} from "./clipboard";
export type { ClipboardPayload } from "./clipboard";
