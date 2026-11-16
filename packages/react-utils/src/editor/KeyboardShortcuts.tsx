import { useCallback } from "react";
import { CloseIcon, KeyboardIcon } from "./toolbarIcons";
import { helpRows } from "./keymap";

function renderKeys(keys: string[], idPrefix: string) {
  return keys.map((key) => <kbd key={`${idPrefix}-${key}`}>{key}</kbd>);
}

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isApple: boolean;
}

export function KeyboardShortcuts({
  open,
  onOpenChange,
  isApple,
}: KeyboardShortcutsProps) {
  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  const shortcuts = helpRows(isApple);

  return (
    <div
      className="scribblesvg-editor__shortcuts"
      onPointerDown={stopPropagation}
      onMouseDown={stopPropagation}
    >
      <button
        type="button"
        className="scribblesvg-editor__shortcuts-toggle"
        title="Useful keyboard shortcuts (?)"
        aria-label="Useful keyboard shortcuts"
        aria-expanded={open}
        aria-pressed={open}
        onClick={() => onOpenChange(!open)}
      >
        <KeyboardIcon />
      </button>

      {open && (
        <div
          className="scribblesvg-editor__shortcuts-panel"
          role="dialog"
          aria-label="Useful keyboard shortcuts"
        >
          <div className="scribblesvg-editor__shortcuts-header">
            <span>Useful shortcuts</span>
            <button
              type="button"
              title="Close"
              aria-label="Close shortcuts"
              onClick={() => onOpenChange(false)}
            >
              <CloseIcon />
            </button>
          </div>
          <ul className="scribblesvg-editor__shortcuts-list">
            {shortcuts.map(({ id, keys, altKeys, label }) => (
              <li key={id}>
                <span className="scribblesvg-editor__shortcuts-label">
                  {label}
                </span>
                <span className="scribblesvg-editor__shortcuts-keys">
                  {renderKeys(keys, id)}
                  {altKeys && (
                    <>
                      <span
                        className="scribblesvg-editor__shortcuts-or"
                        aria-hidden="true"
                      >
                        /
                      </span>
                      {renderKeys(altKeys, `${id}-alt`)}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
