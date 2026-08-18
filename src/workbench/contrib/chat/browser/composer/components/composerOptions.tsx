import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon } from "@/base/browser/ui/icons/iconRegistry";
import { useI18n } from "@/platform/localization/localizationService";
import { modelsDevService } from "@/workbench/services/aiProviders/browser/modelsDevService";
import { ProviderLogo } from "@/workbench/services/aiProviders/browser/providerLogo";
import { PROVIDER_TEMPLATES } from "@/workbench/services/aiProviders/browser/providerTemplates";
import type { Provider } from "@/workbench/services/aiProviders/common/aiProvider";
import { aiProviderService } from "@/workbench/services/aiProviders/tauri/aiProviderService";
import { modelDisplayName } from "../utils/modelDisplay";

interface ModelEntry {
  id: string;
  name: string;
  providerDbId: string;
}

interface ModelGroup {
  providerDbId: string;
  providerId: string;
  providerName: string;
  models: ModelEntry[];
}

interface EffortOption {
  value: string;
  labelKey: string;
}

interface ComposerOptionsProps {
  currentModel: string;
  onPickModel: (id: string, providerDbId?: string) => void;
  onOpenSettings: (tab?: string) => void;
  showReasoningEffort: boolean;
  currentEffort: string | undefined;
  onReasoningEffortChange: (effort: string | null) => void;
  effortOptions: EffortOption[];
  onOpen?: () => void;
}

const CACHE_TTL = 30 * 60 * 1000;
const CACHE_KEY_PREFIX = "models:";
const memCache = new Map<string, { models: ModelEntry[]; expires: number }>();
let diskCacheLoaded = false;

function loadCache(): Map<string, { models: ModelEntry[]; expires: number }> {
  const cache = new Map<string, { models: ModelEntry[]; expires: number }>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(CACHE_KEY_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (raw) cache.set(key.slice(CACHE_KEY_PREFIX.length), JSON.parse(raw));
    }
  } catch {
    // An unavailable or corrupt cache should never block the composer.
  }
  return cache;
}

function saveCache(key: string, models: ModelEntry[], expires: number): void {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify({ models, expires }));
  } catch {
    // Ignore storage quotas and privacy-mode storage failures.
  }
}

function useModelGroups() {
  const [groups, setGroups] = useState<ModelGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      if (!diskCacheLoaded) {
        for (const [key, value] of loadCache()) memCache.set(key, value);
        diskCacheLoaded = true;
      }

      const [providers, enabledIds] = await Promise.all([
        aiProviderService.listProviders() as Promise<Provider[]>,
        aiProviderService.listEnabledModels() as Promise<string[]>,
      ]);
      const enabled = new Set(enabledIds);
      const connected = providers.filter((provider) => provider.apiKey);
      const now = Date.now();
      const results: ModelGroup[] = [];

      await Promise.allSettled(
        connected.map(async (provider) => {
          const matched = modelsDevService.findProviderByUrl(provider.baseUrl);
          const template = matched
            ? PROVIDER_TEMPLATES.find((candidate) => candidate.id === matched.id)
            : PROVIDER_TEMPLATES.find(
                (candidate) =>
                  provider.baseUrl &&
                  candidate.baseUrl &&
                  provider.baseUrl.startsWith(candidate.baseUrl.replace(/\/+$/, "")),
              );
          const providerId = matched?.id ?? template?.id ?? provider.id;
          const cacheKey = `${providerId}:${provider.baseUrl}`;
          let models: ModelEntry[];
          const cached = memCache.get(cacheKey);

          if (cached && cached.expires > now) {
            models = cached.models;
          } else {
            const response = await aiProviderService.fetchModels(provider.baseUrl, provider.apiKey, providerId);
            if (!response.ok) return;
            models = response.models.map((model) => ({
              id: model.id,
              name: model.name,
              providerDbId: provider.id,
            }));
            const expires = now + CACHE_TTL;
            memCache.set(cacheKey, { models, expires });
            saveCache(cacheKey, models, expires);
          }

          const visibleModels = models.filter(
            (model) => enabled.has(`${provider.id}::${model.id}`) || enabled.has(model.id),
          );
          if (visibleModels.length === 0) return;
          results.push({
            providerDbId: provider.id,
            providerId,
            providerName: matched?.name ?? template?.name ?? provider.name,
            models: visibleModels,
          });
        }),
      );

      setGroups(results);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { groups, loading, fetch };
}

