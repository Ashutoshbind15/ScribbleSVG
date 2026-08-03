import { useCallback, useEffect, useState } from "react";
import { CloseIcon, KeyboardIcon } from "./toolbarIcons";

interface ShortcutRow {
  keys: string[];
  /** Alternate chord shown after `/` (e.g. Ctrl+Y redo on Windows/Linux). */
  altKeys?: string[];
  label: string;
}

function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;

  const uaData = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData;
  const hint = uaData?.platform ?? navigator.userAgent;

  return /mac|iphone|ipad|ipod/i.test(hint);
}

function modKey(isApple: boolean): string {
  return isApple ? "⌘" : "Ctrl";
}

function buildShortcuts(mod: string, isApple: boolean): ShortcutRow[] {
  return [
    { keys: ["Two-finger scroll"], label: "Pan canvas" },
    { keys: ["Pinch"], label: "Zoom (trackpad)" },
    { keys: ["Ctrl", "scroll"], label: "Zoom (fine)" },
    { keys: ["Scroll wheel"], label: "Zoom (mouse)" },
    { keys: ["Space", "drag"], label: "Pan canvas" },
    { keys: ["Shift", "click"], label: "Multi-select" },
    { keys: ["Drag empty"], label: "Box select" },
    { keys: ["Shift", "drag"], label: "Add to box selection" },
    { keys: [mod, "C"], label: "Copy" },
    { keys: [mod, "X"], label: "Cut" },
    { keys: [mod, "V"], label: "Paste" },
    { keys: [mod, "Z"], label: "Undo" },
    {
      keys: [mod, "Shift", "Z"],
      // Matches useCanvasInteraction: Ctrl+Y redo on Windows/Linux only
      ...(isApple ? {} : { altKeys: ["Ctrl", "Y"] }),
      label: "Redo",
    },
    { keys: ["Del"], altKeys: ["Backspace"], label: "Delete selection" },
    { keys: ["2× click"], label: "Edit text" },
    { keys: ["?"], label: "Toggle this panel" },
  ];
}

function renderKeys(keys: string[], idPrefix: string) {
  return keys.map((key) => <kbd key={`${idPrefix}-${key}`}>{key}</kbd>);
}

/**
 * Keyboard-shortcuts helper for the canvas header.
 * Toggle via the button or the `?` key (when not typing).
 */
export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const [isApple, setIsApple] = useState(false);

  useEffect(() => {
    setIsApple(isApplePlatform());
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  const mod = modKey(isApple);
  const shortcuts = buildShortcuts(mod, isApple);

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
        onClick={() => setOpen((prev) => !prev)}
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
              onClick={() => setOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>
          <ul className="scribblesvg-editor__shortcuts-list">
            {shortcuts.map(({ keys, altKeys, label }) => (
              <li key={label}>
                <span className="scribblesvg-editor__shortcuts-label">
                  {label}
                </span>
                <span className="scribblesvg-editor__shortcuts-keys">
                  {renderKeys(keys, label)}
                  {altKeys && (
                    <>
                      <span
                        className="scribblesvg-editor__shortcuts-or"
                        aria-hidden="true"
                      >
                        /
                      </span>
                      {renderKeys(altKeys, `${label}-alt`)}
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
