import assert from "node:assert/strict";
import { test } from "node:test";
import {
  handleShortcutKey,
  helpRows,
  isButtonLike,
  isTextEntry,
  resolveShortcut,
  targetOwnsKey,
  type KeyEventLike,
  type Command,
  type KeyTargetLike,
  type ShortcutContext,
} from "../packages/react-utils/src/editor/keymap.ts";

/** A keydown with no modifiers unless overridden. */
function key(
  key: string,
  code: string,
  extra: Partial<KeyEventLike> = {},
): KeyEventLike {
  return {
    type: "keydown",
    key,
    code,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    repeat: false,
    ...extra,
  };
}

const ctx = (extra: Partial<ShortcutContext> = {}): ShortcutContext => ({
  hasSelection: false,
  editingText: false,
  helpOpen: false,
  isApple: false,
  ...extra,
});

const selected = ctx({ hasSelection: true });
const apple = ctx({ isApple: true });
const ctrl = { ctrlKey: true };
const cmd = { metaKey: true };

test("undo: Ctrl/Cmd+Z, not with Alt", () => {
  assert.deepEqual(resolveShortcut(key("z", "KeyZ", ctrl), ctx()), { type: "undo" });
  assert.deepEqual(resolveShortcut(key("z", "KeyZ", cmd), apple), { type: "undo" });
  assert.equal(resolveShortcut(key("z", "KeyZ"), ctx()), null);
  assert.equal(resolveShortcut(key("z", "KeyZ", { ...ctrl, altKey: true }), ctx()), null);
  // Held chord keeps undoing, as before
  assert.deepEqual(
    resolveShortcut(key("z", "KeyZ", { ...ctrl, repeat: true }), ctx()),
    { type: "undo" },
  );
});

test("redo: Ctrl/Cmd+Shift+Z everywhere, Ctrl+Y on non-Apple only", () => {
  const shiftZ = (mods: Partial<KeyEventLike>) => key("Z", "KeyZ", { ...mods, shiftKey: true });
  assert.deepEqual(resolveShortcut(shiftZ(ctrl), ctx()), { type: "redo" });
  assert.deepEqual(resolveShortcut(shiftZ(cmd), apple), { type: "redo" });

  assert.deepEqual(resolveShortcut(key("y", "KeyY", ctrl), ctx()), { type: "redo" });
  assert.equal(resolveShortcut(key("y", "KeyY", ctrl), apple), null);
  assert.equal(resolveShortcut(key("y", "KeyY", cmd), apple), null);
  assert.equal(resolveShortcut(key("y", "KeyY", cmd), ctx()), null);
});

test("copy, cut, paste", () => {
  // Copy resolves without a selection; the handler decides preventDefault
  assert.deepEqual(resolveShortcut(key("c", "KeyC", ctrl), ctx()), { type: "copy" });
  assert.deepEqual(resolveShortcut(key("c", "KeyC", cmd), apple), { type: "copy" });

  // Cut needs a selection, so page cut still works otherwise
  assert.deepEqual(resolveShortcut(key("x", "KeyX", ctrl), selected), { type: "cut" });
  assert.equal(resolveShortcut(key("x", "KeyX", ctrl), ctx()), null);

  assert.deepEqual(resolveShortcut(key("v", "KeyV", ctrl), ctx()), { type: "paste" });
  assert.deepEqual(resolveShortcut(key("V", "KeyV", { ...cmd, shiftKey: true }), apple), {
    type: "paste",
  });

  assert.equal(resolveShortcut(key("c", "KeyC"), ctx()), null);
  assert.equal(resolveShortcut(key("v", "KeyV", { ...ctrl, altKey: true }), ctx()), null);
});

test("delete: Delete or Backspace with a selection", () => {
  assert.deepEqual(resolveShortcut(key("Delete", "Delete"), selected), { type: "delete" });
  assert.deepEqual(resolveShortcut(key("Backspace", "Backspace"), selected), { type: "delete" });
  assert.deepEqual(
    resolveShortcut(key("Backspace", "Backspace", { repeat: true }), selected),
    { type: "delete" },
  );
  assert.equal(resolveShortcut(key("Delete", "Delete"), ctx()), null);
});

