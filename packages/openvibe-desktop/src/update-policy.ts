export type UpdateChoice = "install" | "skip" | "disable" | "invalid";

export function parseUpdateChoice(answer: string): UpdateChoice {
  switch (answer.trim().toLowerCase()) {
    case "y":
    case "yes":
      return "install";
    case "":
    case "n":
    case "no":
      return "skip";
    case "d":
    case "disable":
    case "never":
      return "disable";
    default:
      return "invalid";
  }
}

function parseVersion(version: string): { core: number[]; prerelease: string[] } {
  const normalized = version.trim().replace(/^v/i, "").split("+", 1)[0];
  const [corePart, prereleasePart = ""] = normalized.split("-", 2);
  const core = corePart.split(".").map((part) => {
    const value = Number.parseInt(part, 10);
    return Number.isNaN(value) ? 0 : value;
  });

  return {
    core,
    prerelease: prereleasePart ? prereleasePart.split(".") : [],
  };
}

/** Returns true only when candidate is newer than current. */
export function isNewerVersion(candidate: string, current: string): boolean {
  if (!current || current === "unknown") return true;

  const next = parseVersion(candidate);
  const installed = parseVersion(current);
  const coreLength = Math.max(next.core.length, installed.core.length);

  for (let index = 0; index < coreLength; index += 1) {
    const nextPart = next.core[index] ?? 0;
    const installedPart = installed.core[index] ?? 0;
    if (nextPart !== installedPart) return nextPart > installedPart;
  }

  if (next.prerelease.length === 0 && installed.prerelease.length > 0) return true;
  if (next.prerelease.length > 0 && installed.prerelease.length === 0) return false;

  const prereleaseLength = Math.max(next.prerelease.length, installed.prerelease.length);
  for (let index = 0; index < prereleaseLength; index += 1) {
    const nextPart = next.prerelease[index];
    const installedPart = installed.prerelease[index];
    if (nextPart === undefined) return false;
    if (installedPart === undefined) return true;
    if (nextPart === installedPart) continue;

    const nextNumber = /^\d+$/.test(nextPart) ? Number(nextPart) : null;
    const installedNumber = /^\d+$/.test(installedPart) ? Number(installedPart) : null;
    if (nextNumber !== null && installedNumber !== null) return nextNumber > installedNumber;
    if (nextNumber !== null) return false;
    if (installedNumber !== null) return true;
    return nextPart.localeCompare(installedPart) > 0;
  }

  return false;
}
