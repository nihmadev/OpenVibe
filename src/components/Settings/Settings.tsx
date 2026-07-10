import React, { useEffect, useRef, useState, useCallback } from "react";
import "../../styles/Settings.css";
import type { Provider } from "../../types.js";
import { ConnectPopup } from "../ConnectPopup/ConnectPopup.js";
import { Select } from "./Select";
import { useTheme } from "../../hooks/useTheme.js";
import { themes } from "../../themes/themes.js";
import { PROVIDER_TEMPLATES, getProviderIconPath } from "../../constants.js";
import { useI18n } from "../../hooks/useI18n.js";
import { FONT_OPTIONS, CODE_FONT_OPTIONS, applyFont } from "../../fonts.js";
import { ChevronRightIcon } from "../icons/ui-icons.js";
import { languageOptions } from "../../i18n/index.js";
import type { ShortcutDef, KeyCombo } from "../../hooks/useShortcuts.js";
import { formatCombo, setRecording } from "../../hooks/useShortcuts.js";
import { useAnimations } from "../../hooks/useAnimations.js";
import type { AnimKey, AnimStyle } from "../../hooks/useAnimations.js";
import { InlineAnimPreview } from "./AnimationPreviewModal.js";

interface DiscoveredModel {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  providerIcon: string;
}

type Tab = "general" | "design" | "providers" | "models" | "hotkeys";

interface Props {
  open: boolean;
  onClose: () => void;
  onProviderChanged?: (model: string, baseUrl: string) => void;
  initialTab?: Tab;
  onLanguageChange?: (lang: string) => void;
  shortcuts?: ShortcutDef[];
  onUpdateBinding?: (id: string, combo: KeyCombo) => Promise<void>;
  onResetBinding?: (id: string) => Promise<void>;
}

