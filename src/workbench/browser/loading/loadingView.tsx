import type React from "react";
import { useEffect } from "react";
import { Loader } from "@/base/browser/ui/loader/loader";
import { Titlebar } from "@/workbench/browser/parts/titlebar/titlebar";
import { preloadAll } from "../../../base/browser/preloader";
import "./loadingView.css";

export function Loading(): React.ReactElement {
  useEffect(() => {
    preloadAll();
  }, []);

  return (
    <div className="loading">
      <Titlebar />
      <div className="loading__busy">
        <Loader />
      </div>
    </div>
  );
}
