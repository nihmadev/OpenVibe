import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { BrainIcon, ChevronRightIcon } from "@/base/browser/ui/icons/iconRegistry";
import { useI18n } from "@/platform/localization/localizationService";
import type { HistoryItem } from "@/workbench/common/conversation";
import { Markdown } from "../../../../../browser/parts/editor/markdown/markdown";

// ZCode Reasoning block: brain icon + "Thinking…" while streaming, then a
// collapsible "Thought for N seconds" that auto-collapses when the stream ends
// unless the user interacted with it.
const COLLAPSE_TRANSITION = { duration: 0.3, ease: [0.4, 0, 0.2, 1] } as const;

export function ReasoningBlock({ item, isActive }: { item: HistoryItem; isActive: boolean }): React.ReactElement {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const isStreaming = isActive && item.reasoningDone !== true;
  const [open, setOpen] = useState(isStreaming);
  const userInteracted = useRef(false);
  const startedAt = useRef<number | null>(null);
  // null = never measured in this session (restored history) → plain "Thought".
  const [durationSec, setDurationSec] = useState<number | null>(null);

  useEffect(() => {
    if (isStreaming) {
      startedAt.current ??= Date.now();
    } else if (startedAt.current !== null) {
      const elapsed = Math.round((Date.now() - startedAt.current!) / 1000);
      startedAt.current = null;
      setDurationSec(elapsed);
      if (!userInteracted.current) setOpen(false);
    }
  }, [isStreaming]);

  const durationLabel =
    durationSec === null
      ? ""
      : durationSec >= 1
        ? t("reasoningForSeconds", { seconds: durationSec })
        : t("reasoningForFewSeconds");
  const label = isStreaming
    ? t("reasoningThinking")
    : durationLabel
      ? `${t("reasoningThought")} ${durationLabel}`
      : t("reasoningThought");

  return (
    <div className={`reasoning${open ? " reasoning--open" : ""}${isStreaming ? " reasoning--streaming" : ""}`}>
      <button
        type="button"
        className="reasoning__head"
        aria-expanded={open}
        aria-label={open ? t("showLess") : label}
        onClick={() => {
          userInteracted.current = true;
          setOpen((value) => !value);
        }}
      >
        <span className="reasoning__icon">
          <BrainIcon />
        </span>
        <span className={`reasoning__label${isStreaming ? " reasoning__label--active" : ""}`}>{label}</span>
        <span className="reasoning__chevron">
          <ChevronRightIcon open={open} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="reasoning__body-anim"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : COLLAPSE_TRANSITION}
          >
            <div className="reasoning__body">
              <Markdown
                content={item.reasoning ?? ""}
                isAssistant={true}
                noFileIcons={true}
                isStreaming={isStreaming}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