test("fontStep: Ctrl/Cmd+Shift+Period/Comma by code", () => {
  const step = (code: string, mods: Partial<KeyEventLike>) =>
    key(code === "Period" ? ">" : "<", code, { ...mods, shiftKey: true });
  assert.deepEqual(resolveShortcut(step("Period", ctrl), ctx()), { type: "fontStep", direction: 1 });
  assert.deepEqual(resolveShortcut(step("Comma", ctrl), ctx()), { type: "fontStep", direction: -1 });
  assert.deepEqual(resolveShortcut(step("Period", cmd), apple), { type: "fontStep", direction: 1 });
  // The glyph doesn't matter (non-US layouts)
  assert.deepEqual(
    resolveShortcut(key(":", "Period", { ...ctrl, shiftKey: true }), ctx()),
    { type: "fontStep", direction: 1 },
  );
  // Needs Shift and the mod key
  assert.equal(resolveShortcut(key(".", "Period", ctrl), ctx()), null);
  assert.equal(resolveShortcut(key(">", "Period", { shiftKey: true }), ctx()), null);
});

test("zoom to fit and reset: Shift+1 / Shift+0 by code, whatever the glyph", () => {
  const fit = { type: "zoomFit" };
  const reset = { type: "zoomReset" };
  // US layout: Shift+1 types "!", Shift+0 types ")"
  assert.deepEqual(resolveShortcut(key("!", "Digit1", { shiftKey: true }), ctx()), fit);
  assert.deepEqual(resolveShortcut(key(")", "Digit0", { shiftKey: true }), ctx()), reset);
  // Other layouts (e.g. AZERTY types the digit itself with Shift)
  assert.deepEqual(resolveShortcut(key("1", "Digit1", { shiftKey: true }), ctx()), fit);
  assert.deepEqual(resolveShortcut(key("=", "Digit0", { shiftKey: true }), selected), reset);
  // On the canvas they block the browser default
  assert.deepEqual(press(key("!", "Digit1", { shiftKey: true }), ctx()), { ran: [fit], prevented: true });
  assert.deepEqual(press(key(")", "Digit0", { shiftKey: true }), ctx()), { ran: [reset], prevented: true });

  // Needs Shift, and no command modifier
  assert.equal(resolveShortcut(key("1", "Digit1"), ctx()), null);
  assert.equal(resolveShortcut(key("!", "Digit1", { shiftKey: true, ...ctrl }), ctx()), null);
  assert.equal(resolveShortcut(key("!", "Digit1", { shiftKey: true, ...cmd }), apple), null);
  assert.equal(resolveShortcut(key("!", "Digit1", { shiftKey: true, altKey: true }), ctx()), null);
  // The numpad and other digits aren't bound
  assert.equal(resolveShortcut(key("End", "Numpad1", { shiftKey: true }), ctx()), null);
  assert.equal(resolveShortcut(key("@", "Digit2", { shiftKey: true }), ctx()), null);
  // Keydown only
  assert.equal(
    resolveShortcut(key("!", "Digit1", { shiftKey: true, type: "keyup" }), ctx()),
    null,
  );
});

