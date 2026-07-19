#!/usr/bin/env node

import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { getInstallDir, getBinDir, checkForUpdate, downloadAndVerify, type UpdateInfo } from "./updater.js";
import { isNewerVersion, parseUpdateChoice, type UpdateChoice } from "./update-policy.js";
import { status, ui } from "./ui.js";

const CACHE_FILE = join(getInstallDir(), ".cache.json");

interface CacheData {
  version: string;
  binaryPath: string;
  checkForUpdates?: boolean;
}

async function readCache(): Promise<CacheData | null> {
  try {
    const data = await readFile(CACHE_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function writeCache(data: CacheData): Promise<void> {
  await mkdir(getInstallDir(), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
}

/**
 * Older versions could leave .cache.json behind while the updater had already
 * switched the bin symlink. The version marker next to the active binary is
 * the source of truth, so reconcile the cache before checking for updates.
 */
async function reconcileCache(cache: CacheData): Promise<CacheData> {
  const markerPaths = [
    join(getBinDir(), ".version"),
    join(dirname(cache.binaryPath), ".version"),
    join(getInstallDir(), ".version"),
  ];
  for (const markerPath of markerPaths) {
    try {
      const installedVersion = (await readFile(markerPath, "utf8")).trim();
      if (installedVersion && installedVersion !== cache.version) {
        const updatedCache = { ...cache, version: installedVersion };
        await writeCache(updatedCache);
        return updatedCache;
      }
      if (installedVersion) return cache;
    } catch {
      // Try the next marker location.
    }
  }

  return cache;
}

async function askToUpdate(info: UpdateInfo, currentVersion: string): Promise<UpdateChoice> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      const answer = await prompt.question(
        `\n${ui.brand("OpenVibe")} ${ui.muted("update available")}\n\n  ${ui.muted("Installed")}  ${ui.accent(`v${currentVersion}`)}\n  ${ui.muted("Latest")}     ${ui.success(`v${info.version}`)}\n\n${ui.heading("Install this update?")} ${ui.dim("[Y]es / [N]ot now / [D]on't ask again")}: `,
      );
      const choice = parseUpdateChoice(answer);
      if (choice !== "invalid") return choice;
      console.log(status("warning", "Please enter y, n, or d."));
    }
  } finally {
    prompt.close();
  }
}

async function maybeUpdate(cache: CacheData): Promise<CacheData> {
  if (cache.checkForUpdates === false) return cache;

  let info: UpdateInfo | null;
  try {
    info = await checkForUpdate();
  } catch {
    return cache;
  }

  if (!info || !isNewerVersion(info.version, cache.version)) return cache;

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(status("info", `${ui.success(`v${info.version}`)} is available. Run ${ui.accent("openvibe --update")} to install it.`));
    return cache;
  }

  const choice = await askToUpdate(info, cache.version);
  if (choice === "disable") {
    const updatedCache = { ...cache, checkForUpdates: false };
    await writeCache(updatedCache);
    console.log(status("info", `Automatic update checks disabled. Run ${ui.accent("openvibe --enable-update-checks")} to enable them again.`));
    return updatedCache;
  }
  if (choice !== "install") return cache;

  try {
    const binaryPath = await downloadAndVerify(info);
    const updatedCache = { ...cache, version: info.version, binaryPath };
    await writeCache(updatedCache);
    console.log(status("success", `Updated to ${ui.success(`v${info.version}`)}`));
    return updatedCache;
  } catch (error) {
    console.warn(status("warning", `Update failed; starting ${ui.accent(`v${cache.version}`)}: ${error instanceof Error ? error.message : String(error)}`));
    return cache;
  }
}

async function getOrDownloadBinary(): Promise<string> {
  // Check cache first
  const cache = await readCache();
  if (cache && existsSync(cache.binaryPath)) {
    const reconciledCache = await reconcileCache(cache);
    return (await maybeUpdate(reconciledCache)).binaryPath;
  }

  const info = await checkForUpdate();
  if (!info) {
    throw new Error("failed to fetch latest release info");
  }

  const binaryPath = await downloadAndVerify(info);
  await writeCache({ version: info.version, binaryPath });

  return binaryPath;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--version") || args.includes("-v")) {
    const cache = await readCache();
    if (cache) {
      const reconciledCache = await reconcileCache(cache);
      console.log(reconciledCache.version || "unknown");
    } else {
      console.log("unknown");
    }
    process.exit(0);
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`\n${ui.brand("◆ OpenVibe Desktop")}\n${ui.muted("A calm, open-source agentic coding environment")}\n\n${ui.heading("Usage")}\n  ${ui.accent("openvibe")} ${ui.muted("[options]")}\n\n${ui.heading("Options")}\n  ${ui.accent("-v, --version")}            Show installed version\n  ${ui.accent("-h, --help")}               Show this help\n  ${ui.accent("--update")}                 Check for and install updates\n  ${ui.accent("--no-update-checks")}      Skip checks before startup\n  ${ui.accent("--enable-update-checks")}  Re-enable update checks\n\n${ui.muted("Tip: run openvibe from any project directory to launch the desktop app.")}\n`);
    process.exit(0);
  }

  if (args.includes("--no-update-checks") || args.includes("--enable-update-checks")) {
    const rawCache = await readCache();
    const cache = rawCache ? await reconcileCache(rawCache) : null;
    if (!cache) {
      console.log(status("warning", "OpenVibe is not installed yet. Run openvibe first."));
      process.exit(1);
    }
    const enabled = args.includes("--enable-update-checks");
    await writeCache({ ...cache, checkForUpdates: enabled });
    console.log(status("success", `Automatic update checks ${enabled ? "enabled" : "disabled"}.`));
    process.exit(0);
  }

  if (args.includes("--update")) {
    console.log(`\n${ui.brand("OpenVibe")} ${ui.muted("· update")}`);
    console.log(`${ui.rule()}\n${status("info", "Checking for updates…")}`);
    const info = await checkForUpdate();
    if (!info) {
      console.log(status("warning", "No update available, or the update service could not be reached."));
      process.exit(1);
    }
    const rawCache = await readCache();
    const cache = rawCache ? await reconcileCache(rawCache) : null;
    if (cache && !isNewerVersion(info.version, cache.version)) {
      console.log(status("success", `Already up to date · ${ui.success(`v${cache.version}`)}`));
      process.exit(0);
    }
    console.log(status("info", `Installing ${ui.accent(`v${info.version}`)}…`));
    const binaryPath = await downloadAndVerify(info);
    await writeCache({
      version: info.version,
      binaryPath,
      checkForUpdates: cache?.checkForUpdates,
    });
    console.log(status("success", `Updated to ${ui.success(`v${info.version}`)}`));
    process.exit(0);
  }

  try {
    const binaryPath = await getOrDownloadBinary();

    const child = spawn(binaryPath, args, {
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    });

    child.unref();
    process.exit(0);
  } catch (err) {
    console.error(status("error", err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(status("error", error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
