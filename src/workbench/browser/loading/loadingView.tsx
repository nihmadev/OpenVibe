import type React from "react";
import { useEffect } from "react";
import { Titlebar } from "@/workbench/browser/parts/titlebar/titlebar";
import { preloadAll } from "../../../base/browser/preloader";
import { useI18n } from "../../../platform/localization/localizationService";
import "./loadingView.css";

export function Loading(): React.ReactElement {
  const { t } = useI18n();

  useEffect(() => {
    preloadAll();
  }, []);

  return (
    <div className="loading">
      <Titlebar />
      <div className="loading__busy">
        <div className="loading__dots">
          <span className="loading__busy__dot" />
          <span className="loading__busy__dot" />
          <span className="loading__busy__dot" />
        </div>
        <span>{t("loadingText")}</span>
      </div>
    </div>
  );
}
