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
    <div className="flex items-center gap-1 rounded-lg border bg-background p-1 shadow-sm">
      {TOOLS.map(({ type, label, Icon }) => {
        const isActive = activeTool === type;
        return (
          <button
            key={type}
            type="button"
            title={label}
            onClick={() => onToolChange(type)}
            className={`
              inline-flex items-center justify-center rounded-md p-2 text-sm
              transition-colors
              ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }
            `}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
