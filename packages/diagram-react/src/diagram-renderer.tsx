import {
  getContentBounds,
  getElementBounds,
  getElementRoughPaths,
  DEFAULT_SHAPE_LABEL_FONT_SIZE,
  type DiagramDocument,
  type DiagramElement,
} from "@packages/diagram";

const DIAGRAM_PADDING = 24;
const EMPTY_STATE_WIDTH = 240;
const EMPTY_STATE_HEIGHT = 140;
const LINE_HEIGHT = 1.2;

function renderTextElement(element: DiagramElement, bounds: ReturnType<typeof getElementBounds>) {
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
        fill="currentColor"
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
      fill="currentColor"
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

export function DiagramRenderer({ document }: { document: DiagramDocument }) {
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
    <div className="overflow-hidden rounded-lg border border-border bg-background p-4">
      <svg
        width="100%"
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Diagram"
        className="block h-auto w-full text-foreground"
        style={{ aspectRatio: `${viewBoxWidth} / ${viewBoxHeight}` }}
      >
        {document.elements.map((element) => {
          const bounds = getElementBounds(element);
          const paths = getElementRoughPaths(element);

          return (
            <g key={element.id} data-element-id={element.id}>
              {paths.map((path, index) => (
                <path
                  key={`${element.id}-${index}`}
                  d={path.d}
                  stroke={path.stroke}
                  strokeWidth={path.strokeWidth}
                  fill={path.fill}
                />
              ))}
              {renderTextElement(element, bounds)}
            </g>
          );
        })}

        {document.elements.length === 0 ? (
          <text
            x={bounds.x + bounds.width / 2}
            y={bounds.y + bounds.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="currentColor"
            opacity="0.55"
          >
            Empty diagram
          </text>
        ) : null}
      </svg>
    </div>
  );
}
