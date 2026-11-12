import { Fragment } from "react";
import { parseIconSvg, type DiagramIcon } from "../icons";
import type { ToolType } from "./useCanvasReducer";
import {
  ArrowIcon,
  CircleIcon,
  CylinderIcon,
  DiamondIcon,
  LineIcon,
  PencilIcon,
  RectangleIcon,
  SelectIcon,
  SmoothingIcon,
  TextIcon,
  type ToolbarIconProps,
} from "./toolbarIcons";

interface ToolbarProps {
  activeTool: ToolType;
  activeIconId: string | null;
  /** Valid catalog icons to expose as placement tools (SVG previews). */
  catalogIcons?: DiagramIcon[];
  onToolChange: (tool: ToolType, activeIconId?: string | null) => void;
  /** Whether pencil strokes are smoothed; the toggle shows while drawing. */
  pencilSmoothing?: boolean;
  onPencilSmoothingChange?: (enabled: boolean) => void;
}

const BUILTIN_TOOLS: {
  type: Exclude<ToolType, "icon">;
  label: string;
  Icon: React.ComponentType<ToolbarIconProps>;
}[] = [
  { type: "select", label: "Select", Icon: SelectIcon },
  { type: "rectangle", label: "Rectangle", Icon: RectangleIcon },
  { type: "circle", label: "Circle", Icon: CircleIcon },
  { type: "cylinder", label: "Cylinder", Icon: CylinderIcon },
  { type: "diamond", label: "Diamond", Icon: DiamondIcon },
  { type: "text", label: "Text", Icon: TextIcon },
  { type: "pencil", label: "Pencil", Icon: PencilIcon },
  { type: "line", label: "Line", Icon: LineIcon },
  { type: "arrow", label: "Arrow", Icon: ArrowIcon },
];

/**
 * Horizontal toolbar for selecting the active drawing tool.
 * Catalog icons appear as SVG-preview buttons after the built-in shape tools.
 */
export function Toolbar({
  activeTool,
  activeIconId,
  catalogIcons = [],
  onToolChange,
  pencilSmoothing,
  onPencilSmoothingChange,
}: ToolbarProps) {
  // Select + shapes before catalog icons; text + connectors after
  const beforeText = BUILTIN_TOOLS.slice(0, 5);
  const afterShapes = BUILTIN_TOOLS.slice(5);

  return (
    <div className="scribblesvg-editor__toolbar">
      {beforeText.map(({ type, label, Icon }) => (
        <button
          key={type}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={activeTool === type}
          onClick={() => onToolChange(type)}
        >
          <Icon />
        </button>
      ))}

      {catalogIcons.map((icon) => {
        const label = icon.label ?? icon.iconId;
        const parsed = parseIconSvg(icon.svg);
        const isActive =
          activeTool === "icon" && activeIconId === icon.iconId;

        return (
          <button
            key={icon.iconId}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => onToolChange("icon", icon.iconId)}
          >
            {parsed ? (
              <span
                className="scribblesvg-editor__toolbar-icon-preview"
                dangerouslySetInnerHTML={{
                  __html: `<svg viewBox="${parsed.viewBox}" width="16" height="16" aria-hidden="true">${parsed.content}</svg>`,
                }}
              />
            ) : (
              <span className="scribblesvg-editor__toolbar-icon-fallback">
                ?
              </span>
            )}
          </button>
        );
      })}

      {afterShapes.map(({ type, label, Icon }) => (
        <Fragment key={type}>
          <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={activeTool === type}
            onClick={() => onToolChange(type)}
          >
            <Icon />
          </button>
          {type === "pencil" &&
            activeTool === "pencil" &&
            pencilSmoothing !== undefined &&
            onPencilSmoothingChange && (
              <button
                type="button"
                className="scribblesvg-editor__toolbar-option"
                title={pencilSmoothing ? "Smoothing on" : "Smoothing off"}
                aria-label="Smooth strokes"
                aria-pressed={pencilSmoothing}
                onClick={() => onPencilSmoothingChange(!pencilSmoothing)}
              >
                <SmoothingIcon />
              </button>
            )}
        </Fragment>
      ))}
    </div>
  );
}
