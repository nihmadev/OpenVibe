#!/usr/bin/env node

import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { getInstallDir, getBinDir, checkForUpdate, downloadAndVerify } from "./updater.js";

const VERSION_FILE = join(getInstallDir(), ".version");
const CACHE_FILE = join(getInstallDir(), ".cache.json");

interface CacheData {
  version: string;
  binaryPath: string;
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

async function getOrDownloadBinary(): Promise<string> {
  // Check cache first
  const cache = await readCache();
  if (cache && existsSync(cache.binaryPath)) {
    return cache.binaryPath;
  }

  // Check version file
  let currentVersion = "";
  try {
    currentVersion = (await readFile(VERSION_FILE, "utf-8")).trim();
  } catch {
    currentVersion = "";
  }

  const info = await checkForUpdate(VERSION_FILE);
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
    console.log(cache?.version || "unknown");
    process.exit(0);
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`OpenVibe Desktop — open-source agentic coding environment

Usage:
  openvibe [options]

Options:
  --version, -v   Show version
  --help, -h      Show this help
  --update        Force update check`);
    process.exit(0);
  }

  if (args.includes("--update")) {
    console.log("Checking for updates...");
    const info = await checkForUpdate(VERSION_FILE);
    if (!info) {
      console.log("No update available or failed to check");
      process.exit(1);
    }
    const cache = await readCache();
    if (cache?.version === info.version) {
      console.log(`Already up-to-date (v${info.version})`);
      process.exit(0);
    }
    console.log(`Updating to v${info.version}...`);
    const binaryPath = await downloadAndVerify(info);
    console.log(`Updated to v${info.version}`);
    process.exit(0);
  }

  try {
    const binaryPath = await getOrDownloadBinary();

    const child = spawn(binaryPath, args, {
      stdio: "inherit",
      env: { ...process.env },
    });

    child.on("exit", (code) => {
      process.exit(code ?? 0);
    });

    child.on("error", (err) => {
      console.error(`Failed to launch OpenVibe: ${err.message}`);
      process.exit(1);
    });
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
