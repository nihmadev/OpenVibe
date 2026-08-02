import type React from "react";
import { useEffect } from "react";
import { Titlebar } from "@/shell/Titlebar/Titlebar";
import { useI18n } from "../../i18n/useI18n";
import { preloadAll } from "../../lib/preloader";
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
