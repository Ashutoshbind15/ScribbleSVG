import { useEffect, useRef, useCallback, useState } from "react";
import { measureDomTextSize } from "./measureDomText";

/**
 * Editing target: which element and what kind of text is being edited.
 */
export interface EditingTarget {
  /** ID of the element being edited */
  elementId: string;
  /** Whether we're editing a standalone text element or a shape's inner label */
  kind: "standalone-text" | "shape-label";
  /** Current text value */
  text: string;
  /** Position and dimensions for the editor overlay (canvas coords) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Font size to match */
  fontSize: number;
}

interface InlineTextEditorProps {
  target: EditingTarget;
  /** Called when editing is committed with the new text value */
  onCommit: (
    elementId: string,
    text: string,
    kind: EditingTarget["kind"],
  ) => void;
  /** Called when editing is cancelled (e.g., Escape with no changes) */
  onCancel: () => void;
  /**
   * Standalone text only: fired when the editor content needs a larger box
   * (typing or font-size change). Parent should grow `target` + element bounds.
   */
  onLayoutChange?: (layout: {
    width: number;
    height: number;
    text: string;
  }) => void;
}

/** Minimum editor dimensions */
const MIN_WIDTH = 60;
const MIN_HEIGHT = 24;
/** Border + padding included in the foreignObject box */
const STANDALONE_CHROME = 8;
/** Extra pad so shape-label FO can paint past the shape without clipping */
const SHAPE_LABEL_PAD = 16;

/**
 * Inline text editor overlay rendered inside the SVG via `<foreignObject>`.
 * - Auto-focuses on mount
 * - Commits on blur or Escape
 * - Enter inserts a newline (multi-line text)
 * - Standalone text grows its box with content (no scrollbars)
 *
 * Shape labels are rendered "in place": a transparent, borderless textarea
 * centered within the shape's bounds so it looks like the text is being
 * typed directly into the shape itself, rather than an opaque box sitting
 * on top of it.
 */
