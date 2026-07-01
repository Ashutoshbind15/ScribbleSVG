import { useCallback, useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

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
 * Floating popup shown above a selected text/label element, letting the
 * user manually change its font size without affecting the parent
 * element's width/height (resizing the shape already scales the font
 * proportionally — this control adjusts font size independently).
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

  useEffect(() => {
    if (!isEditing) {
      setInputValue(String(committedSize));
    }
  }, [committedSize, isEditing]);

  const handleStep = useCallback(
    (delta: number) => {
      onChange(clamp(committedSize + delta));
    },
    [committedSize, onChange],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
    },
    [],
  );

  const revertInput = useCallback(() => {
    setInputValue(String(committedSize));
    setIsEditing(false);
  }, [committedSize]);

  const commitInput = useCallback(() => {
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
    setIsEditing(false);
  }, [inputValue, onChange, revertInput]);

  // Prevent interactions with the popup from reaching the canvas
  // (would otherwise clear selection / start a pan / etc.)
  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className="absolute z-10 flex items-center gap-1 rounded-lg border bg-background p-1 shadow-md"
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
        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onClick={() => handleStep(-STEP)}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="number"
        title="Font size"
        aria-label="Font size"
        className="h-6 w-11 rounded border bg-transparent text-center text-xs text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={inputValue}
        min={MIN_FONT_SIZE}
        max={MAX_FONT_SIZE}
        onFocus={() => setIsEditing(true)}
        onChange={handleInputChange}
        onBlur={commitInput}
        onKeyDown={(e) => {
          e.stopPropagation();

          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            revertInput();
            e.currentTarget.blur();
          }
        }}
      />
      <button
        type="button"
        title="Increase font size"
        aria-label="Increase font size"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onClick={() => handleStep(STEP)}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
