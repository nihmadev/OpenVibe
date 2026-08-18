// Provider entities and agent connection config (owned by the providers feature).

export interface KeyValuePair {
  key: string;
  value: string;
}

export interface Provider {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  addedAt: number;
  customIcon?: string | null;
  modelsUrl?: string | null;
  headers?: KeyValuePair[] | null;
  parameters?: KeyValuePair[] | null;
  customModels?: KeyValuePair[] | null;
}

export interface ProviderTemplate {
  id: string;
  name: string;
  icon: string;
  baseUrl: string;
  modelsUrl?: string;
  reasoningEffort?: string[];
  docUrl?: string;
  env?: string[];
}

export interface ModelCost {
  input?: number;
  output?: number;
  cache_read?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLimit?: number;
  outputLimit?: number;
  supportsVision?: boolean;
  supportsReasoning?: boolean;
  cost?: ModelCost;
}

/** Active connection config mirrored from the Rust side. */
export interface VibeConfig {
  model: string;
  baseUrl: string;
  cwd: string;
  autoApprove: boolean;
  apiKey: string;
  apiUrl?: string;
  providerId?: string;
  reasoningEffort?: string;
}
