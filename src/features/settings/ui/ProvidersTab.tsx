import type { Provider } from "@/features/providers/model/provider";
import { getProviderIconPath, PROVIDER_TEMPLATES } from "@/features/providers/model/providerTemplates";
import { useI18n } from "@/shared/i18n/useI18n";
import { useTheme } from "@/shared/themes/useTheme";

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
  const { resolvedScheme } = useTheme();
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
                    {provider.customIcon?.startsWith("data:") ? (
                      <img src={provider.customIcon} className="settings__provider-icon" alt="" />
                    ) : template ? (
                      <img
                        src={getProviderIconPath(template.icon, resolvedScheme === "light")}
                        className="settings__provider-icon"
                        alt=""
                      />
                    ) : null}
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
        <div className="settings__providers-list">
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
          {PROVIDER_TEMPLATES.map((template) => (
            <div key={template.id} className="settings__provider-row">
              <div className="settings__provider-info">
                <img
                  src={getProviderIconPath(template.icon, resolvedScheme === "light")}
                  className="settings__provider-icon"
                  alt=""
                />
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
