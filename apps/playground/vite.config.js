import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // pnpm can nest a second React under react-utils/lucide; force one copy.
    dedupe: ["react", "react-dom"],
  },
  // Keep workspace packages out of the prebundle so dist rebuilds are picked up.
  optimizeDeps: {
    exclude: ["@scribblesvg/core", "@scribblesvg/react-utils"],
  },
});
