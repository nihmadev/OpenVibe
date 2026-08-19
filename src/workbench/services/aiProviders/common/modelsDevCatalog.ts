// Types describing the schema from https://models.dev/api.json

export interface ModelsDevReasoningOption {
  type: "effort" | "toggle" | string;
  values?: string[];
}

export interface ModelsDevLimit {
  context?: number;
  input?: number;
  output?: number;
}

export interface ModelsDevCost {
  input?: number;
  output?: number;
  cache_read?: number;
  cache_write?: number;
}

export interface ModelsDevModalities {
  input?: string[];
  output?: string[];
}

export interface ModelsDevModel {
  id: string;
  name: string;
  description?: string;
  family?: string;
  attachment?: boolean;
  reasoning?: boolean;
  reasoning_options?: ModelsDevReasoningOption[];
  tool_call?: boolean;
  structured_output?: boolean;
  temperature?: boolean;
  modalities?: ModelsDevModalities;
  open_weights?: boolean;
  limit?: ModelsDevLimit;
  cost?: ModelsDevCost;
}

export interface ModelsDevProvider {
  id: string;
  name: string;
  api?: string;
  doc?: string;
  env?: string[];
  npm?: string;
  models?: Record<string, ModelsDevModel>;
}

export type ModelsDevCatalog = Record<string, ModelsDevProvider>;
