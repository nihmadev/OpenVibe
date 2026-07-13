import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Provider } from "../../types.js";
import { PROVIDER_TEMPLATES, getProviderIconPath } from "../../constants.js";
import { useI18n } from "../../hooks/useI18n.js";
import { useTheme } from "../../hooks/useTheme.js";
import { ChevronRightIcon, ChevronDownIcon, SearchMiniIcon, AttachPlusIcon, FilterIcon, CheckIcon } from "../icons/icons.js";

interface ModelGroup {
  providerId: string;
  providerName: string;
  models: Array<{ id: string; name: string }>;
}

interface ModelSelectorProps {
  currentModel: string;
  onPickModel: (id: string) => void;
  onOpenSettings: (tab?: string) => void;
}

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes — model lists rarely change
const CACHE_KEY_PREFIX = "models:";

function loadCache(): Map<string, { models: { id: string; name: string }[]; expires: number }> {
  const cache = new Map<string, { models: { id: string; name: string }[]; expires: number }>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          cache.set(key.slice(CACHE_KEY_PREFIX.length), parsed);
        }
      }
    }
  } catch {
    /* ignore corrupt localStorage */
  }
  return cache;
}

function saveCache(key: string, models: { id: string; name: string }[], expires: number): void {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify({ models, expires }));
  } catch {
    /* localStorage full or unavailable */
  }
}

const memCache = new Map<string, { models: { id: string; name: string }[]; expires: number }>();
let diskCacheLoaded = false;

function useModelGroups() {
  const [groups, setGroups] = useState<ModelGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      // Load localStorage cache on first fetch
      if (!diskCacheLoaded) {
        const disk = loadCache();
        for (const [k, v] of disk) memCache.set(k, v);
        diskCacheLoaded = true;
      }

      const [providers, enabledIds] = await Promise.all([
        window.vibe.providers.list() as Promise<Provider[]>,
        window.vibe.models.listEnabled() as Promise<string[]>,
      ]);
      const enabled = new Set(enabledIds);
      const connected = providers.filter((p) => p.apiKey);
      if (connected.length === 0 || enabled.size === 0) {
        setGroups([]);
        return;
      }

      const now = Date.now();
      const results: ModelGroup[] = [];
      await Promise.allSettled(
        connected.map(async (p) => {
          const template = PROVIDER_TEMPLATES.find(
            (t) => p.baseUrl && t.baseUrl && p.baseUrl.startsWith(t.baseUrl.replace(/\/+$/, "")),
          );
          const providerId = template?.id ?? p.id;
          const providerName = template?.name ?? p.name;
          const cacheKey = `${providerId}:${p.baseUrl}`;

          let models: { id: string; name: string }[];
          const cached = memCache.get(cacheKey);
          if (cached && cached.expires > now) {
            models = cached.models;
          } else {
            const res = await window.vibe.models.fetch(p.baseUrl, p.apiKey, providerId);
            if (!res.ok) return;
            models = res.models;
            const expires = now + CACHE_TTL;
            memCache.set(cacheKey, { models, expires });
            saveCache(cacheKey, models, expires);
          }

          const enabledModels = models.filter((m) => enabled.has(m.id));
          if (enabledModels.length > 0) {
            results.push({ providerId, providerName, models: enabledModels });
          }
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

export function ModelSelector({ currentModel, onPickModel, onOpenSettings }: ModelSelectorProps) {
  const { t } = useI18n();
  const { resolvedScheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const { groups, loading, fetch } = useModelGroups();
  const selRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      fetch().then(() => {
        inputRef.current?.focus();
      });
    } else {
      setSearch("");
    }
  }, [open, fetch]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (selRef.current && !selRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        models: g.models.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)),
      }))
      .filter((g) => g.models.length > 0);
  }, [groups, search]);

  function toggleGroupCollapse(providerId: string): void {
    setCollapsedGroups((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  }

  const activeModelName = useMemo(() => {
    for (const g of groups) {
      const m = g.models.find((m) => m.id === currentModel);
      if (m) return m.name;
    }
    return currentModel || t("selectModelFallback");
  }, [groups, currentModel]);

  return (
    <div className="model-selector" ref={selRef}>
      <button type="button" className="model-selector__trigger" onClick={() => setOpen((v) => !v)}>
        <span className="model-selector__trigger-name">{activeModelName}</span>
        <ChevronDownIcon />
      </button>

      {open && (
        <div className="model-selector__popup" style={{ width: 260 }}>
          <div className="model-selector__header">
            <div className="model-selector__search">
              <SearchMiniIcon />
              <input
                ref={inputRef}
                type="text"
                className="model-selector__search-input"
                placeholder={t("searchModelPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="model-selector__actions">
              <button
                className="model-selector__action-btn"
                title={t("addProvider")}
                onClick={() => {
                  setOpen(false);
                  onOpenSettings("providers");
                }}
              >
                <AttachPlusIcon />
              </button>
              <button
                className="model-selector__action-btn"
                title={t("configureModels")}
                onClick={() => {
                  setOpen(false);
                  onOpenSettings("models");
                }}
              >
                <FilterIcon />
              </button>
            </div>
          </div>

          <div className="model-selector__body">
            {loading ? (
              <div className="model-selector__empty">{t("loadingModels")}</div>
            ) : filtered.length === 0 ? (
              <div className="model-selector__empty">{search ? t("noModelsFound") : t("noModelsEnabled")}</div>
            ) : (
              filtered.map((group, i) => {
                const isCollapsed = !!collapsedGroups[group.providerId];
                return (
                  <div
                    key={group.providerId}
                    className="model-selector__group"
                    style={{ "--delay": i } as React.CSSProperties}
                  >
                    <div className="model-selector__group-name" onClick={() => toggleGroupCollapse(group.providerId)}>
                      {(() => {
                        const tmpl = PROVIDER_TEMPLATES.find((t) => t.id === group.providerId);
                        return tmpl ? (
                          <img
                            src={getProviderIconPath(tmpl.icon, resolvedScheme === "light")}
                            className="model-selector__group-icon"
                            alt=""
                          />
                        ) : null;
                      })()}
                      <span>{group.providerName}</span>
                      <ChevronRightIcon open={!isCollapsed} />
                    </div>
                    <div className={`model-selector__models ${isCollapsed ? "model-selector__models--collapsed" : ""}`}>
                      {group.models.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`model-selector__item ${m.id === currentModel ? "model-selector__item--active" : ""}`}
                          style={{ padding: "6px 16px" }}
                          onClick={() => {
                            onPickModel(m.id);
                            setOpen(false);
                          }}
                        >
                          <span className="model-selector__item-name" style={{ textAlign: "left" }}>
                            {m.name}
                          </span>
                          {m.id === currentModel && (
                            <CheckIcon />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
