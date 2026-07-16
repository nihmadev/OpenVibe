import React from "react";
import {
  ChevronRightIcon,
  MatchCaseIcon,
  WholeWordIcon,
  RegexIcon,
  PreserveCaseIcon,
  ReplaceAllIcon,
  ThreeDotIcon,
} from "../../Icons/index.js";
import { Tooltip } from "../../Tooltip/Tooltip.js";
import { useTranslate } from "../../../hooks/useI18n.js";

export interface SearchFilterBarProps {
  inputRef: React.RefObject<HTMLInputElement>;
  query: string;
  onQueryChange: (val: string) => void;
  onInputKeyDown: (e: React.KeyboardEvent) => void;
  matchCase: boolean;
  onToggleMatchCase: () => void;
  matchWholeWord: boolean;
  onToggleMatchWholeWord: () => void;
  useRegex: boolean;
  onToggleUseRegex: () => void;
  replaceOpen: boolean;
  onToggleReplaceOpen: () => void;
  replaceText: string;
  onReplaceTextChange: (val: string) => void;
  preserveCase: boolean;
  onTogglePreserveCase: () => void;
  showFilters: boolean;
  onToggleShowFilters: () => void;
  includeFilter: string;
  onIncludeFilterChange: (val: string) => void;
  excludeFilter: string;
  onExcludeFilterChange: (val: string) => void;
}

export function SearchFilterBar({
  inputRef,
  query,
  onQueryChange,
  onInputKeyDown,
  matchCase,
  onToggleMatchCase,
  matchWholeWord,
  onToggleMatchWholeWord,
  useRegex,
  onToggleUseRegex,
  replaceOpen,
  onToggleReplaceOpen,
  replaceText,
  onReplaceTextChange,
  preserveCase,
  onTogglePreserveCase,
  showFilters,
  onToggleShowFilters,
  includeFilter,
  onIncludeFilterChange,
  excludeFilter,
  onExcludeFilterChange,
}: SearchFilterBarProps): React.ReactElement {
  const t = useTranslate();

  return (
    <div className="sc-inputs">
      <div className="sc-inputs-inner">
        <Tooltip text={replaceOpen ? t("hideReplace") : t("showReplace")}>
          <button
            className={`sc-chevron-btn ${replaceOpen ? "sc-chevron-btn--open" : ""}`}
            onClick={onToggleReplaceOpen}
            aria-label={replaceOpen ? t("hideReplace") : t("showReplace")}
          >
            <ChevronRightIcon open={replaceOpen} />
          </button>
        </Tooltip>
        <div className="sc-input-fields">
          <div className="sc-input-row">
            <div className="sc-input-wrap">
              <input
                ref={inputRef}
                className="sc-input"
                type="text"
                placeholder={t("searchInCodePlaceholder")}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={onInputKeyDown}
                aria-label={t("searchInCodePlaceholder")}
              />
              <div className="sc-input-toggles">
                <Tooltip text={t("matchCase")}>
                  <button
                    className={`sc-toggle-btn ${matchCase ? "sc-toggle-btn--active" : ""}`}
                    onClick={onToggleMatchCase}
                    aria-label={t("matchCase")}
                  >
                    <MatchCaseIcon />
                  </button>
                </Tooltip>
                <Tooltip text={t("matchWholeWord")}>
                  <button
                    className={`sc-toggle-btn ${matchWholeWord ? "sc-toggle-btn--active" : ""}`}
                    onClick={onToggleMatchWholeWord}
                    aria-label={t("matchWholeWord")}
                  >
                    <WholeWordIcon />
                  </button>
                </Tooltip>
                <Tooltip text={t("useRegex")}>
                  <button
                    className={`sc-toggle-btn ${useRegex ? "sc-toggle-btn--active" : ""}`}
                    onClick={onToggleUseRegex}
                    aria-label={t("useRegex")}
                  >
                    <RegexIcon />
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          <div className={`sc-replace-wrap ${replaceOpen ? "sc-replace-wrap--open" : ""}`}>
            <div className="sc-input-row sc-input-row--replace">
              <div className="sc-input-wrap">
                <input
                  className="sc-input"
                  type="text"
                  placeholder={t("replacePlaceholder")}
                  value={replaceText}
                  onChange={(e) => onReplaceTextChange(e.target.value)}
                  aria-label={t("replacePlaceholder")}
                />
                <div className="sc-input-toggles">
                  <Tooltip text={t("preserveCase")}>
                    <button
                      className={`sc-toggle-btn ${preserveCase ? "sc-toggle-btn--active" : ""}`}
                      onClick={onTogglePreserveCase}
                      aria-label={t("preserveCase")}
                    >
                      <PreserveCaseIcon />
                    </button>
                  </Tooltip>
                  <Tooltip text={t("replaceAll")}>
                    <button className="sc-action-btn" aria-label={t("replaceAll")}>
                      <ReplaceAllIcon />
                    </button>
                  </Tooltip>
                  <Tooltip text={t("filesToIncludeExclude")}>
                    <button
                      className={`sc-action-btn ${showFilters ? "sc-action-btn--active" : ""}`}
                      onClick={onToggleShowFilters}
                      aria-label={t("filesToIncludeExclude")}
                    >
                      <ThreeDotIcon />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`sc-filters-wrap ${showFilters ? "sc-filters-wrap--open" : ""}`}>
        <div className="sc-filters">
          <div className="sc-filter-row">
            <span className="sc-filter-label">{t("filesToInclude")}</span>
            <div className="sc-input-wrap">
              <input
                className="sc-input"
                type="text"
                placeholder={t("includePlaceholder")}
                value={includeFilter}
                onChange={(e) => onIncludeFilterChange(e.target.value)}
                aria-label={t("filesToInclude")}
              />
            </div>
          </div>
          <div className="sc-filter-row">
            <span className="sc-filter-label">{t("filesToExclude")}</span>
            <div className="sc-input-wrap">
              <input
                className="sc-input"
                type="text"
                placeholder={t("excludePlaceholder")}
                value={excludeFilter}
                onChange={(e) => onExcludeFilterChange(e.target.value)}
                aria-label={t("filesToExclude")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
