import type React from "react";
import { AnimationProvider } from "@/platform/configuration/browser/animationService";
import type { LangCode } from "@/platform/localization/localizationCatalog";
import { I18nProvider } from "@/platform/localization/localizationService";
import { ThemeProvider } from "@/platform/theme/themeService";
import { GeneralSettingsProvider } from "@/workbench/contrib/preferences/browser/useGeneralSettings";

interface AppProvidersProps {
  lang: string;
  children: React.ReactNode;
}

/** Composition of global context providers (theme, i18n, animations). */
export function AppProviders({ lang, children }: AppProvidersProps): React.ReactElement {
  return (
    <ThemeProvider>
      <GeneralSettingsProvider>
        <I18nProvider lang={lang as LangCode}>
          <AnimationProvider>{children}</AnimationProvider>
        </I18nProvider>
      </GeneralSettingsProvider>
    </ThemeProvider>
  );
}
