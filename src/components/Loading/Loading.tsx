import type React from "react";
import { useEffect } from "react";
import { useI18n } from "../../hooks/useI18n.js";
import { preloadAll } from "../../utils/preloader.js";
import { Titlebar } from "../Titlebar/Titlebar.js";
import "./Loading.css";

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
