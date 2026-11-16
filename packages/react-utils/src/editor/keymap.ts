/**
 * The editor's single definition of keyboard shortcuts: which key runs which
 * command, which keys the focused element keeps, and the help panel rows.
 * Pure (no DOM), so tests drive it with plain objects.
 */

/** The parts of a keyboard event the keymap reads (a React or DOM event fits). */
export interface KeyEventLike {
  /** "keydown" or "keyup". */
  type: string;
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  repeat: boolean;
}

/** Editor state a key's meaning depends on. */
export interface ShortcutContext {
  hasSelection: boolean;
  /** The inline text editor is open. */
  editingText: boolean;
  helpOpen: boolean;
  /** macOS / iOS: ⌘ is the command key and Ctrl+Y is not redo. */
  isApple: boolean;
}

export type Command =
  | { type: "undo" }
  | { type: "redo" }
  | { type: "copy" }
  | { type: "cut" }
  | { type: "paste" }
  | { type: "delete" }
  | { type: "fontStep"; direction: 1 | -1 }
  /** Drop the arrow being placed and the box-selection preview. */
  | { type: "cancelGesture" }
  | { type: "toggleHelp" }
  /**
   * Escape with the panel open. The same press has always cancelled the
   * gesture too (unless text is being edited), so the command carries that.
   */
  | { type: "closeHelp"; cancelGesture: boolean }
  | { type: "panHold" }
  | { type: "panRelease" }
  | { type: "snapHold" }
  | { type: "snapRelease" };

export type CommandType = Command["type"];

/**
 * When the root handler calls preventDefault. "ifHandled": only when the
 * command reports it did something, so Ctrl+C with nothing selected still
 * copies page text.
 */
export const PREVENT_DEFAULT: Record<CommandType, boolean | "ifHandled"> = {
  undo: true,
  redo: true,
  copy: "ifHandled",
  cut: true,
  paste: true,
  delete: true,
  fontStep: true,
  cancelGesture: false,
  toggleHelp: true,
  closeHelp: true,
  panHold: true,
  panRelease: false,
  snapHold: false,
  snapRelease: false,
};

/** One row of the help panel. */
export interface HelpRow {
  id: string;
  label: string;
  keys: string[];
  /** Alternate chord shown after `/` (e.g. Ctrl+Y redo on Windows/Linux). */
  altKeys?: string[];
}

interface ShortcutDef {
  id: string;
  /** Help panel row; omitted for keys the panel doesn't list (Escape). */
  help?: {
    label: string;
    keys: (isApple: boolean) => string[];
    altKeys?: (isApple: boolean) => string[] | undefined;
  };
  /** Key binding; omitted for display-only rows (pointer gestures). */
  resolve?: (event: KeyEventLike, ctx: ShortcutContext) => Command | null;
}

const modLabel = (isApple: boolean) => (isApple ? "⌘" : "Ctrl");
const isKeyUp = (e: KeyEventLike) => e.type === "keyup";

/**
 * Ctrl/Cmd chord (no Alt) on keydown. Canvas commands are off while the
 * inline text editor is open; the textarea handles its own keys.
 */
function modChord(e: KeyEventLike, ctx: ShortcutContext): boolean {
  return (
    !isKeyUp(e) && !ctx.editingText && (e.metaKey || e.ctrlKey) && !e.altKey
  );
}

/** Ctrl/Cmd + `letter`, any Shift state (case-insensitive key). */
function modLetter(
  letter: string,
  command: Command,
): (e: KeyEventLike, ctx: ShortcutContext) => Command | null {
  return (e, ctx) =>
    modChord(e, ctx) && e.key.toLowerCase() === letter ? command : null;
}

/** Help-panel key `?`, typed with no command modifier. */
function isQuestionMark(e: KeyEventLike): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  return e.key === "?" || (e.key === "/" && e.shiftKey);
}

/**
 * Every shortcut, in help-panel order. Key rows resolve in this order too;
 * the first row that returns a command wins.
 */
