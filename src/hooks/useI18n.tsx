import React, { createContext, useContext, useCallback } from "react";
import { languages, type Translations, type LangCode } from "../i18n/index.js";

type TranslateFn = {
  (key: string): string;
  (key: string, params?: Record<string, string | number | boolean>): string;
};

export interface I18nContextValue {
  t: TranslateFn;
  lang: LangCode;
}

const SLAVIC_LANGS = new Set<LangCode>([
  "Russian",
  "Ukrainian",
  "Belarusian",
  "Serbian",
  "Polish",
  "Bulgarian",
  "Czech",
]);

function resolvePluralKey(
  key: string,
  params: Record<string, string | number | boolean> | undefined,
  lang: LangCode,
  dict: Record<string, any>,
  ruDict: Record<string, any>,
): string {
  if (!params) return key;
  const countVal =
    params.count !== undefined
      ? params.count
      : Object.values(params).find(
          (v) => typeof v === "number" || (!isNaN(Number(v)) && typeof v !== "boolean" && v !== ""),
        );
  if (countVal === undefined || isNaN(Number(countVal))) return key;

  const count = Math.abs(Number(countVal));
  const mod10 = count % 10;
  const mod100 = count % 100;

  const hasKey = (k: string) => dict[k] !== undefined || ruDict[k] !== undefined;

  if (SLAVIC_LANGS.has(lang) || dict === ruDict) {
    if (mod10 === 1 && mod100 !== 11 && hasKey(`${key}_one`)) {
      return `${key}_one`;
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) && hasKey(`${key}_few`)) {
      return `${key}_few`;
    }
  } else {
    if (count === 1 && hasKey(`${key}_one`)) {
      return `${key}_one`;
    }
    if (count !== 1 && hasKey(`${key}_few`) && !hasKey(key)) {
      return `${key}_few`;
    }
  }
  return key;
}

const I18nContext = createContext<I18nContextValue>({
  t: ((key: keyof Translations, params?: Record<string, string | number | boolean>) => {
    const actualKey = resolvePluralKey(key, params, "Russian", languages["Russian"], languages["Russian"]);
    let v = languages["Russian"][actualKey as keyof Translations];
    if (v === undefined) v = languages["Russian"][key as keyof Translations];
    if (v === undefined) v = String(key);
    if (params) {
      for (const [k, val] of Object.entries(params)) {
        v = v.replace(new RegExp(`\\{${k}\\}`, "g"), String(val));
      }
    }
    return v;
  }) as TranslateFn,
  lang: "Russian",
});

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

export function useTranslate(): TranslateFn {
  return useContext(I18nContext).t;
}

interface Props {
  lang: LangCode;
  children: React.ReactNode;
}

export function I18nProvider({ lang, children }: Props): React.ReactElement {
  const dict = languages[lang] ?? languages["Russian"];
  const t = useCallback<TranslateFn>(
    ((key: string, params?: Record<string, string | number | boolean>) => {
      const actualKey = resolvePluralKey(key, params, lang, dict, languages["Russian"]);
      let v = dict[actualKey as keyof Translations];
      if (v === undefined) v = languages["Russian"][actualKey as keyof Translations];
      if (v === undefined) v = dict[key as keyof Translations];
      if (v === undefined) v = languages["Russian"][key as keyof Translations];
      if (v === undefined) v = String(actualKey);
      if (params) {
        for (const [k, val] of Object.entries(params)) {
          v = v.replace(new RegExp(`\\{${k}\\}`, "g"), String(val));
        }
      }
      return v;
    }) as TranslateFn,
    [dict, lang],
  );

  return <I18nContext.Provider value={{ t, lang }}>{children}</I18nContext.Provider>;
}
