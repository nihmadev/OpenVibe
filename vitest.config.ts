import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@zazaru/ui/recipes", replacement: fileURLToPath(new URL("./packages/zazaru-ui/src/recipes/index.ts", import.meta.url)) },
      { find: "@zazaru/ui", replacement: fileURLToPath(new URL("./packages/zazaru-ui/src/index.ts", import.meta.url)) },
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "packages/zazaru-ui/src/**/*.{test,spec}.{ts,tsx}"],
  },
  root: ".",
});
