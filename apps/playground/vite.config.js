import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {
  repoRoot,
  workspacePackageAliases,
} from "../vite.workspace.js";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Force a single React copy across workspace packages.
    dedupe: ["react", "react-dom"],
    alias: workspacePackageAliases,
  },
  server: {
    fs: {
      // Allow importing package sources outside apps/playground.
      allow: [repoRoot],
    },
  },
  // Keep workspace packages out of the prebundle so source edits HMR cleanly.
  optimizeDeps: {
    exclude: ["@scribblesvg/core", "@scribblesvg/react-utils"],
  },
});