test("zoom in / out: Ctrl/Cmd with = or +, and -", () => {
  const zoomIn = { type: "zoomStep", direction: 1 };
  const zoomOut = { type: "zoomStep", direction: -1 };
  assert.deepEqual(resolveShortcut(key("=", "Equal", ctrl), ctx()), zoomIn);
  assert.deepEqual(resolveShortcut(key("+", "Equal", { ...ctrl, shiftKey: true }), ctx()), zoomIn);
  assert.deepEqual(resolveShortcut(key("+", "NumpadAdd", ctrl), ctx()), zoomIn);
  assert.deepEqual(resolveShortcut(key("=", "Equal", cmd), apple), zoomIn);
  assert.deepEqual(resolveShortcut(key("-", "Minus", ctrl), ctx()), zoomOut);
  assert.deepEqual(resolveShortcut(key("_", "Minus", { ...ctrl, shiftKey: true }), ctx()), zoomOut);
  assert.deepEqual(resolveShortcut(key("-", "NumpadSubtract", ctrl), ctx()), zoomOut);
  assert.deepEqual(resolveShortcut(key("-", "Minus", cmd), apple), zoomOut);
  // Held chord keeps stepping, like the browser's page zoom
  assert.deepEqual(resolveShortcut(key("=", "Equal", { ...ctrl, repeat: true }), ctx()), zoomIn);
  // On the canvas they block the browser's page zoom
  assert.deepEqual(press(key("=", "Equal", ctrl), ctx()), { ran: [zoomIn], prevented: true });
  assert.deepEqual(press(key("-", "Minus", ctrl), ctx()), { ran: [zoomOut], prevented: true });

  // Needs the mod key, and no Alt
  assert.equal(resolveShortcut(key("=", "Equal"), ctx()), null);
  assert.equal(resolveShortcut(key("-", "Minus"), ctx()), null);
  assert.equal(resolveShortcut(key("=", "Equal", { ...ctrl, altKey: true }), ctx()), null);
  assert.equal(resolveShortcut(key("0", "Digit0", ctrl), ctx()), null);
});

test("Escape cancels the gesture; with the panel open it also closes the panel", () => {
  assert.deepEqual(resolveShortcut(key("Escape", "Escape"), ctx()), { type: "cancelGesture" });

  assert.deepEqual(resolveShortcut(key("Escape", "Escape"), ctx({ helpOpen: true })), {
    type: "closeHelp",
    cancelGesture: true,
  });

  // The panel ignores Escape with a command modifier; the gesture still cancels
  assert.deepEqual(
    resolveShortcut(key("Escape", "Escape", ctrl), ctx({ helpOpen: true })),
    { type: "cancelGesture" },
  );
});

test("? toggles the help panel, without command modifiers", () => {
  assert.deepEqual(resolveShortcut(key("?", "Slash", { shiftKey: true }), ctx()), {
    type: "toggleHelp",
  });
  assert.deepEqual(resolveShortcut(key("/", "Slash", { shiftKey: true }), ctx()), {
    type: "toggleHelp",
  });
  assert.deepEqual(resolveShortcut(key("?", "Slash", { shiftKey: true }), ctx({ helpOpen: true })), {
    type: "toggleHelp",
  });
  assert.equal(resolveShortcut(key("/", "Slash"), ctx()), null);
  assert.equal(resolveShortcut(key("?", "Slash", { shiftKey: true, ...ctrl }), ctx()), null);
});

test("Space-pan and Shift-snap hold on keydown and release on keyup", () => {
  assert.deepEqual(resolveShortcut(key(" ", "Space"), ctx()), { type: "panHold" });
  assert.equal(resolveShortcut(key(" ", "Space", { repeat: true }), ctx()), null);
  assert.deepEqual(resolveShortcut(key(" ", "Space", { type: "keyup" }), ctx()), {
    type: "panRelease",
  });

  assert.deepEqual(resolveShortcut(key("Shift", "ShiftLeft", { shiftKey: true }), ctx()), {
    type: "snapHold",
  });
  assert.equal(
    resolveShortcut(key("Shift", "ShiftLeft", { shiftKey: true, repeat: true }), ctx()),
    null,
  );
  assert.deepEqual(resolveShortcut(key("Shift", "ShiftRight", { type: "keyup" }), ctx()), {
    type: "snapRelease",
  });
});

test("keyup only releases held keys", () => {
  const up = { type: "keyup" };
  assert.equal(resolveShortcut(key("z", "KeyZ", { ...ctrl, ...up }), ctx()), null);
  assert.equal(resolveShortcut(key("Delete", "Delete", up), selected), null);
  assert.equal(resolveShortcut(key("Escape", "Escape", up), ctx({ helpOpen: true })), null);
  assert.equal(resolveShortcut(key("?", "Slash", { shiftKey: true, ...up }), ctx()), null);
});

