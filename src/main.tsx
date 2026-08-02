import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import "@/scrollbar.css";
import "@/app/App.css";
import { initFonts } from "@/app/fonts";
import { initZoomConfig, zoomDefault, zoomStep } from "@/app/zoomConfig";
import { windowApi } from "@/infrastructure/tauri/windowApi";

initFonts();
initZoomConfig();

let zoomFactor = zoomDefault;
document.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  if (e.key === "=" || e.key === "+") {
    e.preventDefault();
    zoomFactor = Math.min(3.0, zoomFactor + zoomStep);
    windowApi.zoom(zoomFactor);
  } else if (e.key === "-") {
    e.preventDefault();
    zoomFactor = Math.max(0.2, zoomFactor - zoomStep);
    windowApi.zoom(zoomFactor);
  } else if (e.key === "0") {
    e.preventDefault();
    zoomFactor = zoomDefault;
    windowApi.zoom(zoomFactor);
  }
});

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(<App />);
