import type React from "react";
import { useMemo } from "react";
import {
  AlertTriangleIcon,
  ChevronDownStrokeIcon,
  GaugeIcon,
  type IconComponent,
  RotateCcwIcon,
  ShieldAlertIcon,
  WifiOffIcon,
} from "@/base/browser/ui/icons/iconRegistry";
import { useI18n } from "@/platform/localization/localizationService";
import "./errorNotice.css";

type ErrorKind = "network" | "quota" | "blocked" | "provider";

function classifyError(message: string): ErrorKind {
  const value = message.toLowerCase();
  if (/quota|rate.?limit|too many requests|429|billing|credits|tokens? limit/.test(value)) return "quota";
  if (/ip|forbidden|blocked|access denied|region|location|cloudflare|451|403/.test(value)) return "blocked";
  if (/network|timeout|timed? out|connection|connect|dns|socket|fetch failed|offline|unreachable/.test(value)) {
    return "network";
  }
  return "provider";
}

const iconFor: Record<ErrorKind, IconComponent> = {
  network: WifiOffIcon,
  quota: GaugeIcon,
  blocked: ShieldAlertIcon,
  provider: AlertTriangleIcon,
};

export function ErrorNotice({ text, onRetry }: { text: string; onRetry?: () => void }): React.ReactElement {
  const { t } = useI18n();
  const kind = useMemo(() => classifyError(text), [text]);
  const Icon = iconFor[kind];
  const title = t(`errorNotice${kind[0]?.toUpperCase()}${kind.slice(1)}Title`);

  return (
    <section className={`error-notice error-notice--${kind}`} role="alert">
      <div className="error-notice__icon">
        <Icon size={18} strokeWidth={2} aria-hidden={true} />
      </div>
      <div className="error-notice__body">
        <details className="error-notice__details">
          <summary>
            <span className="error-notice__title">{title}</span>
            <ChevronDownStrokeIcon className="error-notice__chevron" size={14} aria-hidden="true" />
          </summary>
          <div className="error-notice__message">{text}</div>
        </details>
      </div>
      {onRetry && (
        <button className="error-notice__retry" type="button" onClick={onRetry}>
          <RotateCcwIcon size={14} aria-hidden={true} /> {t("retry")}
        </button>
      )}
    </section>
  );
}
