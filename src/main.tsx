import "./tauri-bridge.js";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App/App.js";
import "./scrollbar.css";
import "./styles/App.css";
import "./types.js";
import { invoke } from "@tauri-apps/api/core";
import { initFonts } from "./fonts.js";

initFonts();

let zoomFactor = 1.2;
document.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  if (e.key === "=" || e.key === "+") {
    e.preventDefault();
    zoomFactor = Math.min(3.0, zoomFactor + 0.2);
    invoke("window_zoom", { factor: zoomFactor });
  } else if (e.key === "-") {
    e.preventDefault();
    zoomFactor = Math.max(0.2, zoomFactor - 0.2);
    invoke("window_zoom", { factor: zoomFactor });
  } else if (e.key === "0") {
    e.preventDefault();
    zoomFactor = 1.2;
    invoke("window_zoom", { factor: zoomFactor });
  }
});

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(<App />);
