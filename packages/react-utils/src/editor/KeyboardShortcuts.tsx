import { useCallback, useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";

interface ShortcutRow {
  keys: string[];
  label: string;
}

function modKey(): string {
  if (typeof navigator === "undefined") return "Ctrl";

  const uaData = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData;
  const hint = uaData?.platform ?? navigator.userAgent;

  return /mac|iphone|ipad|ipod/i.test(hint) ? "⌘" : "Ctrl";
}

function buildShortcuts(mod: string): ShortcutRow[] {
  return [
    { keys: ["Shift", "click"], label: "Multi-select" },
    { keys: [mod, "C"], label: "Copy" },
    { keys: [mod, "X"], label: "Cut" },
    { keys: [mod, "V"], label: "Paste" },
    { keys: ["Del"], label: "Delete selection" },
    { keys: ["2× click"], label: "Edit text" },
    { keys: ["?"], label: "Toggle this panel" },
  ];
}

/**
 * Keyboard-shortcuts helper for the canvas header.
 * Toggle via the button or the `?` key (when not typing).
 */
export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const [mod, setMod] = useState("Ctrl");

  useEffect(() => {
    setMod(modKey());
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

  const shortcuts = buildShortcuts(mod);

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
        <Keyboard />
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
              <X />
            </button>
          </div>
          <ul className="scribblesvg-editor__shortcuts-list">
            {shortcuts.map(({ keys, label }) => (
              <li key={label}>
                <span className="scribblesvg-editor__shortcuts-label">
                  {label}
                </span>
                <span className="scribblesvg-editor__shortcuts-keys">
                  {keys.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
