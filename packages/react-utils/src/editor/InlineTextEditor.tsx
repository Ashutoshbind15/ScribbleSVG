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
  /** Live text on every keystroke (size chrome tracks it). */
  onTextChange?: (text: string) => void;
  /** Ctrl/Cmd+Shift+> (1) or < (-1) pressed while typing. */
  onFontSizeStep?: (direction: 1 | -1) => void;
}

/** Minimum editor dimensions */
const MIN_WIDTH = 60;
/** Shape labels only; standalone text hugs its line height */
const MIN_HEIGHT = 24;
/** Slack past the glyphs so the caret never clips at the box edge */
const STANDALONE_CHROME = 8;
/** Extra pad so shape-label FO can paint past the shape without clipping */
const SHAPE_LABEL_PAD = 16;
const FONT_FAMILY = "'Segoe UI', system-ui, sans-serif";

/**
 * Inline text editor overlay rendered inside the SVG via `<foreignObject>`.
 * - Auto-focuses on mount
 * - Commits on blur or Escape
 * - Enter inserts a newline (multi-line text)
 * - Standalone text grows its box with content (no scrollbars)
 *
 * Both kinds are rendered "in place": a transparent, borderless textarea
 * laid over where the SVG text sits, so typing looks like editing the text
 * itself. The selection overlay supplies the frame.
 */
export function InlineTextEditor({
  target,
  onCommit,
  onCancel,
  onLayoutChange,
  onTextChange,
  onFontSizeStep,
}: InlineTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isShapeLabel = target.kind === "shape-label";
  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;
  const onTextChangeRef = useRef(onTextChange);
  onTextChangeRef.current = onTextChange;
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
    onTextChangeRef.current?.(textarea.value);
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
    // Width only: vertical slack would leave a gap under the last line.
    const height = contentHeight;

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

  // Re-fit when font size changes (grip / shortcut) — content metrics change.
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
        return;
      }

      // Ctrl/Cmd+Shift+< / > — by code so the shifted glyph doesn't matter
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.code === "Period" || e.code === "Comma")
      ) {
        e.preventDefault();
        onFontSizeStep?.(e.code === "Period" ? 1 : -1);
      }
    },
    [handleCommit, onFontSizeStep],
  );

  const handleInput = useCallback(() => {
    if (isShapeLabel) {
      autoGrowShapeLabel();
      return;
    }
    onTextChangeRef.current?.(textareaRef.current?.value ?? "");
    fitStandaloneToContent();
  }, [isShapeLabel, autoGrowShapeLabel, fitStandaloneToContent]);

  // The text size grip never takes focus, so any blur ends the edit.
  const handleBlur = handleCommit;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const editorWidth = Math.max(target.width, MIN_WIDTH);
  const editorHeight = isShapeLabel
    ? Math.max(target.height, MIN_HEIGHT)
    : target.height;

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
            placeholder="Label"
            className="scribblesvg-editor__text-input"
            style={{
              width: "100%",
              fontSize: `${target.fontSize}px`,
              fontFamily: FONT_FAMILY,
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
        placeholder="Type…"
        className="scribblesvg-editor__text-input"
        style={{
          width: `${editorWidth}px`,
          height: `${editorHeight}px`,
          minWidth: `${MIN_WIDTH}px`,
          fontSize: `${target.fontSize}px`,
          fontFamily: FONT_FAMILY,
          lineHeight: "1.2",
          // No chrome: glyphs sit exactly where the SVG text renders.
          padding: "0",
          margin: "0",
          border: "none",
          background: "transparent",
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
