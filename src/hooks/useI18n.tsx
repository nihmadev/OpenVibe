import React, { createContext, useContext, useCallback } from "react";
import { languages, type Translations, type LangCode } from "../i18n/index.js";

type TranslateFn = {
  (key: string): string;
  (key: string, params?: Record<string, string>): string;
};

export interface I18nContextValue {
  t: TranslateFn;
  lang: LangCode;
}

const I18nContext = createContext<I18nContextValue>({
  t: ((key: keyof Translations, _params?: Record<string, string>) => {
    const v = languages["Russian"][key as keyof Translations];
    return v ?? String(key);
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
    ((key: string, params?: Record<string, string>) => {
      let v = dict[key as keyof Translations];
      if (v === undefined) v = languages["Russian"][key as keyof Translations];
      if (v === undefined) v = String(key);
      if (params) {
        for (const [k, val] of Object.entries(params)) {
          v = v.replace(`{${k}}`, val);
        }
      }
      return v;
    }) as TranslateFn,
    [dict],
  );

  return <I18nContext.Provider value={{ t, lang }}>{children}</I18nContext.Provider>;
}
