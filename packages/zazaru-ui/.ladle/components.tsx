import type { GlobalProvider } from "@ladle/react";
import "../src/styles.css";

export const Provider: GlobalProvider = ({ children, globalState }) => <div data-z-theme={globalState.theme === "light" ? "light" : "dark"} data-z-density="comfortable" style={{ minHeight: "100vh", padding: 24, background: "var(--z-color-canvas)", color: "var(--z-color-text)" }}>{children}</div>;
