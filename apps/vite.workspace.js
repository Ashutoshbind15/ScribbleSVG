import path from "node:path";
import { fileURLToPath } from "node:url";

/** Monorepo root (`apps/` → repo root). */
export const repoRoot = path.resolve(
  fileURLToPath(new URL("..", import.meta.url)),
);

/**
 * Resolve workspace packages to TypeScript/CSS sources so Vite HMR picks up
 * edits without rebuilding `dist/`.
 */
export const workspacePackageAliases = {
  "@scribblesvg/core": path.join(repoRoot, "packages/core/index.ts"),
  "@scribblesvg/react-utils/editor.css": path.join(
    repoRoot,
    "packages/react-utils/src/editor.css",
  ),
  "@scribblesvg/react-utils/editor": path.join(
    repoRoot,
    "packages/react-utils/src/editor/index.ts",
  ),
  "@scribblesvg/react-utils/renderer": path.join(
    repoRoot,
    "packages/react-utils/src/diagram-renderer.tsx",
  ),
  "@scribblesvg/react-utils/colors": path.join(
    repoRoot,
    "packages/react-utils/src/colors.ts",
  ),
  "@scribblesvg/react-utils/icons": path.join(
    repoRoot,
    "packages/react-utils/src/icons.ts",
  ),
};
