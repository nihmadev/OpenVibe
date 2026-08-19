use serde::Deserialize;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

#[derive(Deserialize)]
struct ChromeManifest {
    channels: ChromeChannels,
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct ChromeChannels {
    stable: ChromeChannel,
}

#[derive(Deserialize)]
struct ChromeChannel {
    version: String,
    downloads: ChromeDownloads,
}

#[derive(Deserialize)]
struct ChromeDownloads {
    chrome: Vec<ChromeDownload>,
}

#[derive(Deserialize)]
struct ChromeDownload {
    platform: String,
    url: String,
}

fn platform_name() -> Result<&'static str, String> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("linux", "x86_64") => Ok("linux64"),
        ("macos", "x86_64") => Ok("mac-x64"),
        ("macos", "aarch64") => Ok("mac-arm64"),
        ("windows", "x86_64") => Ok("win64"),
        pair => Err(format!("Managed Chromium is not available for {pair:?}")),
    }
}

fn executable_in(root: &Path) -> PathBuf {
    #[cfg(target_os = "windows")]
    return root.join("chrome-win64").join("chrome.exe");
    #[cfg(target_os = "macos")]
    return root
        .join(if cfg!(target_arch = "aarch64") {
            "chrome-mac-arm64"
        } else {
            "chrome-mac-x64"
        })
        .join("Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
    #[cfg(target_os = "linux")]
    return root.join("chrome-linux64").join("chrome");
}

fn bundled_candidates(runtime_dir: &Path) -> Vec<PathBuf> {
    let mut candidates = vec![executable_in(&runtime_dir.join("chromium"))];
    if let Ok(path) = std::env::var("OPENVIBE_CHROMIUM_PATH") {
        candidates.insert(0, PathBuf::from(path));
    }
    candidates
}

fn system_candidates() -> &'static [&'static str] {
    #[cfg(target_os = "windows")]
    return &["chrome.exe", "msedge.exe"];
    #[cfg(target_os = "macos")]
    return &[
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
    #[cfg(target_os = "linux")]
    return &[
        "google-chrome-stable",
        "google-chrome",
        "chromium",
        "chromium-browser",
    ];
}

fn find_on_path(name: &str) -> Option<PathBuf> {
    if name.contains(std::path::MAIN_SEPARATOR) {
        let path = PathBuf::from(name);
        return path.is_file().then_some(path);
    }
    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths)
            .map(|dir| dir.join(name))
            .find(|candidate| candidate.is_file())
    })
}

/// Resolve the bundled/managed runtime first. A system Chrome fallback keeps
/// development fast; production can self-install without Node/npm.
pub async fn resolve_or_install(runtime_dir: &Path) -> Result<PathBuf, String> {
    for candidate in bundled_candidates(runtime_dir) {
        if candidate.is_file() {
            return Ok(candidate);
        }
    }
    for candidate in system_candidates() {
        if let Some(path) = find_on_path(candidate) {
            return Ok(path);
        }
    }
    install_managed(runtime_dir).await
}

async fn install_managed(runtime_dir: &Path) -> Result<PathBuf, String> {
    let platform = platform_name()?;
    let manifest: ChromeManifest = reqwest::get(
        "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json",
    )
    .await
    .map_err(|error| format!("Cannot download Chromium runtime manifest: {error}"))?
    .error_for_status()
    .map_err(|error| format!("Chromium runtime manifest failed: {error}"))?
    .json()
    .await
    .map_err(|error| format!("Invalid Chromium runtime manifest: {error}"))?;
    let download = manifest
        .channels
        .stable
        .downloads
        .chrome
        .into_iter()
        .find(|item| item.platform == platform)
        .ok_or_else(|| format!("No managed Chromium download for {platform}"))?;
    let install_root = runtime_dir.join("chromium");
    fs::create_dir_all(&install_root)
        .map_err(|error| format!("Cannot create Chromium runtime directory: {error}"))?;
    let bytes = reqwest::get(&download.url)
        .await
        .map_err(|error| {
            format!(
                "Cannot download Chromium {}: {error}",
                manifest.channels.stable.version
            )
        })?
        .error_for_status()
        .map_err(|error| format!("Chromium download failed: {error}"))?
        .bytes()
        .await
        .map_err(|error| format!("Cannot read Chromium download: {error}"))?;
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes))
        .map_err(|error| format!("Invalid Chromium archive: {error}"))?;
    archive
        .extract(&install_root)
        .map_err(|error| format!("Cannot extract Chromium runtime: {error}"))?;
    let executable = executable_in(&install_root);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = fs::metadata(&executable)
            .map_err(|error| format!("Chromium executable missing: {error}"))?;
        let mut permissions = metadata.permissions();
        permissions.set_mode(permissions.mode() | 0o755);
        fs::set_permissions(&executable, permissions)
            .map_err(|error| format!("Cannot mark Chromium executable: {error}"))?;
    }
    Ok(executable)
}
