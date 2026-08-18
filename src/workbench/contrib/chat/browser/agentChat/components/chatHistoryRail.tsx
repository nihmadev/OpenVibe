import type React from "react";
import { useMemo, useState } from "react";
import type { ChatEntry } from "../../../../../services/agent/common/agentRun";

interface HistoryPreview {
  id: string;
  prompt: string;
  answer: string;
}

interface ChatHistoryRailProps {
  entries: ChatEntry[];
  onNavigate: (id: string) => void;
}

function compactText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~()]/g, " ")
    .replaceAll("[", " ")
    .replaceAll("]", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPreviews(entries: ChatEntry[]): HistoryPreview[] {
  const previews: HistoryPreview[] = [];

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (entry.kind !== "single" || entry.item.kind !== "user") continue;

    const nextRun = entries.slice(index + 1).find((candidate) => {
      if (candidate.kind === "single" && candidate.item.kind === "user") return true;
      return candidate.kind === "run";
    });
    const answer = nextRun?.kind === "run" ? (nextRun.finalItem?.text ?? "") : "";

    previews.push({
      id: entry.item.id,
      prompt: compactText(entry.item.text),
      answer: compactText(answer),
    });
  }

  return previews;
}

export function ChatHistoryRail({ entries, onNavigate }: ChatHistoryRailProps): React.ReactElement | null {
  const previews = useMemo(() => buildPreviews(entries), [entries]);
  const [activeId, setActiveId] = useState<string | null>(null);

  if (previews.length < 2) return null;

  return (
    <nav className="chat-history-rail" aria-label="История диалога" onMouseLeave={() => setActiveId(null)}>
      <div className="chat-history-rail__track" aria-hidden="true" />
      <div className="chat-history-rail__items">
        {previews.map((preview, index) => {
          const active = activeId === preview.id;
          return (
            <div
              className={`chat-history-rail__item${active ? " chat-history-rail__item--active" : ""}`}
              key={preview.id}
            >
              <button
                type="button"
                className="chat-history-rail__marker"
                style={{ "--history-line-step": Math.min(index, 5) } as React.CSSProperties}
                onMouseEnter={() => setActiveId(preview.id)}
                onFocus={() => setActiveId(preview.id)}
                onBlur={() => setActiveId(null)}
                onClick={() => onNavigate(preview.id)}
                aria-label={`Перейти к сообщению ${index + 1}: ${preview.prompt}`}
              >
                <span className="chat-history-rail__line" />
              </button>
              {active && (
                <button type="button" className="chat-history-preview" onClick={() => onNavigate(preview.id)}>
                  <span className="chat-history-preview__prompt">{preview.prompt || "Сообщение пользователя"}</span>
                  <span className="chat-history-preview__answer">
                    {preview.answer || "Ответ агента ещё не получен"}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
