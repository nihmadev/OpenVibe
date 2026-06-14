import { useMemo, useCallback, useState, useEffect } from "react";
import type { VibeConfig } from "../types.js";

export function useModels(
  config: VibeConfig | null,
  setConfig: React.Dispatch<React.SetStateAction<VibeConfig | null>>,
  settingsOpen: boolean,
) {
  const [enabledModels, setEnabledModels] = useState<Set<string>>(new Set());

  useEffect(() => {
    window.vibe.models
      .listEnabled()
      .then((ids) => {
        setEnabledModels(new Set(ids));
      })
      .catch(console.error);
  }, [config?.model, settingsOpen]);

  const connectedModels = useMemo(() => {
    return Array.from(enabledModels).map((id) => ({ id, name: id }));
  }, [enabledModels]);

  const handlePickModel = useCallback(
    (id: string) => {
      window.vibe.setModel(id);
      if (config) setConfig({ ...config, model: id });
    },
    [config, setConfig],
  );

  return {
    connectedModels,
    handlePickModel,
  };
}
