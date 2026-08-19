import type React from "react";
import { useI18n } from "@/platform/localization/localizationService";
import { Titlebar } from "@/workbench/browser/parts/titlebar/titlebar";
import "./fatalErrorView.css";

interface FatalErrorProps {
  error: string;
}

export function FatalError({ error }: FatalErrorProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="fatal-error">
      <Titlebar />
      <div className="fatal-error__body">
        <div className="fatal-error__title">{t("fatalErrorTitle")}</div>
        <div className="fatal-error__message">{error}</div>
        <div className="fatal-error__hint">{t("fatalErrorHint")}</div>
      </div>
    </div>
  );
}