export function ComposerOptions({
  currentModel,
  onPickModel,
  onOpenSettings,
  showReasoningEffort,
  currentEffort,
  onReasoningEffortChange,
  effortOptions,
  onOpen,
}: ComposerOptionsProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<"model" | "effort" | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { groups, loading, fetch } = useModelGroups();

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => aiProviderService.onEnabledModelsChange(fetch), [fetch]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setSubmenu(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (submenu) setSubmenu(null);
      else setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, submenu]);

  const activeModel = useMemo(() => {
    for (const group of groups) {
      const model = group.models.find((candidate) => candidate.id === currentModel);
      if (model) return { name: modelDisplayName(model.name), group };
    }
    return { name: modelDisplayName(currentModel) || t("selectModelFallback"), group: null };
  }, [currentModel, groups, t]);

  const activeEffort = useMemo(() => {
    const option = effortOptions.find((candidate) => candidate.value === (currentEffort ?? ""));
    return option ? t(option.labelKey) : currentEffort || t("reasoningEffortNone");
  }, [currentEffort, effortOptions, t]);

  const close = () => {
    setOpen(false);
    setSubmenu(null);
  };

  return (
    <div className="composer-options" ref={rootRef}>
      <button
        type="button"
        className={`composer-options__trigger${open ? " composer-options__trigger--open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setOpen((value) => {
            if (!value) {
              onOpen?.();
              void fetch();
            }
            return !value;
          });
          setSubmenu(null);
        }}
      >
        <span className="composer-options__provider" aria-hidden="true">
          {activeModel.group ? (
            <ProviderLogo providerId={activeModel.group.providerId} style={{ width: 13, height: 13 }} />
          ) : (
            <span className="composer-options__status-dot" />
          )}
        </span>
        <span className="composer-options__summary">
          <span>{activeModel.name}</span>
          {showReasoningEffort && <span className="composer-options__effort-summary">{activeEffort}</span>}
        </span>
        <ChevronDownIcon size={11} />
      </button>

      {open && (
        <div className="composer-options__menu" role="menu" aria-label={t("composerOptions")}>
          <button
            type="button"
            className={`composer-options__row${submenu === "model" ? " composer-options__row--active" : ""}`}
            role="menuitem"
            onMouseEnter={() => setSubmenu("model")}
            onClick={() => setSubmenu("model")}
          >
            <span>{t("composerModel")}</span>
            <span className="composer-options__row-value">{activeModel.name}</span>
            <ChevronRightIcon />
          </button>

          {showReasoningEffort && (
            <button
              type="button"
              className={`composer-options__row${submenu === "effort" ? " composer-options__row--active" : ""}`}
              role="menuitem"
              onMouseEnter={() => setSubmenu("effort")}
              onClick={() => setSubmenu("effort")}
            >
              <span>{t("composerEffort")}</span>
              <span className="composer-options__row-value">{activeEffort}</span>
              <ChevronRightIcon />
            </button>
          )}

          <div className="composer-options__divider" />
          <button
            type="button"
            className="composer-options__row composer-options__row--muted"
            role="menuitem"
            onClick={() => {
              close();
              onOpenSettings("models");
            }}
          >
            <span>{t("configureModels")}</span>
          </button>

          {submenu === "model" && (
            <div className="composer-options__submenu composer-options__submenu--models" role="menu">
              <div className="composer-options__submenu-title">{t("composerModel")}</div>
              {loading && <div className="composer-options__empty">{t("loading")}</div>}
              {!loading && groups.length === 0 && <div className="composer-options__empty">{t("noModelsEnabled")}</div>}
              {groups.map((group) => (
                <div className="composer-options__model-group" key={group.providerDbId}>
                  <div className="composer-options__group-label">
                    <ProviderLogo providerId={group.providerId} style={{ width: 13, height: 13 }} />
                    <span>{group.providerName}</span>
                  </div>
                  {group.models.map((model) => (
                    <button
                      type="button"
                      className={`composer-options__submenu-row${
                        model.id === currentModel ? " composer-options__submenu-row--selected" : ""
                      }`}
                      role="menuitemradio"
                      aria-checked={model.id === currentModel}
                      key={`${group.providerDbId}::${model.id}`}
                      onClick={() => {
                        onPickModel(model.id, group.providerDbId);
                        close();
                      }}
                    >
                      <span>{modelDisplayName(model.name)}</span>
                      {model.id === currentModel && <CheckIcon />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {submenu === "effort" && (
            <div className="composer-options__submenu composer-options__submenu--effort" role="menu">
              <div className="composer-options__submenu-title">{t("composerEffort")}</div>
              {effortOptions.map((option) => {
                const selected = (currentEffort ?? "") === option.value;
                return (
                  <button
                    type="button"
                    className={`composer-options__submenu-row${
                      selected ? " composer-options__submenu-row--selected" : ""
                    }`}
                    role="menuitemradio"
                    aria-checked={selected}
                    key={option.value}
                    onClick={() => {
                      onReasoningEffortChange(option.value || null);
                      close();
                    }}
                  >
                    <span>{t(option.labelKey)}</span>
                    {selected && <CheckIcon />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
