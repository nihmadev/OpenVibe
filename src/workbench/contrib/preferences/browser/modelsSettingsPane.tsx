import { Toggle } from "@zazaru/ui";
import type React from "react";
import type { Dispatch, SetStateAction } from "react";
import { ChevronRightIcon } from "@/base/browser/ui/icons/iconRegistry";
import { Loader } from "@/base/browser/ui/loader/loader";
import { useI18n } from "@/platform/localization/localizationService";
import { ProviderLogo } from "@/workbench/services/aiProviders/browser/providerLogo";
import { PROVIDER_TEMPLATES } from "@/workbench/services/aiProviders/browser/providerTemplates";
import type { DiscoveredModel } from "../common/preferences";

interface Props {
  models: DiscoveredModel[];
  loading: boolean;
  enabledModels: Set<string>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  collapsed: Record<string, boolean>;
  setCollapsed: Dispatch<SetStateAction<Record<string, boolean>>>;
  onToggle: (providerDbId: string, modelId: string) => void;
}

export function ModelsTab({
  models,
  loading,
  enabledModels,
  search,
  setSearch,
  collapsed,
  setCollapsed,
  onToggle,
}: Props): React.ReactElement {
  const { t } = useI18n();
  const query = search.toLowerCase();
  const filtered = query
    ? models.filter((model) => model.name.toLowerCase().includes(query) || model.id.toLowerCase().includes(query))
    : models;
  const groups = new Map<string, DiscoveredModel[]>();
  for (const model of filtered) groups.set(model.providerDbId, [...(groups.get(model.providerDbId) ?? []), model]);

  return (
    <div className="settings__models">
      <div className="settings__models-search">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className="settings__models-search-input"
          placeholder={t("searchModels")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {loading ? (
        <div className="settings__models-loading">
          <Loader />
        </div>
      ) : models.length === 0 ? (
        <div className="settings__models-empty">
          <p>{t("noModels")}</p>
        </div>
      ) : (
        <div className="settings__models-table">
          {Array.from(groups.entries()).map(([providerDbId, providerModels]) => {
            const first = providerModels[0]!;
            const template = PROVIDER_TEMPLATES.find((item) => item.id === first.providerId);
            const icon = template?.icon ?? first.providerIcon ?? "";
            const name = template?.name ?? first.providerName ?? providerDbId;
            const isCollapsed = !!collapsed[providerDbId];
            return (
              <div key={providerDbId} className="settings__models-group">
                <div
                  className="settings__models-group-header"
                  onClick={() => setCollapsed((previous) => ({ ...previous, [providerDbId]: !previous[providerDbId] }))}
                >
                  <ChevronRightIcon open={!isCollapsed} />
                  <ProviderLogo icon={icon} providerId={first.providerId} />
                  <span>{name}</span>
                </div>
                <div className={`settings__models-list ${isCollapsed ? "settings__models-list--collapsed" : ""}`}>
                  <div className="settings__models-list-inner">
                    {providerModels.map((model) => {
                      const compositeKey = `${model.providerDbId}::${model.id}`;
                      return (
                        <div key={compositeKey} className="settings__model-row">
                          <div className="settings__model-info">
                            <span className="settings__model-name">{model.name}</span>
                          </div>
                          <Toggle
                            checked={enabledModels.has(compositeKey) || enabledModels.has(model.id)}
                            onValueChange={() => onToggle(model.providerDbId, model.id)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
