import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type React from "react";
import { ChevronRightIcon, ToolGlyph } from "@/base/browser/ui/icons/iconRegistry";
import { useI18n } from "@/platform/localization/localizationService";
import type { HistoryItem } from "@/workbench/common/conversation";
import { AnimatedSummary } from "./animatedSummary";
import { useToolDisclosure } from "./useToolDisclosure";

const DISCLOSURE_TRANSITION = { duration: 0.3, ease: [0.4, 0, 0.2, 1] } as const;

interface BrowserResult {
  action?: string;
  url?: string;
  target?: string;
  durationMs?: number;
  outline?: string[];
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function safeResult(item: HistoryItem): BrowserResult {
  if (!item.text || item.ok !== true) return {};
  try {
    const value = record(JSON.parse(item.text));
    if (!value) return {};
    const snapshot = record(record(value.result)?.snapshot);
    const outline = Array.isArray(snapshot?.outline)
      ? snapshot.outline.filter((line): line is string => typeof line === "string")
      : undefined;
    return {
      action: typeof value.action === "string" ? value.action : undefined,
      url: typeof value.url === "string" ? value.url : undefined,
      target: typeof value.target === "string" ? value.target : undefined,
      durationMs: typeof value.durationMs === "number" ? value.durationMs : undefined,
      outline,
    };
  } catch {
    return {};
  }
}

function stringArg(item: HistoryItem, key: "url" | "ref"): string {
  if (!item.toolArgs || typeof item.toolArgs !== "object") return "";
  const value = (item.toolArgs as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function languageLocale(language: string): string {
  const locales: Record<string, string> = {
    Russian: "ru",
    English: "en",
    Ukrainian: "uk",
    Belarusian: "be",
    German: "de",
    French: "fr",
    Spanish: "es",
    Chinese: "zh-CN",
    Japanese: "ja",
  };
  return locales[language] ?? "en";
}

export function localeAwareList(parts: string[], locale: string): string {
  if (parts.length < 2) return parts[0] ?? "";
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(parts);
  } catch {
    return parts.join(", ");
  }
}

function activeLabel(
  item: HistoryItem,
  t: (key: string, params?: Record<string, string | number | boolean>) => string,
) {
  const result = safeResult(item);
  const target = result.target || stringArg(item, "url") || stringArg(item, "ref") || "…";
  switch (item.toolName) {
    case "browser_open":
      return t("browserActivityOpen", { target });
    case "browser_navigate":
      return t("browserActivityNavigate", { target });
    case "browser_click":
      return t("browserActivityClick", { target });
    case "browser_fill":
    case "browser_type":
      return t("browserActivityFill", { target });
    default:
      return t("browserActivityVerify");
  }
}

function completedLabel(
  items: HistoryItem[],
  t: (key: string, params?: Record<string, string | number | boolean>) => string,
  locale: string,
) {
  const opened = items.some((item) => item.toolName === "browser_open" || item.toolName === "browser_navigate");
  const actionNames = new Set([
    "browser_click",
    "browser_fill",
    "browser_type",
    "browser_press",
    "browser_hover",
    "browser_scroll",
    "browser_back",
    "browser_forward",
    "browser_tabs",
  ]);
  const actions = items.filter((item) => actionNames.has(item.toolName ?? "") && item.ok === true).length;
  const verified = items.some((item) => item.ok === true);
  const parts: string[] = [];
  if (opened) parts.push(t("browserSummaryOpened"));
  if (actions > 0) parts.push(t("browserSummaryActions", { count: actions }));
  if (verified) parts.push(t("browserSummaryVerified"));
  const summary = localeAwareList(parts, locale);
  return summary ? summary.charAt(0).toLocaleUpperCase(locale) + summary.slice(1) : t("browserActivityVerify");
}

export function BrowserActivityGroup({
  items,
  runActive,
}: {
  items: HistoryItem[];
  runActive: boolean;
}): React.ReactElement {
  const { t, lang } = useI18n();
  const reducedMotion = useReducedMotion();
  const liveItem = [...items].reverse().find((item) => item.ok === undefined) ?? items.at(-1)!;
  const isRunning = runActive && items.some((item) => item.ok === undefined);
  const { open, toggle } = useToolDisclosure(`browser-group:${items[0]!.id}`, {
    isRunning,
    autoCollapseOnComplete: true,
  });
  const summary = isRunning ? activeLabel(liveItem, t) : completedLabel(items, t, languageLocale(lang));

  return (
    <div className={`agent-activity-group agent-activity-group--browser${open ? " agent-activity-group--open" : ""}`}>
      <button type="button" className="agent-activity-group__row" aria-expanded={open} onClick={toggle}>
        <span className={`tool__icon${isRunning ? " tool__icon--shimmer" : ""}`}>
          <ToolGlyph
            name="browser_open"
            state={items.some((item) => item.ok === false) ? "error" : isRunning ? "pending" : "ok"}
          />
        </span>
        <AnimatedSummary
          contentKey={isRunning ? liveItem.id : `complete:${summary}`}
          enabled={isRunning}
          primary={<span className="agent-activity-group__summary">{summary}</span>}
        />
        <span className="agent-activity-group__chevron">
          <ChevronRightIcon open={open} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="agent-activity-group__details-wrap"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : DISCLOSURE_TRANSITION}
          >
            <div className="agent-activity-group__details">
              {items.map((item) => {
                const result = safeResult(item);
                const ref = stringArg(item, "ref");
                return (
                  <div className="agent-activity-group__detail" key={item.id}>
                    <div>
                      <span>{t("browserDetailAction")}</span>
                      <code>{result.action ?? item.toolName?.replace("browser_", "")}</code>
                    </div>
                    {result.url ? (
                      <div>
                        <span>{t("browserDetailUrl")}</span>
                        <code>{result.url}</code>
                      </div>
                    ) : null}
                    {result.target || ref ? (
                      <div>
                        <span>{t("browserDetailTarget")}</span>
                        <code>{result.target || ref}</code>
                      </div>
                    ) : null}
                    {result.durationMs !== undefined ? (
                      <div>
                        <span>{t("browserDetailDuration")}</span>
                        <code>{result.durationMs} ms</code>
                      </div>
                    ) : null}
                    <div>
                      <span>{t("browserDetailResult")}</span>
                      <code>{item.ok === false ? "error" : item.ok === true ? "ok" : "running"}</code>
                    </div>
                    {item.toolName === "browser_snapshot" && result.outline?.length ? (
                      <pre className="agent-activity-group__outline">{result.outline.join("\n")}</pre>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
