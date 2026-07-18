import React, { useState, useEffect, useRef, Component, type ReactNode } from "react";
import { useI18n } from "../../hooks/useI18n.js";
import { useTheme } from "../../hooks/useTheme.js";
import { useAnimations } from "../../hooks/useAnimations.js";
import type { AnimKey, AnimStyle } from "../../hooks/useAnimations.js";
import { themes, type ThemeDef } from "../../themes/themes.js";
import { Select } from "../ui/Select.js";
import { NumberInput } from "../ui/NumberInput.js";
import { Toggle } from "../ui/Toggle.js";
import { Button } from "../ui/Button.js";
import { languageOptions } from "../../i18n/index.js";
import { InlineAnimPreview } from "../Settings/AnimationPreviewModal.js";
import "./WelcomeScreen.css";
import "../Settings/Settings.css";

interface WelcomeScreenProps {
  onComplete: () => void;
  onLanguageChange: (lang: string) => void;
}

interface ErrorBoundaryProps {
  onComplete: () => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class WelcomeErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.error("WelcomeScreen error caught by ErrorBoundary:", error);
    this.props.onComplete();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

const POPULAR_THEME_IDS = [
  "gruvbox",
  "monokai",
  "one-dark",
  "nord",
  "cursor",
  "default",
  "everforest",
  "kanagawa",
  "vercel",
];

function WelcomeScreenInner({ onComplete, onLanguageChange }: WelcomeScreenProps): React.ReactElement {
  const { t, lang } = useI18n();
  const { currentTheme, setTheme, colorScheme, setColorScheme } = useTheme();
  const { settings: animSettings, set: setAnim, animMultiplier, setAnimMultiplier } = useAnimations();

  const [step, setStep] = useState<number>(1);
  const [prevStep, setPrevStep] = useState<number>(0);
  const [userName, setUserName] = useState<string>("Developer");
  const [isClosing, setIsClosing] = useState(false);
  const [visible, setVisible] = useState(false);
  const [animDir, setAnimDir] = useState<"forward" | "backward">("forward");
  const bodyRef = useRef<HTMLDivElement>(null);

  const [useProxy, setUseProxy] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false);
  const [showThinking, setShowThinking] = useState(true);
  const [terminalShell, setTerminalShell] = useState("bash");
  const [renderFileTree, setRenderFileTree] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundOnComplete, setSoundOnComplete] = useState(true);
  const [soundOnStop, setSoundOnStop] = useState(true);
  const [editorLigatures, setEditorLigatures] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState("13");
  const [font, setFont] = useState("Segoe UI");

  const applyInterfaceFont = (value: string) => {
    const family = value === "System" ? "system-ui, sans-serif" : `"${value}", sans-serif`;
    document.documentElement.style.setProperty("--sans", family);
  };

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      if (window.vibe?.state?.getSystemUser) {
        window.vibe.state
          .getSystemUser()
          .then((name) => {
            if (name) setUserName(name);
          })
          .catch((error) => {
            void error;
          });
      }
    } catch (error) {
      void error;
    }

    const loadSetting = async (key: string, setter: (v: any) => void, def: string) => {
      try {
        const v = await window.vibe.state.get(key);
        if (v !== null && v !== undefined) setter(v);
      } catch (error) {
        void error;
      }
    };

    loadSetting("settings:useRegionalProxy", (v) => setUseProxy(v === "true"), "true");
    loadSetting("settings:autoAccept", (v) => setAutoAccept(v === "true"), "false");
    loadSetting("settings:showThinking", (v) => setShowThinking(v === "true"), "true");
    loadSetting("settings:terminalShell", setTerminalShell, "bash");
    loadSetting("settings:renderFileTree", (v) => setRenderFileTree(v === "true"), "false");
    loadSetting("settings:soundEnabled", (v) => setSoundEnabled(v === "true"), "true");
    loadSetting("settings:soundOnComplete", (v) => setSoundOnComplete(v === "true"), "true");
    loadSetting("settings:soundOnStop", (v) => setSoundOnStop(v === "true"), "true");
    loadSetting("settings:editorLigatures", (v) => setEditorLigatures(v === "true"), "false");
    loadSetting("settings:editorFontSize", setEditorFontSize, "13");
    loadSetting(
      "settings:font",
      (value) => {
        setFont(value);
        applyInterfaceFont(value);
      },
      "Segoe UI",
    );
  }, []);

  const goToStep = (next: number) => {
    setPrevStep(step);
    setAnimDir(next > step ? "forward" : "backward");
    setStep(next);
  };

  const handleFinish = async () => {
    setIsClosing(true);
    try {
      if (window.vibe?.state?.set) {
        await window.vibe.state.set("onboarding:completed", "true");
      }
    } catch (error) {
      void error;
    }
    const multiplier = parseFloat(animMultiplier);
    const closeDuration = 400 * (Number.isFinite(multiplier) ? Math.max(0.01, multiplier) : 1);
    setTimeout(() => {
      onComplete();
    }, closeDuration);
  };

  const handleProxyToggle = (checked: boolean) => {
    setUseProxy(checked);
    try {
      window.vibe?.state?.set?.("settings:useRegionalProxy", String(checked));
    } catch (error) {
      void error;
    }
  };

  const handleAutoAcceptToggle = (checked: boolean) => {
    setAutoAccept(checked);
    try {
      window.vibe?.state?.set?.("settings:autoAccept", String(checked));
    } catch (error) {
      void error;
    }
  };

  const handleShowThinkingToggle = (checked: boolean) => {
    setShowThinking(checked);
    try {
      window.vibe?.state?.set?.("settings:showThinking", String(checked));
    } catch (error) {
      void error;
    }
  };

  const updateBooleanSetting = (
    key: string,
    checked: boolean,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    setter(checked);
    try {
      window.vibe?.state?.set?.(`settings:${key}`, String(checked));
    } catch (error) {
      void error;
    }
  };

  const handleShellChange = (val: string) => {
    setTerminalShell(val);
    try {
      window.vibe?.state?.set?.("settings:terminalShell", val);
    } catch (error) {
      void error;
    }
  };

  const handleFontChange = (val: string) => {
    setFont(val);
    applyInterfaceFont(val);
    try {
      window.vibe?.state?.set?.("settings:font", val);
    } catch (error) {
      void error;
    }
  };

  const handleEditorFontSizeChange = (val: string) => {
    setEditorFontSize(val);
    try {
      window.vibe?.state?.set?.("settings:editorFontSize", val);
    } catch (error) {
      void error;
    }
  };

  const handleSetTheme = (id: string) => {
    try {
      setTheme(id);
    } catch (err) {
      console.warn("Failed to apply theme:", err);
    }
  };

  const popularThemes: ThemeDef[] = POPULAR_THEME_IDS.map(
    (id) => themes.find((th) => th.id === id) ?? themes[0]!,
  ).filter((th): th is ThemeDef => !!th);

  const slidePage = (s: number) => {
    if (s === step) return "ws-page--active";
    const dir = animDir;
    if (dir === "forward") {
      return s < step ? "ws-page--left" : "ws-page--right";
    }
    return s > step ? "ws-page--right" : "ws-page--left";
  };

  return (
    <div
      className={`welcome-screen ${isClosing ? "welcome-screen--closing" : ""} ${visible ? "welcome-screen--visible" : ""}`}
    >
      <div className={`ws-card ${step >= 3 ? "ws-card--settings" : ""}`}>
        <div className="ws-card-header">
          <div className="ws-progress-dots">
            <div className={`ws-dot ${step === 1 ? "ws-dot--active" : ""}`} onClick={() => goToStep(1)} />
            <div className={`ws-dot ${step === 2 ? "ws-dot--active" : ""}`} onClick={() => goToStep(2)} />
            <div className={`ws-dot ${step === 3 ? "ws-dot--active" : ""}`} onClick={() => goToStep(3)} />
            <div className={`ws-dot ${step === 4 ? "ws-dot--active" : ""}`} onClick={() => goToStep(4)} />
          </div>
        </div>

        <div className="ws-pages" ref={bodyRef}>
          <div className={`ws-page ${slidePage(1)}`} key="p1">
            <div className="ws-greeting">
              <img className="ws-app-logo" src="/icons/etc/icon.png" alt="OpenVibe" />
              <h1 className="ws-greeting-title">{t("welcomeGreeting", { name: userName })}</h1>
              <p className="ws-greeting-sub">{t("welcomeThanks")}</p>
            </div>
          </div>

          <div className={`ws-page ${slidePage(2)}`} key="p2">
            <div className="ws-step-header">
              <h2 className="ws-step-title">{t("onboardingStepThemeTitle")}</h2>
              <p className="ws-step-sub">{t("onboardingStepThemeDesc")}</p>
            </div>
            <div className="ws-themes-grid">
              {popularThemes.map((th) => {
                const isActive = currentTheme?.id === th.id;
                const darkVars = th.darkVars || {};
                const bg = darkVars["--bg"] || "#1a1a1a";
                const accent = darkVars["--accent"] || "#888";
                const kw = darkVars["--syntax-keyword"] || accent;
                const str = darkVars["--syntax-string"] || "#86efac";
                return (
                  <div
                    key={th.id}
                    className={`ws-theme-card ${isActive ? "ws-theme-card--active" : ""}`}
                    onClick={() => handleSetTheme(th.id)}
                  >
                    <div className="ws-theme-preview" style={{ background: bg }}>
                      <div className="ws-theme-pills">
                        <div className="ws-theme-pill" style={{ background: accent }} />
                        <div className="ws-theme-pill" style={{ background: kw }} />
                        <div className="ws-theme-pill" style={{ background: str }} />
                      </div>
                      <div className="ws-theme-code-mock">
                        <div className="ws-theme-bar" style={{ width: "35%", background: kw }} />
                        <div className="ws-theme-bar" style={{ width: "45%", background: str }} />
                      </div>
                    </div>
                    <div className="ws-theme-name">
                      <span>{th.name || th.id}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`ws-page ws-page--settings ${slidePage(3)}`} key="p3">
            <div className="ws-step-header">
              <h2 className="ws-step-title">{t("onboardingStepSettingsTitle")}</h2>
              <p className="ws-step-sub">{t("onboardingStepSettingsDesc")}</p>
            </div>
            <div className="ws-settings-panels">
              <div className="ws-settings-panel">
                <div className="ws-settings-panel-title">{t("general")}</div>
                <div className="ws-setting-item">
                  <div className="ws-setting-info">
                    <span className="ws-setting-label">{t("language")}</span>
                    <span className="ws-setting-desc">{t("languageDesc")}</span>
                  </div>
                  <div className="ws-setting-control">
                    <Select
                      options={languageOptions}
                      value={lang || "English"}
                      onChange={(newLang) => {
                        onLanguageChange(newLang);
                        try {
                          window.vibe?.state?.set?.("settings:language", newLang);
                        } catch (error) {
                          void error;
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="ws-setting-item">
                  <div className="ws-setting-info">
                    <span className="ws-setting-label">{t("terminalShell")}</span>
                    <span className="ws-setting-desc">{t("terminalShellDesc")}</span>
                  </div>
                  <div className="ws-setting-control">
                    <Select
                      options={[
                        { value: "bash", label: "Bash" },
                        { value: "powershell", label: "PowerShell" },
                        { value: "cmd", label: "CMD" },
                      ]}
                      value={terminalShell}
                      onChange={handleShellChange}
                    />
                  </div>
                </div>

                <div className="ws-setting-item">
                  <div className="ws-setting-info">
                    <span className="ws-setting-label">{t("showThinking")}</span>
                    <span className="ws-setting-desc">{t("showThinkingDesc")}</span>
                  </div>
                  <div className="ws-setting-control">
                    <Toggle checked={showThinking} onValueChange={handleShowThinkingToggle} />
                  </div>
                </div>

                <div className="ws-setting-item">
                  <div className="ws-setting-info">
                    <span className="ws-setting-label">{t("autoAccept")}</span>
                    <span className="ws-setting-desc">{t("autoAcceptDesc")}</span>
                  </div>
                  <div className="ws-setting-control">
                    <Toggle checked={autoAccept} onValueChange={handleAutoAcceptToggle} />
                  </div>
                </div>

                <div className="ws-setting-item">
                  <div className="ws-setting-info">
                    <span className="ws-setting-label">{t("useRegionalProxy")}</span>
                    <span className="ws-setting-desc">{t("useRegionalProxyDesc")}</span>
                  </div>
                  <div className="ws-setting-control">
                    <Toggle checked={useProxy} onValueChange={handleProxyToggle} />
                  </div>
                </div>

                <div className="ws-setting-item">
                  <div className="ws-setting-info">
                    <span className="ws-setting-label">{t("soundEnabled")}</span>
                    <span className="ws-setting-desc">{t("soundEnabledDesc")}</span>
                  </div>
                  <div className="ws-setting-control">
                    <Toggle
                      checked={soundEnabled}
                      onValueChange={(checked) => updateBooleanSetting("soundEnabled", checked, setSoundEnabled)}
                    />
                  </div>
                </div>

                <div className="ws-setting-item">
                  <div className="ws-setting-info">
                    <span className="ws-setting-label">{t("soundOnStop")}</span>
                    <span className="ws-setting-desc">{t("soundOnStopDesc")}</span>
                  </div>
                  <div className="ws-setting-control">
                    <Toggle
                      checked={soundOnStop}
                      onValueChange={(checked) => updateBooleanSetting("soundOnStop", checked, setSoundOnStop)}
                    />
                  </div>
                </div>
              </div>

              <div className="ws-settings-panel">
                <div className="ws-settings-panel-title">{t("design")}</div>
                <div className="ws-setting-item">
                  <div className="ws-setting-info">
                    <span className="ws-setting-label">{t("animationSpeed")}</span>
                    <span className="ws-setting-desc">{t("animationSpeedDesc")}</span>
                  </div>
                  <div className="ws-setting-control">
                    <NumberInput value={animMultiplier} step={0.1} min={0} max={5} onChange={setAnimMultiplier} />
                  </div>
                </div>
                <div className="ws-setting-item">
                  <div className="ws-setting-info">
                    <span className="ws-setting-label">{t("renderFileTree")}</span>
                    <span className="ws-setting-desc">{t("renderFileTreeDesc")}</span>
                  </div>
                  <div className="ws-setting-control">
                    <Toggle
                      checked={renderFileTree}
                      onValueChange={(checked) => updateBooleanSetting("renderFileTree", checked, setRenderFileTree)}
                    />
                  </div>
                </div>

                <div className="ws-setting-item">
                  <div className="ws-setting-info">
                    <span className="ws-setting-label">{t("soundOnComplete")}</span>
                    <span className="ws-setting-desc">{t("soundOnCompleteDesc")}</span>
                  </div>
                  <div className="ws-setting-control">
                    <Toggle
                      checked={soundOnComplete}
                      onValueChange={(checked) => updateBooleanSetting("soundOnComplete", checked, setSoundOnComplete)}
                    />
                  </div>
                </div>

                <div className="ws-setting-item">
                  <div className="ws-setting-info">
                    <span className="ws-setting-label">{t("editorLigatures")}</span>
                    <span className="ws-setting-desc">{t("editorLigaturesDesc")}</span>
                  </div>
                  <div className="ws-setting-control">
                    <Toggle
                      checked={editorLigatures}
                      onValueChange={(checked) => updateBooleanSetting("editorLigatures", checked, setEditorLigatures)}
                    />
                  </div>
                </div>

                <div className="ws-setting-item">
                  <div className="ws-setting-info">
                    <span className="ws-setting-label">{t("editorFontSize")}</span>
                    <span className="ws-setting-desc">{t("editorFontSizeDesc")}</span>
                  </div>
                  <div className="ws-setting-control">
                    <NumberInput
                      value={editorFontSize}
                      step={1}
                      min={8}
                      max={32}
                      onChange={handleEditorFontSizeChange}
                    />
                  </div>
                </div>

                <div className="ws-setting-item">
                  <div className="ws-setting-info">
                    <span className="ws-setting-label">{t("colorScheme")}</span>
                    <span className="ws-setting-desc">{t("colorSchemeDesc")}</span>
                  </div>
                  <div className="ws-setting-control">
                    <Select
                      options={[
                        { value: "dark", label: t("dark") },
                        { value: "light", label: t("light") },
                        { value: "system", label: t("system") },
                      ]}
                      value={colorScheme}
                      onChange={(value) => setColorScheme(value as "dark" | "light" | "system")}
                    />
                  </div>
                </div>

                <div className="ws-setting-item">
                  <div className="ws-setting-info">
                    <span className="ws-setting-label">{t("font")}</span>
                    <span className="ws-setting-desc">{t("fontDesc")}</span>
                  </div>
                  <div className="ws-setting-control">
                    <Select
                      options={[
                        { value: "Segoe UI", label: "Segoe UI", fontFamily: "Segoe UI" },
                        { value: "System", label: t("systemFont") },
                        { value: "Arial", label: "Arial", fontFamily: "Arial" },
                        { value: "Verdana", label: "Verdana", fontFamily: "Verdana" },
                      ]}
                      value={font}
                      onChange={handleFontChange}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`ws-page ws-page--settings ws-page--animations ${slidePage(4)}`} key="p4">
            <div className="ws-step-header">
              <h2 className="ws-step-title">{t("onboardingStepAnimationTitle")}</h2>
              <p className="ws-step-sub">{t("onboardingStepAnimationDesc")}</p>
            </div>
            <div className="settings__anim-cards ws-animation-grid">
              {(
                [
                  ["projectHover", "animProjectHover", "animProjectHoverDesc"],
                  ["projectSwitch", "animProjectSwitch", "animProjectSwitchDesc"],
                  ["sidebarSlide", "animSidebarSlide", "animSidebarSlideDesc"],
                  ["contextMenu", "animContextMenu", "animContextMenuDesc"],
                  ["buttons", "animButtons", "animButtonsDesc"],
                  ["panelAppear", "animPanelAppear", "animPanelAppearDesc"],
                ] as const
              ).map(([key, labelKey, descKey]) => (
                <div className="settings__anim-card ws-animation-card" key={key}>
                  <div className="settings__anim-card__preview ws-animation-card-preview">
                    <InlineAnimPreview animKey={key} animStyle={animSettings[key]} />
                  </div>
                  <div className="settings__anim-card__footer">
                    <div className="settings__anim-card__label">{t(labelKey)}</div>
                    <span className="ws-animation-card-desc">{t(descKey)}</span>
                    <Select
                      value={animSettings[key]}
                      options={[
                        { value: "fade", label: t("animStyleFade") },
                        { value: "slide", label: t("animStyleSlide") },
                        { value: "scale", label: t("animStyleScale") },
                        { value: "fade-slide", label: t("animStyleFadeSlide") },
                        { value: "none", label: t("animStyleNone") },
                      ]}
                      onChange={(value) => setAnim(key as AnimKey, value as AnimStyle)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`ws-card-footer ${step === 1 ? "ws-card-footer--start" : ""}`}>
          {step === 1 ? (
            <Button className="ws-start-button" variant="primary" onClick={() => goToStep(2)}>
              {t("letsVibeBtn")}
            </Button>
          ) : (
            <>
              <div className="ws-card-footer-left">
                <Button variant="ghost" onClick={() => goToStep(step - 1)}>
                  {t("backBtn")}
                </Button>
              </div>
              <div className="ws-card-footer-right">
                {step === 2 && (
                  <Button variant="primary" onClick={() => goToStep(3)}>
                    {t("continueBtn")}
                  </Button>
                )}
                {step === 3 && (
                  <Button variant="primary" onClick={() => goToStep(4)}>
                    {t("continueBtn")}
                  </Button>
                )}
                {step === 4 && (
                  <Button variant="primary" onClick={handleFinish}>
                    {t("startVibingBtn")}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function WelcomeScreen(props: WelcomeScreenProps): React.ReactElement {
  return (
    <WelcomeErrorBoundary onComplete={props.onComplete}>
      <WelcomeScreenInner {...props} />
    </WelcomeErrorBoundary>
  );
}
