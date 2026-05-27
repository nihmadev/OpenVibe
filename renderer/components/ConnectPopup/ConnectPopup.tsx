import React, { useState } from "react";
import type { Provider } from "../../types.js";
import { PROVIDER_TEMPLATES } from "../../constants.js";
import { useI18n } from "../../hooks/useI18n.js";

interface Template {
  id: string;
  name: string;
  icon: string;
  baseUrl: string;
}

interface ConnectPopupProps {
  template: Template | null;
  custom: boolean;
  editId?: string;
  editProvider?: Provider | null;
  onConnect: (form: { apiKey: string; model: string; baseUrl: string; name: string }) => Promise<void>;
  onClose: () => void;
}

export function ConnectPopup({ template, custom, editId, editProvider, onConnect, onClose }: ConnectPopupProps): React.ReactElement | null {
  const { t } = useI18n();
  const [form, setForm] = useState({
    apiKey: editProvider?.apiKey ?? "",
    model: editProvider?.model ?? "",
    baseUrl: editProvider?.baseUrl ?? template?.baseUrl ?? "https://",
    name: editProvider?.name ?? template?.name ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);

  async function handleConnect(): Promise<void> {
    if (!form.apiKey.trim() || busy) return;
    setBusy(true);
    try {
      await onConnect(form);
    } finally {
      setBusy(false);
    }
  }

  const editIcon = editId && editProvider
    ? PROVIDER_TEMPLATES.find(t => t.baseUrl === editProvider.baseUrl)?.icon
    : null;

  return (
    <div className="connect-popup__overlay" onClick={onClose}>
      <div className="connect-popup" onClick={(e) => e.stopPropagation()}>
        <button className="connect-popup__close" onClick={onClose}>×</button>

        {editIcon ? (
          <img src={`icons/providers/${editIcon}`} className="connect-popup__icon" alt="" />
        ) : template && !custom && !editId ? (
          <img src={`icons/providers/${template.icon}`} className="connect-popup__icon" alt="" />
        ) : editId ? (
          <div className="connect-popup__icon connect-popup__icon--placeholder">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
        ) : null}

        <div className="connect-popup__name">
          {editId ? editProvider?.name : custom ? t("customProviderTitle") : template?.name}
        </div>

        <div className="connect-popup__fields">
          {(custom && !editId) ? (
            <>
              <input
                className="connect-popup__input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("name")}
              />
              <input
                className="connect-popup__input"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://api.example.com/v1"
              />
            </>
          ) : null}
          <div className="connect-popup__input-wrap">
            <input
              className="connect-popup__input connect-popup__input--key"
              type={showKey ? "text" : "password"}
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
            <button
              className="connect-popup__eye"
              onClick={() => setShowKey((v) => !v)}
              tabIndex={-1}
              type="button"
              aria-label={showKey ? t("hideKey") : t("showKey")}
            >
              {showKey ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
        </div>

        <button
          className="connect-popup__btn"
          onClick={handleConnect}
          disabled={!form.apiKey.trim() || busy}
        >
          {busy ? "..." : (editId ? t("save") : t("connect"))}
        </button>
      </div>
    </div>
  );
}
