import React, { useState } from "react";
import { UserIcon, EyeIcon, EyeOffIcon } from "../icons/icons.js";
import type { Provider } from "../../types.js";
import { PROVIDER_TEMPLATES, getProviderIconPath } from "../../constants.js";
import { useI18n } from "../../hooks/useI18n.js";
import { useTheme } from "../../hooks/useTheme.js";

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

export function ConnectPopup({
  template,
  custom,
  editId,
  editProvider,
  onConnect,
  onClose,
}: ConnectPopupProps): React.ReactElement | null {
  const { t } = useI18n();
  const { resolvedScheme } = useTheme();
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

  const editIcon =
    editId && editProvider ? PROVIDER_TEMPLATES.find((t) => t.baseUrl === editProvider.baseUrl)?.icon : null;

  return (
    <div className="connect-popup__overlay" onClick={onClose}>
      <div className="connect-popup" onClick={(e) => e.stopPropagation()}>
        <button className="connect-popup__close" onClick={onClose}>
          ×
        </button>

        {editIcon ? (
          <img src={getProviderIconPath(editIcon, resolvedScheme === "light")} className="connect-popup__icon" alt="" />
        ) : template && !custom && !editId ? (
          <img
            src={getProviderIconPath(template.icon, resolvedScheme === "light")}
            className="connect-popup__icon"
            alt=""
          />
        ) : editId ? (
          <div className="connect-popup__icon connect-popup__icon--placeholder">
            <UserIcon />
          </div>
        ) : null}

        <div className="connect-popup__name">
          {editId ? editProvider?.name : custom ? t("customProviderTitle") : template?.name}
        </div>

        <div className="connect-popup__fields">
          {custom && !editId ? (
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
              {showKey ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        <button className="connect-popup__btn" onClick={handleConnect} disabled={!form.apiKey.trim() || busy}>
          {busy ? "..." : editId ? t("save") : t("connect")}
        </button>
      </div>
    </div>
  );
}