export function InlineTextEditor({
  target,
  onCommit,
  onCancel,
  onLayoutChange,
}: InlineTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isShapeLabel = target.kind === "shape-label";
  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;
  const targetSizeRef = useRef({ width: target.width, height: target.height });
  targetSizeRef.current = { width: target.width, height: target.height };
  // Live text for measuring FO size (defaultValue doesn't re-render on type).
  const [shapeLabelText, setShapeLabelText] = useState(target.text);

  // Shape labels: grow height to content so flex-centering stays correct.
  const autoGrowShapeLabel = useCallback(() => {
    if (!isShapeLabel) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    setShapeLabelText(textarea.value);
  }, [isShapeLabel]);

  /**
   * Measure the textarea's intrinsic content and ask the parent to resize
   * the foreignObject. `overflow: visible` is ignored on textareas in most
   * browsers (computed as auto), so the only way to avoid scrollbars is to
   * size the box to the content.
   */
  const fitStandaloneToContent = useCallback(() => {
    if (isShapeLabel) return;
    const textarea = textareaRef.current;
    const onLayout = onLayoutChangeRef.current;
    if (!textarea || !onLayout) return;

    const prevWidth = textarea.style.width;
    const prevHeight = textarea.style.height;

    // Collapse to content so scrollWidth/scrollHeight reflect glyphs, not the box.
    textarea.style.width = "0px";
    textarea.style.height = "0px";
    const contentWidth = textarea.scrollWidth;
    const contentHeight = textarea.scrollHeight;
    textarea.style.width = prevWidth;
    textarea.style.height = prevHeight;

    const width = Math.max(contentWidth + STANDALONE_CHROME, MIN_WIDTH);
    const height = Math.max(contentHeight + STANDALONE_CHROME, MIN_HEIGHT);

    const prev = targetSizeRef.current;
    if (
      Math.abs(width - prev.width) < 0.5 &&
      Math.abs(height - prev.height) < 0.5
    ) {
      return;
    }

    onLayout({ width, height, text: textarea.value });
  }, [isShapeLabel]);

  // Auto-focus once when this element enters edit mode.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.select();
      if (isShapeLabel) {
        autoGrowShapeLabel();
      } else {
        fitStandaloneToContent();
      }
    });
    // Only re-run when switching to a different element.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-per-element
  }, [target.elementId]);

  // Re-fit when font size changes (stepper) — content metrics change.
  useEffect(() => {
    requestAnimationFrame(() => {
      if (isShapeLabel) {
        autoGrowShapeLabel();
      } else {
        fitStandaloneToContent();
      }
    });
  }, [
    target.fontSize,
    isShapeLabel,
    autoGrowShapeLabel,
    fitStandaloneToContent,
  ]);

  const handleCommit = useCallback(() => {
    const value = textareaRef.current?.value ?? "";
    onCommit(target.elementId, value, target.kind);
  }, [target.elementId, target.kind, onCommit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();

      if (e.key === "Escape") {
        e.preventDefault();
        handleCommit();
      }
    },
    [handleCommit],
  );

  const handleInput = useCallback(() => {
    if (isShapeLabel) {
      autoGrowShapeLabel();
      return;
    }
    fitStandaloneToContent();
  }, [isShapeLabel, autoGrowShapeLabel, fitStandaloneToContent]);

  // Defer commit so focus can move into the font-size stepper without
  // ending the edit session.
  const handleBlur = useCallback(() => {
    requestAnimationFrame(() => {
      if (
        document.activeElement?.closest(".scribblesvg-editor__font-popup")
      ) {
        return;
      }
      handleCommit();
    });
  }, [handleCommit]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const editorWidth = Math.max(target.width, MIN_WIDTH);
  const editorHeight = Math.max(target.height, MIN_HEIGHT);

  if (isShapeLabel) {
    // foreignObject clips HTML even with overflow:visible in most engines.
    // Size it to the larger of the shape and the live text metrics, centered
    // on the shape, so larger fonts aren't painted "under" the shape edges.
    const labelMetrics = measureDomTextSize(shapeLabelText, target.fontSize);
    const foWidth = Math.max(
      editorWidth,
      labelMetrics.width + SHAPE_LABEL_PAD * 2,
    );
    const foHeight = Math.max(
      editorHeight,
      labelMetrics.height + SHAPE_LABEL_PAD * 2,
    );
    const foX = target.x + editorWidth / 2 - foWidth / 2;
    const foY = target.y + editorHeight / 2 - foHeight / 2;

    return (
      <foreignObject
        x={foX}
        y={foY}
        width={foWidth}
        height={foHeight}
        overflow="visible"
        style={{ overflow: "visible" }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
          }}
        >
          <textarea
            ref={textareaRef}
            defaultValue={target.text}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onBlur={handleBlur}
            onPointerDown={handlePointerDown}
            rows={1}
            style={{
              width: "100%",
              fontSize: `${target.fontSize}px`,
              fontFamily: "'Segoe UI', system-ui, sans-serif",
              lineHeight: "1.2",
              padding: "0",
              margin: "0",
              border: "none",
              background: "transparent",
              color: "inherit",
              outline: "none",
              resize: "none",
              overflow: "hidden",
              textAlign: "center",
              boxSizing: "border-box",
            }}
          />
        </div>
      </foreignObject>
    );
  }

  return (
    <foreignObject
      x={target.x}
      y={target.y}
      width={editorWidth}
      height={editorHeight}
      style={{ overflow: "visible" }}
    >
      <textarea
        ref={textareaRef}
        defaultValue={target.text}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onBlur={handleBlur}
        onPointerDown={handlePointerDown}
        style={{
          width: `${editorWidth}px`,
          height: `${editorHeight}px`,
          minWidth: `${MIN_WIDTH}px`,
          minHeight: `${MIN_HEIGHT}px`,
          fontSize: `${target.fontSize}px`,
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          lineHeight: "1.2",
          padding: "2px",
          margin: "0",
          border: "2px solid var(--color-primary, #3b82f6)",
          borderRadius: "2px",
          background: "rgba(255, 255, 255, 0.95)",
          color: "inherit",
          outline: "none",
          resize: "none",
          // Browsers treat visible as auto on textarea — size the box instead.
          overflow: "hidden",
          whiteSpace: "pre",
          overflowWrap: "normal",
          boxSizing: "border-box",
          textAlign: "left",
        }}
      />
    </foreignObject>
  );
}