test("while text is edited only the help keys and releases resolve", () => {
  const editing = ctx({ editingText: true, hasSelection: true, helpOpen: true });
  for (const event of [
    key("z", "KeyZ", ctrl),
    key("c", "KeyC", ctrl),
    key("Delete", "Delete"),
    key(" ", "Space"),
    key("Shift", "ShiftLeft", { shiftKey: true }),
    key(">", "Period", { ...ctrl, shiftKey: true }),
    key("!", "Digit1", { shiftKey: true }),
    key(")", "Digit0", { shiftKey: true }),
    key("=", "Equal", ctrl),
    key("-", "Minus", ctrl),
  ]) {
    assert.equal(resolveShortcut(event, editing), null, event.code);
  }
  assert.deepEqual(resolveShortcut(key("Escape", "Escape"), editing), {
    type: "closeHelp",
    cancelGesture: false,
  });
  assert.equal(resolveShortcut(key("Escape", "Escape"), ctx({ editingText: true })), null);
  assert.deepEqual(resolveShortcut(key("?", "Slash", { shiftKey: true }), editing), {
    type: "toggleHelp",
  });
  assert.deepEqual(resolveShortcut(key(" ", "Space", { type: "keyup" }), editing), {
    type: "panRelease",
  });
});

test("unbound keys resolve to nothing", () => {
  assert.equal(resolveShortcut(key("a", "KeyA"), selected), null);
  assert.equal(resolveShortcut(key("Control", "ControlLeft", ctrl), selected), null);
  assert.equal(resolveShortcut(key("Enter", "Enter"), selected), null);
});

// ── Key ownership ──

function target(tagName: string, extra: Partial<KeyTargetLike> = {}): KeyTargetLike {
  return { tagName, isContentEditable: false, getAttribute: () => null, ...extra };
}
const withRole = (tagName: string, role: string) =>
  target(tagName, { getAttribute: (name) => (name === "role" ? role : null) });

const ALL_CODES = ["KeyZ", "Backspace", "Delete", "Space", "Enter", "Escape", "Slash"];

test("text entry owns every key", () => {
  for (const t of [
    target("INPUT"),
    target("TEXTAREA"),
    target("SELECT"),
    target("DIV", { isContentEditable: true }),
    target("input"),
  ]) {
    assert.equal(isTextEntry(t), true, String(t.tagName));
    for (const code of ALL_CODES) assert.equal(targetOwnsKey(t, code), true, `${t.tagName} ${code}`);
  }
});

test("buttons own Space and Enter only", () => {
  for (const t of [target("BUTTON"), withRole("DIV", "button"), withRole("span", "button")]) {
    assert.equal(isButtonLike(t), true);
    assert.equal(isTextEntry(t), false);
    for (const code of ALL_CODES) {
      assert.equal(targetOwnsKey(t, code), code === "Space" || code === "Enter", code);
    }
  }
});

test("other targets own no keys", () => {
  const others: (KeyTargetLike | null | undefined)[] = [
    target("DIV"),
    target("svg"),
    withRole("DIV", "dialog"),
    null,
    undefined,
  ];
  for (const t of others) {
    for (const code of ALL_CODES) assert.equal(targetOwnsKey(t, code), false, code);
  }
  // A bare object without the DOM helpers is safe
  assert.equal(targetOwnsKey({}, "Space"), false);
});

// ── Help panel ──

interface Row {
  label: string;
  keys: string[];
  altKeys?: string[];
}

const row = (label: string, keys: string[], altKeys?: string[]): Row =>
  altKeys ? { label, keys, altKeys } : { label, keys };

