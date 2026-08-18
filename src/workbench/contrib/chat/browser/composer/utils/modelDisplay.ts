/**
 * Provider APIs sometimes decorate a model label as `Provider: Model` even
 * though the composer already renders the provider logo/group separately.
 */
export function modelDisplayName(name: string): string {
  const trimmed = name.trim();
  const separator = trimmed.indexOf(":");
  if (separator < 1) return trimmed;

  const prefix = trimmed.slice(0, separator).trim();
  const model = trimmed.slice(separator + 1).trim();
  if (!model || prefix.length > 48 || /[/\\]/.test(prefix)) return trimmed;
  return model;
}
