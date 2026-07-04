import {
  MousePointer2,
  Square,
  Circle,
  Cylinder,
  Type,
  ArrowUpRight,
} from "lucide-react";
import type { ToolType } from "./useCanvasReducer";

interface ToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

const TOOLS: {
  type: ToolType;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: "select", label: "Select", Icon: MousePointer2 },
  { type: "rectangle", label: "Rectangle", Icon: Square },
  { type: "circle", label: "Circle", Icon: Circle },
  { type: "cylinder", label: "Cylinder", Icon: Cylinder },
  { type: "text", label: "Text", Icon: Type },
  { type: "arrow", label: "Arrow", Icon: ArrowUpRight },
];

/**
 * Horizontal toolbar for selecting the active drawing tool.
 */
export function Toolbar({ activeTool, onToolChange }: ToolbarProps) {
  return (
    <div className="scribblesvg-editor__toolbar">
      {TOOLS.map(({ type, label, Icon }) => (
        <button
          key={type}
          type="button"
          title={label}
          aria-pressed={activeTool === type}
          onClick={() => onToolChange(type)}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}
