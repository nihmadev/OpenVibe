import React, { useState, useRef, useCallback } from "react";
import { UserIcon, EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from "../Icons/icons.js";
import type { Provider, KeyValuePair } from "../../types.js";
import { PROVIDER_TEMPLATES, getProviderIconPath } from "../../constants.js";
import { useI18n } from "../../hooks/useI18n.js";
import { useTheme } from "../../hooks/useTheme.js";
import { Input } from "../ui/index.js";

interface Template {
  id: string;
  name: string;
  icon: string;
  baseUrl: string;
  modelsUrl?: string;
}

interface ConnectPopupProps {
  template: Template | null;
  custom: boolean;
  editId?: string;
  editProvider?: Provider | null;
  onConnect: (form: {
    apiKey: string;
    model: string;
    baseUrl: string;
    name: string;
    customIcon: string | null;
    modelsUrl: string;
    headers: KeyValuePair[];
    parameters: KeyValuePair[];
  }) => Promise<void>;
  onClose: () => void;
}

function PairEditor({
  pairs,
  keyPlaceholder,
  valuePlaceholder,
  onUpdate,
}: {
  pairs: KeyValuePair[];
  keyPlaceholder: string;
  valuePlaceholder: string;
  onUpdate: (pairs: KeyValuePair[]) => void;
}) {
  function add() {
    onUpdate([...pairs, { key: "", value: "" }]);
  }
  function remove(i: number) {
    onUpdate(pairs.filter((_, idx) => idx !== i));
  }
  function change(i: number, field: "key" | "value", val: string) {
    onUpdate(pairs.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)));
  }
  return (
    <div className="connect-popup__pairs">
      {pairs.map((p, i) => (
        <div key={i} className="connect-popup__pair-row">
          <Input
            containerClassName="connect-popup__input connect-popup__pair-key"
            value={p.key}
            onChange={(e) => change(i, "key", e.target.value)}
            placeholder={keyPlaceholder}
          />
          <Input
            containerClassName="connect-popup__input connect-popup__pair-value"
            value={p.value}
            onChange={(e) => change(i, "value", e.target.value)}
            placeholder={valuePlaceholder}
          />
          <button className="connect-popup__icon-btn" type="button" onClick={() => remove(i)}>
            <TrashIcon />
          </button>
        </div>
      ))}
      <button className="connect-popup__add-pair-btn" type="button" onClick={add}>
        <PlusIcon />
        Add
      </button>
    </div>
  );
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
    customIcon: editProvider?.customIcon ?? "",
    modelsUrl: editProvider?.modelsUrl ?? template?.modelsUrl ?? "",
    headers: editProvider?.headers ?? ([] as KeyValuePair[]),
    parameters: editProvider?.parameters ?? ([] as KeyValuePair[]),
  });
  const [busy, setBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleConnect(): Promise<void> {
    if (!form.apiKey.trim() || busy) return;
    setBusy(true);
    try {
      await onConnect(form);
    } finally {
      setBusy(false);
    }
  }

  const handleIconFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, customIcon: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }, []);

  const editIcon =
    editId && editProvider ? PROVIDER_TEMPLATES.find((t) => t.baseUrl === editProvider.baseUrl)?.icon : null;

  const hasCustomIcon = !!(form.customIcon && form.customIcon.startsWith("data:"));
  const isEditing = !!(editId || editProvider);

  return (
    <div className="connect-popup__overlay" onClick={onClose}>
      <div className="connect-popup" onClick={(e) => e.stopPropagation()}>
        <div className="connect-popup__header">
          <div className="connect-popup__icon-wrap">
            {hasCustomIcon ? (
              <img src={form.customIcon} className="connect-popup__icon" alt="" />
            ) : editIcon && isEditing ? (
              <img
                src={getProviderIconPath(editIcon, resolvedScheme === "light")}
                className="connect-popup__icon"
                alt=""
              />
            ) : template && !isEditing ? (
              <img
                src={getProviderIconPath(template.icon, resolvedScheme === "light")}
                className="connect-popup__icon"
                alt=""
              />
            ) : (
              <div className="connect-popup__icon-placeholder">
                <UserIcon />
              </div>
            )}
          </div>
          <h2 className="connect-popup__title">
            {isEditing ? editProvider?.name : custom ? t("customProviderTitle") : template?.name}
          </h2>
          {isEditing && <p className="connect-popup__subtitle">{t("editProvider")}</p>}
          <button className="connect-popup__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="connect-popup__body">
          {(custom || isEditing) && (
            <div className="connect-popup__section">
              <Input
                containerClassName="connect-popup__input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("name")}
              />
              <Input
                containerClassName="connect-popup__input"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder={t("baseUrlPlaceholder")}
              />
            </div>
          )}

          <div className="connect-popup__section">
            <Input
              containerClassName="connect-popup__input"
              type={showKey ? "text" : "password"}
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder={t("apiKeyPlaceholder")}
              rightElement={
                <button
                  className="connect-popup__eye"
                  onClick={() => setShowKey((v) => !v)}
                  tabIndex={-1}
                  type="button"
                  aria-label={showKey ? t("hideKey") : t("showKey")}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    color: "var(--vscode-input-placeholderForeground)",
                  }}
                >
                  {showKey ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              }
            />
          </div>

          {(custom || isEditing) && (
            <>
              <div className="connect-popup__section">
                <label className="connect-popup__label">{t("customIcon")}</label>
                <div className="connect-popup__icon-row">
                  <Input
                    containerClassName="connect-popup__input"
                    value={form.customIcon && !form.customIcon.startsWith("data:") ? form.customIcon : ""}
                    onChange={(e) => setForm({ ...form, customIcon: e.target.value })}
                    placeholder={t("iconUrlPlaceholder")}
                  />
                  <button
                    className="connect-popup__icon-btn"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title={t("uploadIcon")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleIconFile} />
                </div>
              </div>

              <div className="connect-popup__section">
                <label className="connect-popup__label">{t("modelsUrl")}</label>
                <Input
                  containerClassName="connect-popup__input"
                  value={form.modelsUrl}
                  onChange={(e) => setForm({ ...form, modelsUrl: e.target.value })}
                  placeholder={t("modelsUrlPlaceholder")}
                />
              </div>

              <div className="connect-popup__section">
                <div className="connect-popup__section-header">
                  <label className="connect-popup__label">{t("headers")}</label>
                </div>
                <PairEditor
                  pairs={form.headers}
                  keyPlaceholder={t("headerKey")}
                  valuePlaceholder={t("headerValue")}
                  onUpdate={(pairs) => setForm({ ...form, headers: pairs })}
                />
              </div>

              <div className="connect-popup__section">
                <div className="connect-popup__section-header">
                  <label className="connect-popup__label">{t("parameters")}</label>
                </div>
                <PairEditor
                  pairs={form.parameters}
                  keyPlaceholder={t("paramKey")}
                  valuePlaceholder={t("paramValue")}
                  onUpdate={(pairs) => setForm({ ...form, parameters: pairs })}
                />
              </div>
            </>
          )}
        </div>

        <div className="connect-popup__footer">
          <button
            className="connect-popup__btn connect-popup__btn--primary"
            onClick={handleConnect}
            disabled={!form.apiKey.trim() || busy}
          >
            {busy ? "..." : isEditing ? t("save") : t("connect")}
          </button>
          <button className="connect-popup__btn" onClick={onClose}>
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
