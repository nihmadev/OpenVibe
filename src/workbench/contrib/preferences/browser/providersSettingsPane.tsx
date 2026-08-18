import { useState } from "react";
import { useI18n } from "@/platform/localization/localizationService";
import { ProviderLogo } from "@/workbench/services/aiProviders/browser/providerLogo";
import { PROVIDER_TEMPLATES } from "@/workbench/services/aiProviders/browser/providerTemplates";
import type { Provider } from "@/workbench/services/aiProviders/common/aiProvider";

interface Props {
  connected: Provider[];
  onEdit: (provider: Provider) => void;
  onDisconnect: (id: string) => void;
  onCustom: () => void;
  onConnect: (template: (typeof PROVIDER_TEMPLATES)[number]) => void;
}

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export function ProvidersTab({ connected, onEdit, onDisconnect, onCustom, onConnect }: Props) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filteredTemplates = query
    ? PROVIDER_TEMPLATES.filter(
        (tpl) =>
          tpl.name.toLowerCase().includes(query) ||
          tpl.id.toLowerCase().includes(query) ||
          tpl.baseUrl.toLowerCase().includes(query),
      )
    : PROVIDER_TEMPLATES;

  return (
    <>
      {connected.length > 0 && (
        <div className="settings__section">
          <h3 className="settings__section-title">{t("connectedProviders")}</h3>
          <div className="settings__providers-list">
            {connected.map((provider) => {
              const template = PROVIDER_TEMPLATES.find((item) => item.baseUrl === provider.baseUrl);
              return (
                <div key={provider.id} className="settings__provider-row">
                  <div className="settings__provider-info">
                    <ProviderLogo
                      icon={provider.customIcon || template?.icon || provider.id}
                      providerId={template?.id || provider.id}
                    />
                    <div className="settings__provider-name">{provider.name}</div>
                  </div>
                  <div className="settings__provider-actions">
                    <button className="settings__edit-btn" onClick={() => onEdit(provider)} title={t("editProvider")}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                      </svg>
                    </button>
                    <button className="settings__disconnect-btn" onClick={() => onDisconnect(provider.id)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                      {t("disconnect")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="settings__section">
        <div className="settings__models-search" style={{ marginBottom: "12px" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="settings__models-search-input"
            placeholder={t("searchModels") || "Search providers..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="settings__providers-list">
          {!query && (
            <div className="settings__provider-row">
              <div className="settings__provider-info">
                <div className="settings__provider-icon-placeholder">
                  <PlusIcon />
                </div>
                <div className="settings__provider-name">{t("customProvider")}</div>
              </div>
              <button className="settings__connect-btn" onClick={onCustom}>
                <PlusIcon />
                {t("connect")}
              </button>
            </div>
          )}
          {filteredTemplates.map((template) => (
            <div key={template.id} className="settings__provider-row">
              <div className="settings__provider-info">
                <ProviderLogo icon={template.icon} providerId={template.id} />
                <div className="settings__provider-name">{template.name}</div>
              </div>
              <button className="settings__connect-btn" onClick={() => onConnect(template)}>
                <PlusIcon />
                {t("connect")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
