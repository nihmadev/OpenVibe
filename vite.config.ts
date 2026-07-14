import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  publicDir: "../public",
  base: "./",
  plugins: [react()],
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
