import {
  MousePointer2,
  Square,
  Circle,
  Cylinder,
  Diamond,
  Minus,
  Type,
  ArrowUpRight,
} from "lucide-react";
import { parseIconSvg, type DiagramIcon } from "../icons";
import type { ToolType } from "./useCanvasReducer";

interface ToolbarProps {
  activeTool: ToolType;
  activeIconId: string | null;
  /** Valid catalog icons to expose as placement tools (SVG previews). */
  catalogIcons?: DiagramIcon[];
  onToolChange: (tool: ToolType, activeIconId?: string | null) => void;
}

const BUILTIN_TOOLS: {
  type: Exclude<ToolType, "icon">;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: "select", label: "Select", Icon: MousePointer2 },
  { type: "rectangle", label: "Rectangle", Icon: Square },
  { type: "circle", label: "Circle", Icon: Circle },
  { type: "cylinder", label: "Cylinder", Icon: Cylinder },
  { type: "diamond", label: "Diamond", Icon: Diamond },
  { type: "text", label: "Text", Icon: Type },
  { type: "line", label: "Line", Icon: Minus },
  { type: "arrow", label: "Arrow", Icon: ArrowUpRight },
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
}: ToolbarProps) {
  // Shapes before catalog icons; text + connectors after
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
    </div>
  );
}
