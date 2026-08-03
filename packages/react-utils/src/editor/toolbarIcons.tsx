/**
 * In-house toolbar icons: simple geometric SVGs.
 */

import type { ReactNode } from "react";

export type ToolbarIconProps = {
  className?: string;
};

function IconBase({
  className,
  children,
}: ToolbarIconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Select — right-pointing triangle */
export function SelectIcon({ className }: ToolbarIconProps) {
  return (
    <IconBase className={className}>
      <polygon points="7,4 7,20 19,12" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function RectangleIcon({ className }: ToolbarIconProps) {
  return (
    <IconBase className={className}>
      <rect x="4" y="4" width="16" height="16" />
    </IconBase>
  );
}

export function CircleIcon({ className }: ToolbarIconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="7.5" />
    </IconBase>
  );
}

/** Cylinder — top ellipse + vertical sides + bottom half-ellipse. */
export function CylinderIcon({ className }: ToolbarIconProps) {
  return (
    <IconBase className={className}>
      <ellipse cx="12" cy="5.5" rx="6.5" ry="2.5" />
      <line x1="5.5" y1="5.5" x2="5.5" y2="16.5" />
      <line x1="18.5" y1="5.5" x2="18.5" y2="16.5" />
      <path d="M5.5 16.5 A6.5 2.5 0 0 0 18.5 16.5" />
    </IconBase>
  );
}

export function DiamondIcon({ className }: ToolbarIconProps) {
  return (
    <IconBase className={className}>
      <polygon points="12,2.5 21.5,12 12,21.5 2.5,12" />
    </IconBase>
  );
}

/** Text — capital T. */
export function TextIcon({ className }: ToolbarIconProps) {
  return (
    <IconBase className={className}>
      <line x1="4" y1="5" x2="20" y2="5" />
      <line x1="12" y1="5" x2="12" y2="20" />
    </IconBase>
  );
}

export function LineIcon({ className }: ToolbarIconProps) {
  return (
    <IconBase className={className}>
      <line x1="3" y1="12" x2="21" y2="12" />
    </IconBase>
  );
}

/** Arrow — diagonal shaft + two head segments. */
export function ArrowIcon({ className }: ToolbarIconProps) {
  return (
    <IconBase className={className}>
      <line x1="5" y1="19" x2="19" y2="5" />
      <line x1="11" y1="5" x2="19" y2="5" />
      <line x1="19" y1="5" x2="19" y2="13" />
    </IconBase>
  );
}

export function MinusIcon({ className }: ToolbarIconProps) {
  return (
    <IconBase className={className}>
      <line x1="4" y1="12" x2="20" y2="12" />
    </IconBase>
  );
}

export function PlusIcon({ className }: ToolbarIconProps) {
  return (
    <IconBase className={className}>
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </IconBase>
  );
}

export function CloseIcon({ className }: ToolbarIconProps) {
  return (
    <IconBase className={className}>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </IconBase>
  );
}

/** Undo — open circular arc + L-shaped tip. */
export function UndoIcon({ className }: ToolbarIconProps) {
  return (
    <IconBase className={className}>
      <path d="M8 6 H4 V2" />
      <path d="M4 6 A7.5 7.5 0 1 1 4 16.5" />
    </IconBase>
  );
}

/** Redo — mirror of undo. */
export function RedoIcon({ className }: ToolbarIconProps) {
  return (
    <IconBase className={className}>
      <path d="M16 6 H20 V2" />
      <path d="M20 6 A7.5 7.5 0 1 0 20 16.5" />
    </IconBase>
  );
}

/** Keyboard — body + three discrete key marks + space bar. */
export function KeyboardIcon({ className }: ToolbarIconProps) {
  return (
    <IconBase className={className}>
      <rect x="2.5" y="6.5" width="19" height="11" rx="1.5" />
      <rect x="5" y="9" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="9" y="9" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="13" y="9" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="17" y="9" width="2" height="2" fill="currentColor" stroke="none" />
      <line x1="6" y1="14.5" x2="18" y2="14.5" />
    </IconBase>
  );
}
