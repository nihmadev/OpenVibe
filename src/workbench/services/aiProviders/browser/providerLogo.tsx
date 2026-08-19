import type React from "react";
import { useState } from "react";
import { useTheme } from "@/platform/theme/themeService";
import { getProviderIconPath, getProviderIconUrl } from "@/workbench/services/aiProviders/browser/providerTemplates";

interface ProviderLogoProps {
  icon?: string | null;
  providerId?: string;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

export function ProviderLogo({
  icon,
  providerId,
  className = "settings__provider-icon",
  style,
  alt = "",
}: ProviderLogoProps): React.ReactElement | null {
  const { resolvedScheme } = useTheme();
  const [useFallback, setUseFallback] = useState(false);

  const rawIcon = icon || providerId || "";
  if (!rawIcon) return null;

  if (rawIcon.startsWith("data:")) {
    return <img src={rawIcon} className={className} style={style} alt={alt} />;
  }

  const isLight = resolvedScheme === "light";
  const primaryUrl = getProviderIconUrl(rawIcon, isLight);
  const fallbackUrl = getProviderIconPath(rawIcon, isLight);

  const src = useFallback ? fallbackUrl : primaryUrl;
  const isRemote = src.startsWith("http://") || src.startsWith("https://");

  const computedStyle: React.CSSProperties = {
    ...style,
    ...(isRemote && !isLight ? { filter: "brightness(0) invert(1)" } : {}),
  };

  return (
    <img
      src={src}
      className={className}
      style={computedStyle}
      alt={alt}
      onError={() => {
        if (!useFallback) {
          setUseFallback(true);
        }
      }}
    />
  );
}
