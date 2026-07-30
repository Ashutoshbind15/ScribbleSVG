import {
  generateSeed,
  isConnector,
  type ConnectorElement,
  type DiagramElement,
} from "@scribblesvg/core";

/** Canvas-space nudge applied on each paste so clones don't stack exactly. */
export const PASTE_OFFSET = 20;

const CLIPBOARD_MIME = "scribblesvg/clipboard";

export interface ClipboardPayload {
  type: typeof CLIPBOARD_MIME;
  version: 1;
  elements: DiagramElement[];
}

/** Minimal clipboard surface so this module typechecks without DOM libs. */
type NavigatorClipboard = {
  writeText?: (text: string) => Promise<void>;
  readText?: () => Promise<string>;
};

function getNavigatorClipboard(): NavigatorClipboard | undefined {
  const nav = (globalThis as { navigator?: { clipboard?: NavigatorClipboard } })
    .navigator;
  return nav?.clipboard;
}

/** In-memory clipboard so paste works even without Clipboard API permission. */
let editorClipboard: DiagramElement[] | null = null;

export function getEditorClipboard(): DiagramElement[] | null {
  return editorClipboard ? editorClipboard.map(cloneElement) : null;
}

export function setEditorClipboard(elements: DiagramElement[]): void {
  editorClipboard = elements.map(cloneElement);
}

export function clearEditorClipboard(): void {
  editorClipboard = null;
}

function cloneElement(el: DiagramElement): DiagramElement {
  return structuredClone(el);
}

/**
 * Elements to put on the clipboard for the current selection.
 * Includes selected elements, plus connectors whose both endpoints are selected
 * (so copying two linked shapes keeps the link).
 */
export function collectCopyElements(
  elements: DiagramElement[],
  selectedIds: Set<string>,
): DiagramElement[] {
  if (selectedIds.size === 0) return [];

  const result: DiagramElement[] = [];

  for (const el of elements) {
    if (selectedIds.has(el.id)) {
      result.push(cloneElement(el));
      continue;
    }

    if (
      isConnector(el) &&
      el.startBinding &&
      el.endBinding &&
      selectedIds.has(el.startBinding) &&
      selectedIds.has(el.endBinding)
    ) {
      result.push(cloneElement(el));
    }
  }

  return result;
}

/** Translate an element by (dx, dy) in canvas space. */
export function translateElement<T extends DiagramElement>(
  el: T,
  dx: number,
  dy: number,
): T {
  switch (el.type) {
    case "rectangle":
    case "cylinder":
    case "diamond":
    case "icon":
    case "text":
      return { ...el, x: el.x + dx, y: el.y + dy };
    case "circle":
      return { ...el, cx: el.cx + dx, cy: el.cy + dy };
    case "arrow":
    case "line":
      return {
        ...el,
        startX: el.startX + dx,
        startY: el.startY + dy,
        endX: el.endX + dx,
        endY: el.endY + dy,
      };
  }
}

function remapConnectorBindings(
  connector: ConnectorElement,
  idMap: Map<string, string>,
): ConnectorElement {
  const { startBinding: _start, endBinding: _end, ...rest } = connector;

  const startBinding =
    connector.startBinding && idMap.has(connector.startBinding)
      ? idMap.get(connector.startBinding)
      : undefined;
  const endBinding =
    connector.endBinding && idMap.has(connector.endBinding)
      ? idMap.get(connector.endBinding)
      : undefined;

  return {
    ...rest,
    ...(startBinding !== undefined ? { startBinding } : {}),
    ...(endBinding !== undefined ? { endBinding } : {}),
  } as ConnectorElement;
}

/**
 * Deep-clone clipboard elements with new ids/seeds, remapped bindings, and a
 * paste offset. Bindings that point outside the pasted set are dropped.
 */
export function cloneElementsForPaste(
  elements: DiagramElement[],
  offset: { x: number; y: number } = { x: PASTE_OFFSET, y: PASTE_OFFSET },
): DiagramElement[] {
  const idMap = new Map<string, string>();
  for (const el of elements) {
    idMap.set(el.id, crypto.randomUUID());
  }

  return elements.map((el) => {
    const next = translateElement(
      {
        ...cloneElement(el),
        id: idMap.get(el.id)!,
        seed: generateSeed(),
      },
      offset.x,
      offset.y,
    );

    if (!isConnector(next)) return next;
    return remapConnectorBindings(next, idMap);
  });
}

export function serializeClipboard(elements: DiagramElement[]): string {
  const payload: ClipboardPayload = {
    type: CLIPBOARD_MIME,
    version: 1,
    elements,
  };
  return JSON.stringify(payload);
}

export function parseClipboard(raw: string): DiagramElement[] | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ClipboardPayload>;
    if (
      parsed?.type !== CLIPBOARD_MIME ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.elements)
    ) {
      return null;
    }
    return parsed.elements as DiagramElement[];
  } catch {
    return null;
  }
}

/** Best-effort write to the system clipboard (ignored if unavailable). */
export function writeSystemClipboard(elements: DiagramElement[]): void {
  const clipboard = getNavigatorClipboard();
  if (!clipboard?.writeText) return;
  void clipboard.writeText(serializeClipboard(elements)).catch(() => {
    // Permission denied or insecure context — in-memory clipboard still works.
  });
}

/** Read ScribbleSVG payload from the system clipboard, if present. */
export async function readSystemClipboard(): Promise<DiagramElement[] | null> {
  const clipboard = getNavigatorClipboard();
  if (!clipboard?.readText) return null;
  try {
    const text = await clipboard.readText();
    return parseClipboard(text);
  } catch {
    return null;
  }
}
