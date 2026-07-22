import type { CSSProperties } from "react";
import {
  getContentBounds,
  getElementBounds,
  getElementRoughPaths,
  DEFAULT_SHAPE_LABEL_FONT_SIZE,
  type DiagramDocument,
  type DiagramElement,
} from "@scribblesvg/core";
import {
  resolveDiagramColors,
  type DiagramColorPreset,
  type DiagramColors,
} from "./colors";
import { IconArtwork } from "./editor/IconArtwork";
import type { DiagramIcon } from "./icons";

export type {
  DiagramColors,
  DiagramColorPreset,
  ResolveDiagramColorsOptions,
} from "./colors";
export {
  DEFAULT_DIAGRAM_COLORS,
  DIAGRAM_COLOR_PRESETS,
  resolveDiagramColors,
} from "./colors";
export type { DiagramIcon } from "./icons";

const DIAGRAM_PADDING = 24;
const EMPTY_STATE_WIDTH = 240;
const EMPTY_STATE_HEIGHT = 140;
const LINE_HEIGHT = 1.2;

function renderTextElement(
  element: DiagramElement,
  bounds: ReturnType<typeof getElementBounds>,
  textColor: string,
) {
  if (element.type === "text") {
    const fontSize = element.fontSize ?? 16;
    const lineHeight = fontSize * LINE_HEIGHT;
    const baselineY = element.y + fontSize;

    return (
      <text
        x={element.x}
        y={baselineY}
        fontSize={fontSize}
        fontFamily="'Segoe UI', system-ui, sans-serif"
        fill={textColor}
      >
        {element.text.split("\n").map((line, index) => (
          <tspan key={index} x={element.x} dy={index === 0 ? 0 : lineHeight}>
            {line || "\u00A0"}
          </tspan>
        ))}
      </text>
    );
  }

  if (element.type === "arrow" || !("text" in element) || !element.text) {
    return null;
  }

  const fontSize = element.fontSize ?? DEFAULT_SHAPE_LABEL_FONT_SIZE;
  const lineHeight = fontSize * LINE_HEIGHT;
  const lines = element.text.split("\n");
  const totalHeight = lineHeight * lines.length;
  const startDy = -(totalHeight / 2) + lineHeight / 2;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  return (
    <text
      x={cx}
      y={cy}
      fontSize={fontSize}
      fontFamily="'Segoe UI', system-ui, sans-serif"
      fill={textColor}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {lines.map((line, index) => (
        <tspan key={index} x={cx} dy={index === 0 ? startDy : lineHeight}>
          {line || "\u00A0"}
        </tspan>
      ))}
    </text>
  );
}

export type DiagramRendererProps = {
  document: DiagramDocument;
  /** Consumer icon catalog for resolving `icon` elements by `iconId`. */
  icons?: DiagramIcon[];
  /** Built-in palette to start from. Defaults to theme-aware `inherit`. */
  colorPreset?: DiagramColorPreset;
  /** Override individual colors on top of the preset. */
  colors?: Partial<DiagramColors>;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
};

export function DiagramRenderer({
  document,
  icons,
  colorPreset,
  colors,
  className,
  style,
  "aria-label": ariaLabel,
}: DiagramRendererProps) {
  const resolvedColors = resolveDiagramColors({ preset: colorPreset, colors });
  const contentBounds = getContentBounds(document.elements);
  const bounds =
    contentBounds ?? {
      x: 0,
      y: 0,
      width: EMPTY_STATE_WIDTH,
      height: EMPTY_STATE_HEIGHT,
    };

  const viewBoxX = bounds.x - DIAGRAM_PADDING;
  const viewBoxY = bounds.y - DIAGRAM_PADDING;
  const viewBoxWidth = Math.max(bounds.width + DIAGRAM_PADDING * 2, 1);
  const viewBoxHeight = Math.max(bounds.height + DIAGRAM_PADDING * 2, 1);

  return (
    <svg
      width="100%"
      viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel ?? "Diagram"}
      className={className}
      style={{
        display: "block",
        height: "auto",
        maxWidth: "100%",
        aspectRatio: `${viewBoxWidth} / ${viewBoxHeight}`,
        color: resolvedColors.text,
        ...style,
      }}
    >
      {document.elements.map((element) => {
        const elementBounds = getElementBounds(element);
        const paths = getElementRoughPaths(element);

        return (
          <g key={element.id} data-element-id={element.id}>
            {element.type === "icon" ? (
              <IconArtwork
                iconId={element.iconId}
                bounds={elementBounds}
                icons={icons}
                errorColor={resolvedColors.text}
              />
            ) : (
              paths.map((path, index) => (
                <path
                  key={`${element.id}-${index}`}
                  d={path.d}
                  stroke={resolvedColors.stroke}
                  strokeWidth={path.strokeWidth}
                  fill={
                    path.fill === "none" ? resolvedColors.fill : path.fill
                  }
                />
              ))
            )}
            {renderTextElement(element, elementBounds, resolvedColors.text)}
          </g>
        );
      })}

      {document.elements.length === 0 ? (
        <text
          x={bounds.x + bounds.width / 2}
          y={bounds.y + bounds.height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={resolvedColors.text}
          opacity={resolvedColors.mutedTextOpacity}
        >
          Empty diagram
        </text>
      ) : null}
    </svg>
  );
}
