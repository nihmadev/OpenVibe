import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    settings: {
      react: { version: "18.3" },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react/jsx-key": "error",
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/use-memo": "off",
    },
  },
  {
    ignores: [
      "dist/",
      "src/dist/",
      "node_modules/",
      "target/",
      "src-tauri/target/",
      "src-tauri/gen/",
      "public/monaco-editor/",
      "vscode/",
      "packages/",
      "*.rs",
      "venv_translate/",
    ],
  },
);
