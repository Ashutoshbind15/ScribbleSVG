export interface KeyEventLike {
  type: string;
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  repeat: boolean;
}

export interface ShortcutContext {
  hasSelection: boolean;
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
  | { type: "snapRelease" }
  /** Next zoom preset up (1) or down (-1), around the viewport centre. */
  | { type: "zoomStep"; direction: 1 | -1 }
  | { type: "zoomFit" }
  | { type: "zoomReset" };

/**
 * "ifHandled": only when the command did something, so Ctrl+C with nothing
 * selected still copies page text.
 */
const PREVENT_DEFAULT: Record<Command["type"], boolean | "ifHandled"> = {
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
  zoomStep: true,
  zoomFit: true,
  zoomReset: true,
};

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

function modChord(e: KeyEventLike, ctx: ShortcutContext): boolean {
  return (
    !isKeyUp(e) && !ctx.editingText && (e.metaKey || e.ctrlKey) && !e.altKey
  );
}

function modLetter(
  letter: string,
  command: Command,
): (e: KeyEventLike, ctx: ShortcutContext) => Command | null {
  return (e, ctx) =>
    modChord(e, ctx) && e.key.toLowerCase() === letter ? command : null;
}

/**
 * Shift + a digit key, matched by code: Shift+1 types "!" (or another glyph)
 * depending on the layout. Off while text is edited, like other canvas keys.
 */
function shiftDigit(
  digit: string,
  command: Command,
): (e: KeyEventLike, ctx: ShortcutContext) => Command | null {
  return (e, ctx) =>
    !isKeyUp(e) &&
    !ctx.editingText &&
    e.shiftKey &&
    !(e.metaKey || e.ctrlKey || e.altKey) &&
    e.code === `Digit${digit}`
      ? command
      : null;
}

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
    id: "zoom-step",
    help: { label: "Zoom in / out", keys: (a) => [modLabel(a), "+"], altKeys: () => ["-"] },
    // By key: "+" and "=" share a key on US layouts but not on all others.
    resolve: (e, ctx) => {
      if (!modChord(e, ctx)) return null;
      if (e.key === "=" || e.key === "+") return { type: "zoomStep", direction: 1 };
      if (e.key === "-" || e.key === "_") return { type: "zoomStep", direction: -1 };
      return null;
    },
  },
  {
    id: "zoom-fit",
    help: { label: "Zoom to fit", keys: () => ["Shift", "1"] },
    resolve: shiftDigit("1", { type: "zoomFit" }),
  },
  {
    id: "zoom-reset",
    help: { label: "Zoom to 100%", keys: () => ["Shift", "0"] },
    resolve: shiftDigit("0", { type: "zoomReset" }),
  },
  {
    id: "pan-space",
    help: { label: "Pan canvas", keys: () => ["Space", "drag"] },
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

export function isApplePlatform(): boolean {
  const nav = (globalThis as {
    navigator?: { userAgent?: string; userAgentData?: { platform?: string } };
  }).navigator;
  if (!nav) return false;
  const hint = nav.userAgentData?.platform ?? nav.userAgent ?? "";
  return /mac|iphone|ipad|ipod/i.test(hint);
}

export interface KeyTargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
}

type KeyTarget = KeyTargetLike | EventTarget | null | undefined;

const asTarget = (target: KeyTarget) => (target ?? {}) as KeyTargetLike;

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

export function isButtonLike(target: KeyTarget): boolean {
  const t = asTarget(target);
  return (
    t.tagName?.toUpperCase() === "BUTTON" ||
    t.getAttribute?.("role") === "button"
  );
}

/**
 * Keys the focused element keeps for itself. First matching row wins; no row
 * means the editor may claim any key.
 */
const TARGET_OWNS_KEYS: readonly {
  match: (target: KeyTarget) => boolean;
  keys: "all" | readonly string[];
}[] = [
  { match: isTextEntry, keys: "all" },
  { match: isButtonLike, keys: ["Space", "Enter"] },
];

export function targetOwnsKey(target: KeyTarget, code: string): boolean {
  const row = TARGET_OWNS_KEYS.find((r) => r.match(target));
  if (!row) return false;
  return row.keys === "all" || row.keys.includes(code);
}

export interface ShortcutKeyEvent extends KeyEventLike {
  target: KeyTarget;
  preventDefault(): void;
}

/**
 * Runs the command for `event` and prevents the browser default when the
 * editor took the key. `run` returns whether the command did anything.
 */
export function handleShortcutKey(
  event: ShortcutKeyEvent,
  ctx: ShortcutContext,
  run: (command: Command) => boolean,
): void {
  // A release always runs: the key may have gone down on the canvas and come
  // up after focus moved to a button.
  if (!isKeyUp(event) && targetOwnsKey(event.target, event.code)) return;
  const command = resolveShortcut(event, ctx);
  if (!command) return;
  const handled = run(command);
  const prevent = PREVENT_DEFAULT[command.type];
  if (prevent === true || (prevent === "ifHandled" && handled)) {
    event.preventDefault();
  }
}
