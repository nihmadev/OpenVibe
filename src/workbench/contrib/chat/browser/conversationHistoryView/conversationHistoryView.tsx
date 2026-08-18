import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DotsHorizontalIcon,
  FilterListIcon,
  FolderTreeIcon,
  HistoryClockIcon,
  SearchMiniIcon,
  TrashIcon,
} from "@/base/browser/ui/icons/iconRegistry";
import { useI18n } from "@/platform/localization/localizationService";
import type { Project } from "@/workbench/services/workspace/common/workspace";
import {
  type DisplayOptions,
  DisplayOptionsDropdown,
} from "../../../../browser/parts/sidebar/displayOptions/displayOptionsDropdown";
import { groupSessionsByDate } from "../../../../services/chat/common/chatDateGrouping";
import type { ChatSummary, ConversationHistoryViewProps } from "../../common/chat";
import "./conversationHistoryView.css";

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return `${days}d`;
}

export function ConversationHistoryView({
  projects: _projects,
  activeProjectId,
  activeChatId,
  onSelectChat,
  getAllProjectChats,
  onDeleteChat,
}: ConversationHistoryViewProps): React.ReactElement {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Array<{ project: Project | null; chat: ChatSummary }>>([]);
  const [loading, setLoading] = useState(false);
  const [displayDropdownOpen, setDisplayDropdownOpen] = useState(false);
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
    groupBy: "none",
    sortBy: "last_updated",
    showSubtitles: true,
    showArchived: false,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    getAllProjectChats().then((res) => {
      setItems(res);
      setLoading(false);
    });
  }, [getAllProjectChats]);

  useEffect(() => {
    loadData();
    inputRef.current?.focus();
  }, [loadData]);

  const filteredAndSortedItems = useMemo(() => {
    let list = [...items];
    const q = query.trim().toLowerCase();

    if (q) {
      list = list.filter(({ project, chat }) => {
        const titleMatch = (chat.title || "").toLowerCase().includes(q);
        const projMatch = project ? project.name.toLowerCase().includes(q) : false;
        return titleMatch || projMatch;
      });
    }

    // Sort
    if (displayOptions.sortBy === "alphabetical") {
      list.sort((a, b) => (a.chat.title || "").localeCompare(b.chat.title || ""));
    } else if (displayOptions.sortBy === "date_added") {
      list.sort((a, b) => (b.chat.createdAt || 0) - (a.chat.createdAt || 0));
    } else {
      // last_updated
      list.sort((a, b) => (b.chat.updatedAt || b.chat.createdAt || 0) - (a.chat.updatedAt || a.chat.createdAt || 0));
    }

    return list;
  }, [items, query, displayOptions.sortBy]);

  return (
    <div className="history-view">
      <div className="history-view__container">
        {/* Sticky Header */}
        <div className="history-view__sticky-header">
          <h1 className="history-view__title">{t("conversationHistory")}</h1>

          {/* Search + Display Options + More Options */}
          <div className="history-view__controls">
            <div className="history-view__search-wrap">
              <SearchMiniIcon className="history-view__search-icon" />
              <input
                ref={inputRef}
                type="text"
                className="history-view__search-input"
                placeholder={t("searchHistory")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Display Options Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                className="history-view__btn"
                onClick={() => setDisplayDropdownOpen((v) => !v)}
                aria-label="Display Options"
              >
                <FilterListIcon size={16} />
              </button>
              <DisplayOptionsDropdown
                isOpen={displayDropdownOpen}
                onClose={() => setDisplayDropdownOpen(false)}
                options={displayOptions}
                onChange={setDisplayOptions}
                align="right"
              />
            </div>
          </div>
        </div>

        {/* Conversation List */}
        <div className="history-view__list">
          {loading ? (
            <div className="history-view__empty">
              <span>...</span>
            </div>
          ) : filteredAndSortedItems.length === 0 ? (
            <div className="history-view__empty">
              <HistoryClockIcon size={32} />
              <span>{t("noHistoryFound")}</span>
            </div>
          ) : (
            groupSessionsByDate(filteredAndSortedItems, displayOptions.sortBy).map((group) => (
              <div key={group.key} className="history-view__group">
                <div className="history-view__group-title">{t(group.labelId as any) || group.labelId}</div>
                <div className="history-view__group-items">
                  {group.items.map(({ project, chat }) => {
                    const isActive = chat.id === activeChatId && (!project || project.id === activeProjectId);
                    const time = chat.updatedAt || chat.createdAt || 0;

                    return (
                      <button
                        key={`${project?.id ?? "single"}-${chat.id}`}
                        className={`history-view__row${isActive ? " history-view__row--active" : ""}`}
                        onClick={() => onSelectChat(project?.id ?? null, chat.id)}
                      >
                        <div className="history-view__row-content">
                          <span className="history-view__row-title">
                            {chat.title || t("untitledSession" as any) || "Untitled"}
                          </span>
                          {displayOptions.showSubtitles && project && (
                            <div className="history-view__row-sub">
                              <FolderTreeIcon size={12} />
                              <span>{project.name}</span>
                            </div>
                          )}
                        </div>

                        <div className="history-view__row-right">
                          {time > 0 && <span className="history-view__row-time">{formatRelativeTime(time)}</span>}

                          {/* Actions on hover (replacing timestamp) */}
                          <div className="history-view__row-actions" onClick={(e) => e.stopPropagation()}>
                            {onDeleteChat && (
                              <button
                                className="history-view__row-action"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteChat(chat.id);
                                  setItems((prev) => prev.filter((it) => it.chat.id !== chat.id));
                                }}
                                aria-label={t("deleteSession")}
                              >
                                <TrashIcon />
                              </button>
                            )}
                            <button
                              className="history-view__row-action"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              aria-label="More options"
                            >
                              <DotsHorizontalIcon size={14} />
                            </button>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