/** The panel's rows before the keymap existed, verbatim, plus the zoom keys. */
function previousRows(isApple: boolean): Row[] {
  const mod = isApple ? "⌘" : "Ctrl";
  return [
    row("Pan canvas", ["Two-finger scroll"]),
    row("Zoom (trackpad)", ["Pinch"]),
    row("Zoom (fine)", ["Ctrl", "scroll"]),
    row("Zoom (mouse)", ["Scroll wheel"]),
    row("Zoom in / out", [mod, "+"], ["-"]),
    row("Zoom to fit", ["Shift", "1"]),
    row("Zoom to 100%", ["Shift", "0"]),
    row("Pan canvas", ["Space", "drag"]),
    row("Multi-select", ["Shift", "click"]),
    row("Box select", ["Drag empty"]),
    row("Add to box selection", ["Shift", "drag"]),
    row("Straight arrow/line (22.5°)", ["Shift"]),
    row("Copy", [mod, "C"]),
    row("Cut", [mod, "X"]),
    row("Paste", [mod, "V"]),
    row("Undo", [mod, "Z"]),
    row("Redo", [mod, "Shift", "Z"], isApple ? undefined : ["Ctrl", "Y"]),
    row("Delete selection", ["Del"], ["Backspace"]),
    row("Edit text", ["2× click"]),
    row("Text size up / down", [mod, "Shift", ">"], ["<"]),
    row("Toggle this panel", ["?"]),
  ];
}

test("help panel shows the same rows as before, per platform", () => {
  for (const isApple of [false, true]) {
    const rows = helpRows(isApple).map(({ label, keys, altKeys }) =>
      row(label, keys, altKeys),
    );
    assert.deepEqual(rows, previousRows(isApple), `isApple=${isApple}`);
  }
});

test("help rows have unique ids", () => {
  const ids = helpRows(false).map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);
});

function press(
  k: KeyEventLike,
  context: ShortcutContext,
  { from = target("DIV"), handled = true }: { from?: KeyTargetLike; handled?: boolean } = {},
) {
  const ran: Command[] = [];
  let prevented = false;
  handleShortcutKey(
    { ...k, target: from, preventDefault: () => { prevented = true; } },
    context,
    (command) => {
      ran.push(command);
      return handled;
    },
  );
  return { ran, prevented };
}

test("a shortcut on the canvas runs and blocks the browser default", () => {
  assert.deepEqual(press(key("z", "KeyZ", ctrl), ctx()), { ran: [{ type: "undo" }], prevented: true });
  assert.deepEqual(press(key("Backspace", "Backspace"), selected), {
    ran: [{ type: "delete" }],
    prevented: true,
  });
});

test("copy blocks the browser default only when it copied something", () => {
  assert.deepEqual(press(key("c", "KeyC", ctrl), selected, { handled: true }), {
    ran: [{ type: "copy" }],
    prevented: true,
  });
  assert.deepEqual(press(key("c", "KeyC", ctrl), ctx(), { handled: false }), {
    ran: [{ type: "copy" }],
    prevented: false,
  });
});

test("Escape cancels the gesture and leaves the browser default alone", () => {
  assert.deepEqual(press(key("Escape", "Escape"), ctx()), {
    ran: [{ type: "cancelGesture" }],
    prevented: false,
  });
});

test("keys typed in a text field never reach the editor", () => {
  for (const k of [key("Backspace", "Backspace"), key("z", "KeyZ", ctrl), key(" ", "Space")]) {
    assert.deepEqual(press(k, selected, { from: target("INPUT") }), { ran: [], prevented: false });
  }
});

test("Space on a button presses the button; other shortcuts still run there", () => {
  assert.deepEqual(press(key(" ", "Space"), ctx(), { from: target("BUTTON") }), {
    ran: [],
    prevented: false,
  });
  assert.deepEqual(press(key("Delete", "Delete"), selected, { from: target("BUTTON") }), {
    ran: [{ type: "delete" }],
    prevented: true,
  });
});

test("releasing Space ends panning even from a text field, without blocking it", () => {
  assert.deepEqual(press(key(" ", "Space", { type: "keyup" }), ctx(), { from: target("INPUT") }), {
    ran: [{ type: "panRelease" }],
    prevented: false,
  });
});
