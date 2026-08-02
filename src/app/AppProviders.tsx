import type React from "react";
import type { LangCode } from "@/shared/i18n";
import { I18nProvider } from "@/shared/i18n/useI18n";
import { ThemeProvider } from "@/shared/themes/useTheme";
import { AnimationProvider } from "@/shared/ui/animations/useAnimations";

interface AppProvidersProps {
  lang: string;
  children: React.ReactNode;
}

/** Composition of global context providers (theme, i18n, animations). */
export function AppProviders({ lang, children }: AppProvidersProps): React.ReactElement {
  return (
    <ThemeProvider>
      <I18nProvider lang={lang as LangCode}>
        <AnimationProvider>{children}</AnimationProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
