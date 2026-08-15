import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  publicDir: "../public",
  base: "./",
  plugins: [react()],
  resolve: {
    // The local @zazaru/ui package has its own development node_modules.
    // Always resolve hooks through the application's React instance; otherwise
    // Radix providers loaded from the linked package receive a second dispatcher.
    dedupe: ["react", "react-dom"],
    alias: [
      { find: "@zazaru/ui/styles.css", replacement: fileURLToPath(new URL("./packages/zazaru-ui/src/styles.css", import.meta.url)) },
      { find: "@zazaru/ui/recipes", replacement: fileURLToPath(new URL("./packages/zazaru-ui/src/recipes/index.ts", import.meta.url)) },
      { find: "@zazaru/ui", replacement: fileURLToPath(new URL("./packages/zazaru-ui/src/index.ts", import.meta.url)) },
      { find: "@zazaru/core", replacement: fileURLToPath(new URL("./packages/zazaru-core/src/index.ts", import.meta.url)) },
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ],
  },
  build: {
    outDir: "../dist/src",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor";
          }
          if (
            id.includes("node_modules/react-markdown") ||
            id.includes("node_modules/react-syntax-highlighter") ||
            id.includes("node_modules/katex") ||
            id.includes("node_modules/remark-gfm") ||
            id.includes("node_modules/remark-math") ||
            id.includes("node_modules/rehype-katex")
          ) {
            return "markdown";
          }
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
  },
});
