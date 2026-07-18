import React, { useEffect, useRef, useState } from "react";
import { CheckIcon, CloseIcon, ArrowUpIcon, ArrowLeftIcon, ArrowRightIcon, SpinIcon } from "../Icons/index.js";
import { Button } from "../ui/index.js";
import { useI18n } from "../../hooks/useI18n.js";

interface InlinePromptProps {
  onSend: (prompt: string) => void;
  onClose: () => void;
  loading: boolean;
  placeholder?: string;
}

export function InlinePromptPanel({ onSend, onClose, loading, placeholder }: InlinePromptProps) {
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    // Focus the input when mounted
    textareaRef.current?.focus();

    const el = textareaRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight <= clientHeight + 2) {
        // Prompt fits completely: let Monaco scroll the code
        return;
      }
      const isScrollingUp = e.deltaY < 0;
      const isScrollingDown = e.deltaY > 0;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

      if ((isScrollingUp && !atTop) || (isScrollingDown && !atBottom)) {
        // Prompt has overflow and user is scrolling its contents: stop bubbling to Monaco
        e.stopPropagation();
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: true });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const handleSubmit = () => {
    if (!prompt.trim() || loading) return;
    onSend(prompt.trim());
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    const target = e.target;
    target.style.height = "auto";
    target.style.height = `${Math.min(180, Math.max(26, target.scrollHeight))}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Layout-independent check so shortcuts work on both English and Russian keyboards
    if ((e.key === "Enter" || e.code === "Enter") && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape" || e.code === "Escape") {
      e.preventDefault();
      onClose();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === "Backspace" || e.code === "Backspace")) {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="inline-vibe-zone-content" onClick={(e) => e.stopPropagation()}>
      <div className="inline-vibe-input-wrapper">
        <textarea
          ref={textareaRef}
          className="inline-vibe-textarea"
          placeholder={placeholder || (loading ? t("inlineGenerating") : t("inlineEditCode"))}
          value={prompt}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          onWheel={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight <= el.clientHeight + 2) return;
            const isScrollingUp = e.deltaY < 0;
            const isScrollingDown = e.deltaY > 0;
            const atTop = el.scrollTop <= 0;
            const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
            if ((isScrollingUp && !atTop) || (isScrollingDown && !atBottom)) {
              e.stopPropagation();
            }
          }}
          disabled={loading}
          rows={1}
        />
        <button
          className={`inline-vibe-send-btn ${loading ? "inline-vibe-send-btn--loading" : ""}`}
          onClick={handleSubmit}
          disabled={!prompt.trim() || loading}
          title={t("inlineSend")}
        >
          {loading ? <SpinIcon /> : <ArrowUpIcon />}
        </button>
      </div>
    </div>
  );
}

interface InlineActionPillProps {
  onAccept: () => void;
  onReject: () => void;
  onNextDiff?: () => void;
  onPrevDiff?: () => void;
}

export function InlineActionPill({ onAccept, onReject, onNextDiff, onPrevDiff }: InlineActionPillProps) {
  const { t } = useI18n();
  return (
    <div className="inline-vibe-action-pill" onClick={(e) => e.stopPropagation()}>
      <Button variant="primary" onClick={onAccept} icon={<CheckIcon />}>
        {t("inlineAccept")}
      </Button>

      <Button variant="secondary" onClick={onReject} icon={<CloseIcon />}>
        {t("inlineReject")}
      </Button>

      {onPrevDiff && onNextDiff && (
        <>
          <div className="inline-vibe-divider" />
          <Button variant="ghost" onClick={onPrevDiff} title={t("inlinePrevDiff")} icon={<ArrowLeftIcon />} />
          <Button variant="ghost" onClick={onNextDiff} title={t("inlineNextDiff")} icon={<ArrowRightIcon />} />
        </>
      )}
    </div>
  );
}