export const SHORTCUTS: readonly ShortcutDef[] = [
  { id: "pan-scroll", help: { label: "Pan canvas", keys: () => ["Two-finger scroll"] } },
  { id: "zoom-pinch", help: { label: "Zoom (trackpad)", keys: () => ["Pinch"] } },
  { id: "zoom-ctrl-scroll", help: { label: "Zoom (fine)", keys: () => ["Ctrl", "scroll"] } },
  { id: "zoom-wheel", help: { label: "Zoom (mouse)", keys: () => ["Scroll wheel"] } },
  {
    id: "pan-space",
    help: { label: "Pan canvas", keys: () => ["Space", "drag"] },
    // Held state: press starts it, release (always honoured) ends it.
    resolve: (e, ctx) => {
      if (e.code !== "Space") return null;
      if (isKeyUp(e)) return { type: "panRelease" };
      return e.repeat || ctx.editingText ? null : { type: "panHold" };
    },
  },
  { id: "multi-select", help: { label: "Multi-select", keys: () => ["Shift", "click"] } },
  { id: "box-select", help: { label: "Box select", keys: () => ["Drag empty"] } },
  { id: "box-select-add", help: { label: "Add to box selection", keys: () => ["Shift", "drag"] } },
  {
    id: "snap-shift",
    help: { label: "Straight arrow/line (22.5°)", keys: () => ["Shift"] },
    resolve: (e, ctx) => {
      if (e.key !== "Shift") return null;
      if (isKeyUp(e)) return { type: "snapRelease" };
      return e.repeat || ctx.editingText ? null : { type: "snapHold" };
    },
  },
  {
    id: "copy",
    help: { label: "Copy", keys: (a) => [modLabel(a), "C"] },
    resolve: modLetter("c", { type: "copy" }),
  },
  {
    id: "cut",
    help: { label: "Cut", keys: (a) => [modLabel(a), "X"] },
    // Without a selection the key is left alone (page cut still works).
    resolve: (e, ctx) =>
      ctx.hasSelection && modChord(e, ctx) && e.key.toLowerCase() === "x"
        ? { type: "cut" }
        : null,
  },
  {
    id: "paste",
    help: { label: "Paste", keys: (a) => [modLabel(a), "V"] },
    resolve: modLetter("v", { type: "paste" }),
  },
  {
    id: "undo",
    help: { label: "Undo", keys: (a) => [modLabel(a), "Z"] },
    resolve: (e, ctx) =>
      modChord(e, ctx) && !e.shiftKey && e.key.toLowerCase() === "z"
        ? { type: "undo" }
        : null,
  },
  {
    id: "redo",
    help: {
      label: "Redo",
      keys: (a) => [modLabel(a), "Shift", "Z"],
      altKeys: (a) => (a ? undefined : ["Ctrl", "Y"]),
    },
    resolve: (e, ctx) => {
      if (!modChord(e, ctx)) return null;
      const key = e.key.toLowerCase();
      if (key === "z" && e.shiftKey) return { type: "redo" };
      // Ctrl+Y is redo on Windows/Linux only; ⌘Y / Ctrl+Y mean nothing on Apple.
      if (key === "y" && !e.metaKey && !ctx.isApple) return { type: "redo" };
      return null;
    },
  },
  {
    id: "delete",
    help: { label: "Delete selection", keys: () => ["Del"], altKeys: () => ["Backspace"] },
    resolve: (e, ctx) =>
      !isKeyUp(e) &&
      !ctx.editingText &&
      ctx.hasSelection &&
      (e.code === "Delete" || e.code === "Backspace")
        ? { type: "delete" }
        : null,
  },
  { id: "edit-text", help: { label: "Edit text", keys: () => ["2× click"] } },
  {
    id: "font-step",
    help: {
      label: "Text size up / down",
      keys: (a) => [modLabel(a), "Shift", ">"],
      altKeys: () => ["<"],
    },
    // By code, so the shifted glyph (and keyboard layout) doesn't matter.
    resolve: (e, ctx) => {
      if (!modChord(e, ctx) || !e.shiftKey) return null;
      if (e.code === "Period") return { type: "fontStep", direction: 1 };
      if (e.code === "Comma") return { type: "fontStep", direction: -1 };
      return null;
    },
  },
  {
    id: "toggle-help",
    help: { label: "Toggle this panel", keys: () => ["?"] },
    resolve: (e) =>
      !isKeyUp(e) && isQuestionMark(e) ? { type: "toggleHelp" } : null,
  },
  // Escape: closing the panel comes first and also cancels the gesture.
  {
    id: "close-help",
    resolve: (e, ctx) =>
      !isKeyUp(e) &&
      ctx.helpOpen &&
      e.key === "Escape" &&
      !(e.metaKey || e.ctrlKey || e.altKey)
        ? { type: "closeHelp", cancelGesture: !ctx.editingText }
        : null,
  },
  {
    id: "cancel-gesture",
    resolve: (e, ctx) =>
      !isKeyUp(e) && !ctx.editingText && e.code === "Escape"
        ? { type: "cancelGesture" }
        : null,
  },
];

