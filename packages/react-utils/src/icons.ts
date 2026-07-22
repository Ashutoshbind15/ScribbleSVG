/**
 * Consumer-supplied icon catalog entry.
 * Documents store only `iconId`; pass matching entries via the `icons` prop to render.
 * SVG markup is treated as trusted input from the host app.
 */
export interface DiagramIcon {
  iconId: string;
  /** Inner SVG markup or a full `<svg>…</svg>` string. */
  svg: string;
  label?: string;
  defaultWidth?: number;
  defaultHeight?: number;
}

export type IconRenderMode =
  | { kind: "resolved"; icon: DiagramIcon }
  | { kind: "missing"; iconId: string };

export interface ParsedIconSvg {
  viewBox: string;
  content: string;
}

export interface CatalogPartition {
  valid: DiagramIcon[];
  /** Human-readable reasons for skipped entries. */
  warnings: string[];
}

/**
 * Find a catalog entry by iconId.
 */
export function resolveDiagramIcon(
  icons: DiagramIcon[] | undefined,
  iconId: string,
): DiagramIcon | undefined {
  return icons?.find((i) => i.iconId === iconId);
}

/**
 * Resolve an iconId against a catalog for rendering.
 */
export function getIconRenderMode(
  icons: DiagramIcon[] | undefined,
  iconId: string,
): IconRenderMode {
  const icon = resolveDiagramIcon(icons, iconId);
  if (icon && icon.svg.trim().length > 0) {
    return { kind: "resolved", icon };
  }
  return { kind: "missing", iconId };
}

/**
 * Split a catalog into placeable icons vs invalid entries (for toolbar + warn UI).
 * Skips empty iconId/svg and duplicate iconIds.
 */
export function partitionIconCatalog(
  icons: DiagramIcon[] | undefined,
): CatalogPartition {
  if (!icons || icons.length === 0) {
    return { valid: [], warnings: [] };
  }

  const valid: DiagramIcon[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < icons.length; i++) {
    const entry = icons[i];
    if (!entry) continue;

    const iconId = typeof entry.iconId === "string" ? entry.iconId.trim() : "";
    const svg = typeof entry.svg === "string" ? entry.svg.trim() : "";

    if (!iconId) {
      warnings.push(`icons[${i}]: missing iconId`);
      continue;
    }
    if (!svg) {
      warnings.push(`icons[${i}] (${iconId}): missing svg`);
      continue;
    }
    if (seen.has(iconId)) {
      warnings.push(`icons[${i}] (${iconId}): duplicate iconId`);
      continue;
    }

    seen.add(iconId);
    valid.push({
      ...entry,
      iconId,
      svg,
    });
  }

  return { valid, warnings };
}

/**
 * Normalize catalog SVG markup into viewBox + inner content for nesting.
 * Strips script tags and inline event handlers; host apps should still supply trusted SVG.
 */
export function parseIconSvg(svg: string): ParsedIconSvg | null {
  const trimmed = svg.trim();
  if (!trimmed) return null;

  const sanitized = trimmed
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  const viewBoxMatch = sanitized.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  const viewBox = viewBoxMatch?.[1] ?? "0 0 24 24";

  const innerMatch = sanitized.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/i);
  const content = (innerMatch ? innerMatch[1] : sanitized).trim();
  if (!content) return null;

  return { viewBox, content };
}