export function Settings({
  open,
  onClose,
  onProviderChanged,
  initialTab,
  onLanguageChange,
  shortcuts,
  onUpdateBinding,
  onResetBinding,
}: Props): React.ReactElement | null {
  const { currentTheme, setTheme, preview, colorScheme, setColorScheme, resolvedScheme } = useTheme();
  const { t } = useI18n();
  const { settings: animSettings, set: setAnim } = useAnimations();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "general");
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open && initialTab) setActiveTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) {
      setRecordingId(null);
      setErrorMsg(null);
    }
  }, [open]);

  useEffect(() => {
    setRecording(recordingId);
  }, [recordingId]);

  const MODIFIER_CODES = new Set([
    "ControlLeft",
    "ControlRight",
    "ShiftLeft",
    "ShiftRight",
    "AltLeft",
    "AltRight",
    "MetaLeft",
    "MetaRight",
  ]);

  useEffect(() => {
    if (!recordingId) return;
    function onKey(e: KeyboardEvent) {
      if (MODIFIER_CODES.has(e.code)) return;
      if (e.code === "Escape") {
        setRecordingId(null);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const combo: KeyCombo = { code: e.code, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey };
      if (!onUpdateBinding || !recordingId) return;
      onUpdateBinding(recordingId, combo)
        .then(() => {
          setRecordingId(null);
          setErrorMsg(null);
        })
        .catch((err: Error) => {
          setRecordingId(null);
          setErrorMsg(err.message);
          if (errorTimer.current) clearTimeout(errorTimer.current);
          errorTimer.current = setTimeout(() => setErrorMsg(null), 3000);
        });
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recordingId, onUpdateBinding]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [editing, setEditing] = useState<{
    template: (typeof PROVIDER_TEMPLATES)[0] | null;
    custom: boolean;
    editId?: string;
  } | null>(null);

  // General settings state (persisted to DB)
  const SETTINGS_PREFIX = "settings:";
  const defaultGeneral = {
    language: "Russian",
    font: "Segoe UI",
    codeFont: "JetBrains Mono",
    autoAccept: false,
    terminalShell: "powershell",
    showThinking: true,
    expandShell: true,
    expandEdit: true,
    showProgress: true,
    soundEnabled: true,
    soundOnComplete: true,
    soundOnStop: true,
  } as const;
  type GeneralSettings = typeof defaultGeneral;
  const [general, setGeneral] = useState<GeneralSettings>({ ...defaultGeneral });
  const [generalLoaded, setGeneralLoaded] = useState(false);

  useEffect(() => {
    const keys = Object.keys(defaultGeneral) as (keyof GeneralSettings)[];
    Promise.all(
      keys.map(async (key) => {
        const val = await window.vibe.state.get(SETTINGS_PREFIX + key);
        return [key, val] as const;
      }),
    ).then((entries) => {
      setGeneral((prev) => {
        const next = { ...prev };
        for (const [key, val] of entries) {
          if (val === null) continue;
          const def = defaultGeneral[key];
          if (typeof def === "boolean") (next as any)[key] = val === "true";
          else (next as any)[key] = val;
        }
        return next;
      });
      setGeneralLoaded(true);
    });
  }, []);

  // Models state
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [enabledModels, setEnabledModels] = useState<Set<string>>(new Set());
  const [modelsSearch, setModelsSearch] = useState("");
  const [collapsedProviders, setCollapsedProviders] = useState<Record<string, boolean>>({});

  // Sticky search detection
  const bodyRef = useRef<HTMLDivElement>(null);
  const [searchStuck, setSearchStuck] = useState(false);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || activeTab !== "models") {
      setSearchStuck(false);
      return;
    }
    const handleScroll = () => setSearchStuck(body.scrollTop > 0);
    body.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => body.removeEventListener("scroll", handleScroll);
  }, [activeTab]);

  useEffect(() => {
    if (!open) return;
    Promise.all([window.vibe.providers.list(), window.vibe.models.listEnabled()])
      .then(([providers, enabled]) => {
        setProviders(providers);
        setEnabledModels(new Set(enabled));
      })
      .catch(console.error);
  }, [open]);

  useEffect(() => {
    fetchModels(providers);
  }, [providers]);

  async function fetchModels(providerList: Provider[]): Promise<void> {
    const connected = providerList.filter((p) => p.apiKey);
    if (connected.length === 0) {
      setDiscoveredModels([]);
      return;
    }
    setModelsLoading(true);
    const results: DiscoveredModel[] = [];
    await Promise.all(
      connected.map(async (p) => {
        const template = PROVIDER_TEMPLATES.find((t) => p.baseUrl.startsWith(t.baseUrl.replace(/\/+$/, "")));
        const providerId = template?.id ?? p.id;
        const providerName = template?.name ?? p.name;
        const providerIcon = template?.icon ?? "";
        const res = await window.vibe.models.fetch(p.baseUrl, p.apiKey, providerId);
        if (!res.ok) {
          console.error("Failed to fetch models for", providerName, res.error);
          return;
        }
        for (const m of res.models) {
          results.push({ id: m.id, name: m.name, providerId, providerName, providerIcon });
        }
      }),
    );
    setDiscoveredModels(results.sort((a, b) => a.name.localeCompare(b.name)));
    setModelsLoading(false);
  }

  function toggleModel(modelId: string): void {
    window.vibe.models.toggleEnabled(modelId).then((nowEnabled) => {
      setEnabledModels((prev) => {
        const next = new Set(prev);
        if (nowEnabled) next.add(modelId);
        else next.delete(modelId);
        return next;
      });
    });
  }

  function toggleProviderCollapse(providerId: string): void {
    setCollapsedProviders((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  }

  async function save(updated: Provider[]): Promise<void> {
    setProviders(updated);
  }

  function updateGeneral(key: keyof GeneralSettings, value: string | boolean): void {
    setGeneral((prev) => {
      const next = { ...prev, [key]: value as any };
      if (key === "font" || key === "codeFont") {
        applyFont(next.font, next.codeFont);
      }
      return next;
    });
    window.vibe.state.set(SETTINGS_PREFIX + key, String(value));
    if (key === "language" && onLanguageChange) {
      onLanguageChange(value as string);
    }
  }

  function startConnect(template: (typeof PROVIDER_TEMPLATES)[0]): void {
    setEditing({ template, custom: false });
  }

  function startCustom(): void {
    setEditing({ template: null, custom: true });
  }

  function startEdit(p: Provider): void {
    setEditing({ template: null, custom: true, editId: p.id });
  }

  async function disconnect(id: string): Promise<void> {
    await window.vibe.providers.delete(id);
    await save(providers.filter((p) => p.id !== id));
  }

  if (!open) return null;

  const connected = providers.filter((p) => p.apiKey);

  const renderSidebarItem = (id: Tab, label: string, icon?: React.ReactNode) => (
    <button
      className={`settings__sidebar-item ${activeTab === id ? "active" : ""}`}
      onClick={() => {
        setActiveTab(id);
        setEditing(null);
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="settings__overlay" onClick={onClose}>
      <div className="settings__container" onClick={(e) => e.stopPropagation()}>
        <div className="settings__sidebar">
          <div className="settings__sidebar-group">
            <div className="settings__sidebar-title">{t("app")}</div>
            {renderSidebarItem(
              "general",
              t("general"),
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V22a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>,
            )}
            {renderSidebarItem(
              "design",
              t("design"),
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
              </svg>,
            )}
            {renderSidebarItem(
              "hotkeys",
              t("hotkeys"),
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.01" />
                <path d="M10 8h.01" />
                <path d="M14 8h.01" />
                <path d="M18 8h.01" />
                <path d="M6 12h.01" />
                <path d="M10 12h.01" />
                <path d="M14 12h.01" />
                <path d="M18 12h.01" />
                <path d="M7 16h10" />
              </svg>,
            )}
          </div>
          <div className="settings__sidebar-group">
            <div className="settings__sidebar-title">{t("server")}</div>
            {renderSidebarItem(
              "providers",
              t("providers"),
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="2" width="20" height="8" rx="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" />
                <line x1="6" y1="6" x2="6" y2="6" />
                <line x1="6" y1="18" x2="6" y2="18" />
              </svg>,
            )}
            {renderSidebarItem(
              "models",
              t("models"),
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>,
            )}
          </div>

          <div className="settings__sidebar-footer">
            <div className="settings__app-info">
              OpenVibe Desktop
              <span>v0.3.1</span>
            </div>
          </div>
        </div>

        <div className="settings__content">
          <div className="settings__content-header">
            <h2>
              {activeTab === "general"
                ? t("general")
                : activeTab === "design"
                  ? t("design")
                  : activeTab === "models"
                    ? t("models")
                    : activeTab === "providers"
                      ? t("providers")
                      : t("hotkeys")}
            </h2>
            <button className="settings__close" onClick={onClose}>
              ×
            </button>
          </div>

          <div
            className={`settings__content-body${searchStuck ? " settings__content-body--search-stuck" : ""}`}
            ref={bodyRef}
          >
            {activeTab === "general" ? (
              <>
                <div className="settings__subsection">
                  <div className="settings__control-group">
                    <div className="settings__control-row">
                      <div className="settings__control-info">
                        <div className="settings__control-label">{t("language")}</div>
                        <div className="settings__control-desc">{t("languageDesc")}</div>
                      </div>
                      <Select
                        value={general.language}
                        options={languageOptions.map((o) => ({ value: o.value, label: t("lang" + o.value) }))}
                        onChange={(v) => updateGeneral("language", v)}
                      />
                    </div>
                    <div className="settings__control-row">
                      <div className="settings__control-info">
                        <div className="settings__control-label">{t("autoAccept")}</div>
                        <div className="settings__control-desc">{t("autoAcceptDesc")}</div>
                      </div>
                      <input
                        type="checkbox"
                        className="settings__checkbox"
                        checked={general.autoAccept}
                        onChange={(e) => updateGeneral("autoAccept", e.target.checked)}
                      />
                    </div>
                    <div className="settings__control-row">
                      <div className="settings__control-info">
                        <div className="settings__control-label">{t("terminalShell")}</div>
                        <div className="settings__control-desc">{t("terminalShellDesc")}</div>
                      </div>
                      <Select
                        value={general.terminalShell}
                        options={[
                          { value: "powershell", label: "PowerShell" },
                          { value: "cmd", label: "CMD" },
                          { value: "bash", label: "Bash" },
                        ]}
                        onChange={(v) => updateGeneral("terminalShell", v)}
                      />
                    </div>
                    <div className="settings__control-row">
                      <div className="settings__control-info">
                        <div className="settings__control-label">{t("showThinking")}</div>
                        <div className="settings__control-desc">{t("showThinkingDesc")}</div>
                      </div>
                      <input
                        type="checkbox"
                        className="settings__checkbox"
                        checked={general.showThinking}
                        onChange={(e) => updateGeneral("showThinking", e.target.checked)}
                      />
                    </div>
                  </div>
                </div>

                <div className="settings__subsection">
                  <div className="settings__subsection-title">{t("soundNotifications")}</div>
                  <div className="settings__control-group">
                    <div className="settings__control-row">
                      <div className="settings__control-info">
                        <div className="settings__control-label">{t("soundEnabled")}</div>
                        <div className="settings__control-desc">{t("soundEnabledDesc")}</div>
                      </div>
                      <input
                        type="checkbox"
                        className="settings__checkbox"
                        checked={general.soundEnabled}
                        onChange={(e) => updateGeneral("soundEnabled", e.target.checked)}
                      />
                    </div>
                    <div className="settings__control-row">
                      <div className="settings__control-info">
                        <div className="settings__control-label">{t("soundOnComplete")}</div>
                        <div className="settings__control-desc">{t("soundOnCompleteDesc")}</div>
                      </div>
                      <input
                        type="checkbox"
                        className="settings__checkbox"
                        checked={general.soundOnComplete}
                        onChange={(e) => updateGeneral("soundOnComplete", e.target.checked)}
                      />
                    </div>
                    <div className="settings__control-row">
                      <div className="settings__control-info">
                        <div className="settings__control-label">{t("soundOnStop")}</div>
                        <div className="settings__control-desc">{t("soundOnStopDesc")}</div>
                      </div>
                      <input
                        type="checkbox"
                        className="settings__checkbox"
                        checked={general.soundOnStop}
                        onChange={(e) => updateGeneral("soundOnStop", e.target.checked)}
                      />
                    </div>
                  </div>
                </div>

                {/* Design section moved to its own tab */}
              </>
            ) : activeTab === "design" ? (
              <>
                <div className="settings__subsection" style={{ paddingTop: "var(--settings-py)" }}>
                  <div className="settings__subsection-title">{t("appearance")}</div>
                  <div className="settings__control-group">
                    <div className="settings__control-row">
                      <div className="settings__control-info">
                        <div className="settings__control-label">{t("theme")}</div>
                        <div className="settings__control-desc">{t("themeDesc")}</div>
                      </div>
                      <Select
                        value={currentTheme.id}
                        options={themes.map((t) => ({ value: t.id, label: t.name }))}
                        onChange={(v) => setTheme(v)}
                        onHover={(v) => preview(v)}
                      />
                    </div>
                    <div className="settings__control-row">
                      <div className="settings__control-info">
                        <div className="settings__control-label">{t("colorScheme")}</div>
                        <div className="settings__control-desc">{t("colorSchemeDesc")}</div>
                      </div>
                      <Select
                        value={colorScheme}
                        options={[
                          { value: "dark", label: t("dark") },
                          { value: "light", label: t("light") },
                          { value: "system", label: t("system") },
                        ]}
                        onChange={(v) => setColorScheme(v as "dark" | "light" | "system")}
                      />
                    </div>
                    <div className="settings__control-row">
                      <div className="settings__control-info">
                        <div className="settings__control-label">{t("font")}</div>
                        <div className="settings__control-desc">{t("fontDesc")}</div>
                      </div>
                      <Select
                        value={general.font}
                        options={[
                          { value: "Segoe UI", label: "Segoe UI" },
                          { value: "System", label: t("systemFont") },
                          ...FONT_OPTIONS,
                        ]}
                        onChange={(v) => updateGeneral("font", v)}
                      />
                    </div>
                    <div className="settings__control-row">
                      <div className="settings__control-info">
                        <div className="settings__control-label">{t("codeFont")}</div>
                        <div className="settings__control-desc">{t("codeFontDesc")}</div>
                      </div>
                      <Select
                        value={general.codeFont}
                        options={[
                          { value: "Cascadia Code", label: "Cascadia Code" },
                          { value: "Consolas", label: "Consolas" },
                          { value: "monospace", label: "Monospace" },
                          ...CODE_FONT_OPTIONS,
                        ]}
                        onChange={(v) => updateGeneral("codeFont", v)}
                      />
                    </div>
                  </div>
                </div>

                <div className="settings__subsection">
                  <div className="settings__subsection-title">{t("animations")}</div>
                  <div className="settings__anim-cards">
                    {(
                      [
                        ["projectHover",  "animProjectHover",  "animProjectHoverDesc"],
                        ["projectSwitch", "animProjectSwitch", "animProjectSwitchDesc"],
                        ["sidebarSlide",  "animSidebarSlide",  "animSidebarSlideDesc"],
                        ["contextMenu",   "animContextMenu",   "animContextMenuDesc"],
                        ["buttons",       "animButtons",       "animButtonsDesc"],
                        ["panelAppear",   "animPanelAppear",   "animPanelAppearDesc"],
                      ] as const
                    ).map(([key, labelKey, descKey]) => (
                      <div className="settings__anim-card" key={key}>
                        <div className="settings__anim-card__preview">
                          <InlineAnimPreview animKey={key} animStyle={animSettings[key]} />
                        </div>
                        <div className="settings__anim-card__footer">
                          <div className="settings__anim-card__label">{t(labelKey)}</div>
                          <Select
                            value={animSettings[key]}
                            options={[
                              { value: "fade",       label: t("animStyleFade") },
                              { value: "slide",      label: t("animStyleSlide") },
                              { value: "scale",      label: t("animStyleScale") },
                              { value: "fade-slide", label: t("animStyleFadeSlide") },
                              { value: "none",       label: t("animStyleNone") },
                            ]}
                            onChange={(v) => setAnim(key, v as AnimStyle)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : activeTab === "providers" ? (
              <>
                {connected.length > 0 && (
                  <div className="settings__section">
                    <h3 className="settings__section-title">{t("connectedProviders")}</h3>
                    <div className="settings__providers-list">
                      {connected.map((p) => {
                        const template = PROVIDER_TEMPLATES.find((t) => t.baseUrl === p.baseUrl);
                        return (
                          <div key={p.id} className="settings__provider-row">
                            <div className="settings__provider-info">
                              {template && (
                                <img
                                  src={getProviderIconPath(template.icon, resolvedScheme === "light")}
                                  className="settings__provider-icon"
                                  alt=""
                                />
                              )}
                              <div className="settings__provider-name">{p.name}</div>
                            </div>
                            <div className="settings__provider-actions">
                              <button
                                className="settings__edit-btn"
                                onClick={() => startEdit(p)}
                                title={t("editProvider")}
                              >
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                </svg>
                              </button>
                              <button className="settings__disconnect-btn" onClick={() => disconnect(p.id)}>
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                >
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
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
                    {PROVIDER_TEMPLATES.map((tmpl) => (
                      <div key={tmpl.id} className="settings__provider-row">
                        <div className="settings__provider-info">
                          <img
                            src={getProviderIconPath(tmpl.icon, resolvedScheme === "light")}
                            className="settings__provider-icon"
                            alt=""
                          />
                          <div className="settings__provider-name">{tmpl.name}</div>
                        </div>
                        <button className="settings__connect-btn" onClick={() => startConnect(tmpl)}>
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                          >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          {t("connect")}
                        </button>
                      </div>
                    ))}
                    <div className="settings__provider-row">
                      <div className="settings__provider-info">
                        <div className="settings__provider-icon-placeholder">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </div>
                        <div className="settings__provider-name">{t("customProvider")}</div>
                      </div>
                      <button className="settings__connect-btn" onClick={startCustom}>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        >
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        {t("connect")}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : activeTab === "models" ? (
              <div className="settings__models">
                <div className="settings__models-search">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    className="settings__models-search-input"
                    placeholder={t("searchModels")}
                    value={modelsSearch}
                    onChange={(e) => setModelsSearch(e.target.value)}
                  />
                </div>
                {modelsLoading ? (
                  <div className="settings__models-loading">{t("loadingModels")}</div>
                ) : discoveredModels.length === 0 ? (
                  <div className="settings__models-empty">
                    <p>{t("noModels")}</p>
                  </div>
                ) : (
                  (() => {
                    const query = modelsSearch.toLowerCase();
                    const filtered = query
                      ? discoveredModels.filter(
                          (m) => m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query),
                        )
                      : discoveredModels;
                    const groups = new Map<string, DiscoveredModel[]>();
                    for (const m of filtered) {
                      const existing = groups.get(m.providerId) ?? [];
                      existing.push(m);
                      groups.set(m.providerId, existing);
                    }
                    const groupsArray = Array.from(groups.entries());
                    return (
                      <div className="settings__models-table">
                        {groupsArray.map(([providerId, models]) => {
                          const template = PROVIDER_TEMPLATES.find((t) => t.id === providerId);
                          const icon = template?.icon ?? "";
                          const name = template?.name ?? models[0]?.providerName ?? providerId;
                          const isCollapsed = !!collapsedProviders[providerId];
                          return (
                            <div key={providerId} className="settings__models-group">
                              <div
                                className="settings__models-group-header"
                                onClick={() => toggleProviderCollapse(providerId)}
                              >
                                <ChevronRightIcon open={!isCollapsed} />
                                {icon && (
                                  <img
                                    src={getProviderIconPath(icon, resolvedScheme === "light")}
                                    className="settings__provider-icon"
                                    alt=""
                                  />
                                )}
                                <span>{name}</span>
                              </div>
                              <div
                                className={`settings__models-list ${isCollapsed ? "settings__models-list--collapsed" : ""}`}
                              >
                                {models.map((m) => (
                                  <div key={m.id} className="settings__model-row">
                                    <div className="settings__model-info">
                                      <span className="settings__model-name">{m.name}</span>
                                    </div>
                                    <input
                                      type="checkbox"
                                      className="settings__checkbox"
                                      checked={enabledModels.has(m.id)}
                                      onChange={() => toggleModel(m.id)}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>
            ) : (
              <div className="settings__section">
                {!shortcuts || shortcuts.length === 0 ? (
                  <div className="settings__models-empty">
                    <p>{t("noHotkeys")}</p>
                  </div>
                ) : (
                  <div className="settings__hotkeys-list">
                    {shortcuts.map((h) => {
                      const isRecording = recordingId === h.id;
                      return (
                        <div key={h.id} className="settings__control-row">
                          <div className="settings__control-info">
                            <div className="settings__control-label">{h.label}</div>
                          </div>
                          <button
                            className={"settings__hotkey-btn" + (isRecording ? " settings__hotkey-btn--recording" : "")}
                            onClick={() => {
                              if (isRecording) return;
                              setRecordingId(h.id);
                              setErrorMsg(null);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              onResetBinding?.(h.id);
                            }}
                          >
                            {isRecording ? "..." : h.keys}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {errorMsg && <div className="settings__hotkeys-error">{errorMsg}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <ConnectPopup          template={editing.template}
          custom={editing.custom}
          editId={editing.editId}
          editProvider={editing.editId ? providers.find((p) => p.id === editing.editId) : null}
          onConnect={async (formData) => {
            if (editing.editId) {
              const updated = providers.map((p) =>
                p.id === editing.editId
                  ? {
                      ...p,
                      name: formData.name || p.name,
                      apiKey: formData.apiKey,
                      model: formData.model,
                      baseUrl: formData.baseUrl,
                    }
                  : p,
              );
              const p = updated.find((x) => x.id === editing.editId)!;
              await window.vibe.providers.save(p);
              await save(updated);
              window.vibe.setProvider(p.apiKey, p.baseUrl, p.model, p.id);
              onProviderChanged?.(p.model, p.baseUrl);
            } else {
              const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
              const newP: Provider = {
                id,
                name: formData.name || (editing.template?.name ?? "Custom"),
                description: formData.baseUrl,
                baseUrl: formData.baseUrl,
                apiKey: formData.apiKey,
                model: formData.model,
                addedAt: Date.now(),
              };
              await window.vibe.providers.save(newP);
              await save([...providers, newP]);
              window.vibe.setProvider(newP.apiKey, newP.baseUrl, newP.model, newP.id);
              onProviderChanged?.(newP.model, newP.baseUrl);
            }
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