/** The command `event` runs in `ctx`, or null when the editor ignores it. */
export function resolveShortcut(
  event: KeyEventLike,
  ctx: ShortcutContext,
): Command | null {
  for (const shortcut of SHORTCUTS) {
    const command = shortcut.resolve?.(event, ctx);
    if (command) return command;
  }
  return null;
}

/** Help panel rows for the platform, from the same table the keys use. */
export function helpRows(isApple: boolean): HelpRow[] {
  const rows: HelpRow[] = [];
  for (const { id, help } of SHORTCUTS) {
    if (!help) continue;
    const altKeys = help.altKeys?.(isApple);
    rows.push({
      id,
      label: help.label,
      keys: help.keys(isApple),
      ...(altKeys ? { altKeys } : {}),
    });
  }
  return rows;
}

/** Best-effort Apple platform check; false outside a browser. */
export function isApplePlatform(): boolean {
  const nav = (globalThis as {
    navigator?: { userAgent?: string; userAgentData?: { platform?: string } };
  }).navigator;
  if (!nav) return false;
  const hint = nav.userAgentData?.platform ?? nav.userAgent ?? "";
  return /mac|iphone|ipad|ipod/i.test(hint);
}

// ── Key ownership ──

/** The parts of an event target the ownership rules read. */
export interface KeyTargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
}

type KeyTarget = KeyTargetLike | EventTarget | null | undefined;

const asTarget = (target: KeyTarget) => (target ?? {}) as KeyTargetLike;

/** input, textarea, select, or contenteditable: typing goes to it. */
export function isTextEntry(target: KeyTarget): boolean {
  const t = asTarget(target);
  const tag = t.tagName?.toUpperCase();
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    t.isContentEditable === true
  );
}

/** button or [role=button]: Space and Enter activate it. */
export function isButtonLike(target: KeyTarget): boolean {
  const t = asTarget(target);
  return (
    t.tagName?.toUpperCase() === "BUTTON" ||
    t.getAttribute?.("role") === "button"
  );
}

/**
 * Keys the focused element keeps for itself. The editor never claims these.
 * First matching row wins; no row → the editor may claim any key.
 */
const TARGET_OWNS_KEYS: readonly {
  name: string;
  match: (target: KeyTarget) => boolean;
  keys: "all" | readonly string[];
}[] = [
  { name: "text entry", match: isTextEntry, keys: "all" },
  { name: "button", match: isButtonLike, keys: ["Space", "Enter"] },
];

/** True when the element the key was typed in keeps `code` for itself. */
export function targetOwnsKey(target: KeyTarget, code: string): boolean {
  const row = TARGET_OWNS_KEYS.find((r) => r.match(target));
  if (!row) return false;
  return row.keys === "all" || row.keys.includes(code);
}
