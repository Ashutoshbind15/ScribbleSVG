import { useCallback, useEffect, useRef, useState } from "react";
import { MinusIcon, PlusIcon } from "./toolbarIcons";

interface FontSizePopupProps {
  /** Current font size of the target element/label */
  fontSize: number;
  /** Screen-space X to horizontally center the popup on (top of the element) */
  screenX: number;
  /** Screen-space Y to anchor the popup above (top of the element) */
  screenY: number;
  /** Called with the new font size whenever it changes */
  onChange: (fontSize: number) => void;
}

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 200;
const STEP = 2;

function clamp(value: number): number {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value));
}

/**
 * Floating segmented stepper for font size.
 * Shown above standalone text on select, or above any text while editing.
 */
export function FontSizePopup({
  fontSize,
  screenX,
  screenY,
  onChange,
}: FontSizePopupProps) {
  const committedSize = Math.round(fontSize);
  const [inputValue, setInputValue] = useState(String(committedSize));
  const [isEditing, setIsEditing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!isEditing) {
      setInputValue(String(committedSize));
    }
  }, [committedSize, isEditing]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  /** After typing a size, return focus to the inline text editor if open. */
  const restoreInlineEditorFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const editor = rootRef.current?.closest(".scribblesvg-editor");
      const textarea = editor?.querySelector(
        ".scribblesvg-editor__viewport textarea",
      );
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.focus();
      }
    });
  }, []);

  const endValueEdit = useCallback(() => {
    skipBlurCommitRef.current = true;
    setIsEditing(false);
    restoreInlineEditorFocus();
  }, [restoreInlineEditorFocus]);

  const handleStep = useCallback(
    (delta: number) => {
      onChange(clamp(committedSize + delta));
      // Discard any in-progress typed value without a blur commit race.
      if (isEditing) {
        endValueEdit();
      }
    },
    [committedSize, onChange, isEditing, endValueEdit],
  );

  const revertInput = useCallback(() => {
    setInputValue(String(committedSize));
    endValueEdit();
  }, [committedSize, endValueEdit]);

  const commitInput = useCallback(() => {
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
      return;
    }

    const trimmed = inputValue.trim();
    if (trimmed === "") {
      revertInput();
      return;
    }

    const value = Number(trimmed);
    if (Number.isNaN(value)) {
      revertInput();
      return;
    }

    const nextSize = clamp(Math.round(value));
    onChange(nextSize);
    setInputValue(String(nextSize));
    endValueEdit();
  }, [inputValue, onChange, endValueEdit, revertInput]);

  // Keep canvas / inline-editor focus behavior intact: don't let +/− steal
  // focus from the textarea, and don't let popup events clear selection.
  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  const preventFocusSteal = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={rootRef}
      className="scribblesvg-editor__font-popup"
      style={{
        left: screenX,
        top: screenY,
        transform: "translate(-50%, calc(-100% - 10px))",
      }}
      onPointerDown={stopPropagation}
      onMouseDown={stopPropagation}
      onKeyDown={stopPropagation}
    >
      <button
        type="button"
        title="Decrease font size"
        aria-label="Decrease font size"
        onPointerDown={preventFocusSteal}
        onClick={() => handleStep(-STEP)}
      >
        <MinusIcon />
      </button>
      <span className="scribblesvg-editor__font-popup-divider" aria-hidden="true" />
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          title="Font size"
          aria-label="Font size"
          className="scribblesvg-editor__font-popup-value"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitInput}
          onKeyDown={(e) => {
            e.stopPropagation();

            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              revertInput();
            }
          }}
        />
      ) : (
        <button
          type="button"
          title="Font size"
          aria-label={`Font size ${committedSize}. Click to edit.`}
          className="scribblesvg-editor__font-popup-value"
          onPointerDown={preventFocusSteal}
          onClick={() => setIsEditing(true)}
        >
          {committedSize}
        </button>
      )}
      <span className="scribblesvg-editor__font-popup-divider" aria-hidden="true" />
      <button
        type="button"
        title="Increase font size"
        aria-label="Increase font size"
        onPointerDown={preventFocusSteal}
        onClick={() => handleStep(STEP)}
      >
        <PlusIcon />
      </button>
    </div>
  );
}
