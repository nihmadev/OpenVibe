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
        manualChunks: {
          vendor: ["react", "react-dom"],
          markdown: [
            "react-markdown",
            "react-syntax-highlighter",
            "katex",
            "remark-gfm",
            "remark-math",
            "rehype-katex",
          ],
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
