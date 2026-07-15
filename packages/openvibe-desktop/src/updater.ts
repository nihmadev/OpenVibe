import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import { join } from "node:path";
import { get } from "node:https";
import { request as httpGet } from "node:http";
import { exec as execCb } from "node:child_process";

const GITHUB_REPO = "nihmadev/OpenVibe";
const API_BASE = process.env.OPENVIBE_API_URL || `https://api.github.com/repos/${GITHUB_REPO}`;

export interface UpdateInfo {
  version: string;
  releaseUrl: string;
  platform: string;
  arch: string;
  url: string;
  sha256?: string;
}

export interface PlatformInfo {
  platform: string;
  arch: string;
}

export function getPlatform(): PlatformInfo {
  const archMap: Record<string, string> = {
    x64: "x64",
    arm64: "arm64",
    ia32: "x86",
  };

  const platformMap: Record<string, string> = {
    linux: "linux",
    darwin: "macos",
    win32: "windows",
  };

  const platform = platformMap[process.platform];
  const arch = archMap[process.arch];

  if (!platform) throw new Error(`unsupported platform: ${process.platform}`);
  if (!arch) throw new Error(`unsupported arch: ${process.arch}`);

  return { platform, arch };
}

export function getInstallDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  return join(home, ".openvibe");
}

export function getBinDir(): string {
  return join(getInstallDir(), "bin");
}

export function getVersionDir(version: string): string {
  return join(getInstallDir(), "versions", version);
}

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? get : httpGet;
    const req = protocol(url, { headers: { Accept: "application/json", "User-Agent": "openvibe-desktop" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`invalid JSON: ${data.slice(0, 200)}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? get : httpGet;
    const req = protocol(url, { headers: { "User-Agent": "openvibe-desktop" } }, async (res) => {
      if (!res.statusCode || res.statusCode >= 300) {
        reject(new Error(`download failed: HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of res) chunks.push(chunk as Buffer);
      await mkdir(join(dest, ".."), { recursive: true });
      await writeFile(dest, Buffer.concat(chunks));
      resolve();
    });
    req.on("error", reject);
    req.end();
  });
}

export async function checkForUpdate(versionFile: string): Promise<UpdateInfo | null> {
  const { platform, arch } = getPlatform();

  try {
    const baseURL = API_BASE.replace(/\/+$/, "");
    const url = `${baseURL}/releases/latest`;

    // Try the Go API first
    if (!process.env.OPENVIBE_API_URL && baseURL.includes("api.github.com")) {
      return await checkViaGitHub(platform, arch);
    }

    const data = await fetchJSON(`${baseURL}/updates/latest?platform=${platform}&arch=${arch}`);
    return data as UpdateInfo;
  } catch {
    // Fallback to GitHub API
    return await checkViaGitHub(platform, arch);
  }
}

async function checkViaGitHub(platform: string, arch: string): Promise<UpdateInfo | null> {
  const data = await fetchJSON(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
  const version = (data.tag_name as string).replace(/^v/, "");

  const extMap: Record<string, string> = {
    linux: ".tar.gz",
    macos: ".dmg",
    windows: ".exe",
  };

  const ext = extMap[platform];
  if (!ext) return null;

  const asset = (data.assets as any[]).find(
    (a) => (a.name as string).endsWith(ext) && (a.name as string).includes(platform),
  );

  if (!asset) return null;

  return {
    version,
    releaseUrl: `https://github.com/${GITHUB_REPO}/releases/tag/${data.tag_name}`,
    platform,
    arch,
    url: asset.browser_download_url,
  };
}

export async function downloadAndVerify(info: UpdateInfo): Promise<string> {
  const versionDir = getVersionDir(info.version);
  const binDir = getBinDir();

  await mkdir(versionDir, { recursive: true });
  await mkdir(binDir, { recursive: true });

  const fileName = info.url.split("/").pop() || `openvibe-${info.platform}-${info.arch}`;
  const filePath = join(versionDir, fileName);

  if (existsSync(filePath)) {
    if (info.sha256) {
      const hash = await sha256File(filePath);
      if (hash === info.sha256) {
        return makeExecutableAndLink(filePath, binDir, info);
      }
    } else {
      return makeExecutableAndLink(filePath, binDir, info);
    }
  }

  console.log(`Downloading OpenVibe ${info.version} (${info.platform}-${info.arch})...`);
  await downloadFile(info.url, filePath);

  if (info.sha256) {
    const hash = await sha256File(filePath);
    if (hash !== info.sha256) {
      await unlink(filePath);
      throw new Error(`SHA256 mismatch: expected ${info.sha256}, got ${hash}`);
    }
    console.log("SHA256 verified");
  }

  return makeExecutableAndLink(filePath, binDir, info);
}

async function makeExecutableAndLink(filePath: string, binDir: string, info: UpdateInfo): Promise<string> {
  // Get the actual binary path (for dmg we need to extract)
  const { platform } = info;

  if (platform === "linux") {
    const versionDir = join(filePath, "..");
    await exec(`tar -xzf "${filePath}" -C "${versionDir}"`);
    const binPath = join(versionDir, "openvibe");
    await exec(`chmod +x "${binPath}"`);
    const link = join(binDir, "openvibe");
    await writeFile(link.replace(/openvibe$/, ".version"), info.version);
    // Symlink the binary
    try {
      await unlink(link);
    } catch {
      /* ignore */
    }
    await exec(`ln -sf "${binPath}" "${link}"`);
    try {
      await unlink(filePath);
    } catch {
      /* ignore */
    }
    return link;
  }

  if (platform === "macos") {
    // Mount dmg, copy .app, detach
    const mountPoint = `/tmp/openvibe-mount-${Date.now()}`;
    await exec(`mkdir -p "${mountPoint}"`);
    await exec(`hdiutil attach "${filePath}" -mountpoint "${mountPoint}" -nobrowse -quiet`);
    const appPath = join(binDir, "OpenVibe.app");
    if (existsSync(appPath)) {
      await exec(`rm -rf "${appPath}"`);
    }
    // Find .app in mounted volume
    const { stdout } = await exec(`find "${mountPoint}" -name "*.app" -maxdepth 2 -type d | head -1`);
    const srcApp = stdout.trim();
    if (srcApp) {
      await exec(`cp -R "${srcApp}" "${appPath}"`);
    }
    await exec(`hdiutil detach "${mountPoint}" -quiet -force`);
    await exec(`rm -rf "${mountPoint}"`);
    await writeFile(join(binDir, ".version"), info.version);
    return join(appPath, "Contents/MacOS/openvibe");
  }

  if (platform === "windows") {
    const link = join(binDir, "openvibe.exe");
    await writeFile(link.replace(/openvibe\.exe$/, ".version"), info.version);
    // For exe installer, just symlink
    try {
      await unlink(link);
    } catch {
      /* ignore */
    }
    await exec(`mklink "${link}" "${filePath}"`, true);
    return link;
  }

  return filePath;
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk: string | Buffer) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function exec(cmd: string, ignoreError = false): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execCb(cmd, (err: Error | null, stdout: string, stderr: string) => {
      if (err && !ignoreError) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}
