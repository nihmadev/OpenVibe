use super::tabs::configure_page_compatibility;
use super::{BrowserCompatibility, BrowserEventSink, BrowserManager, Session};
use crate::cdp::CdpConnection;
use crate::install::resolve_or_install;
use serde_json::{json, Value};
use std::io::Read;
use std::path::Path;
use std::process::{Child, Command, Stdio};

#[cfg(target_os = "linux")]
use std::os::unix::process::CommandExt;

impl BrowserCompatibility {
    fn from_version(version: &Value, locale: String) -> Result<Self, String> {
        let user_agent = version
            .get("User-Agent")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "Chromium did not report its user agent".to_string())?
            .replace("HeadlessChrome/", "Chrome/");
        Ok(Self {
            user_agent,
            accept_language: accept_language(&locale),
            locale,
            platform: browser_platform().to_string(),
        })
    }
}

impl BrowserManager {
    pub(super) async fn start_session(
        &self,
        emit: &BrowserEventSink<'_>,
    ) -> Result<Session, String> {
        std::fs::create_dir_all(&self.profile_dir)
            .map_err(|error| format!("Cannot create browser profile: {error}"))?;
        std::fs::create_dir_all(&self.screenshots_dir)
            .map_err(|error| format!("Cannot create screenshot directory: {error}"))?;
        let executable = resolve_or_install(&self.runtime_dir).await?;
        let locale = browser_locale();
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(250))
            .build()
            .map_err(|error| format!("Cannot create CDP probe client: {error}"))?;
        let mut recovered_stale_profile = false;
        let (mut child, version) = 'launch: loop {
            let listener = std::net::TcpListener::bind("127.0.0.1:0")
                .map_err(|error| format!("Cannot allocate browser debugging port: {error}"))?;
            let port = listener
                .local_addr()
                .map_err(|error| error.to_string())?
                .port();
            drop(listener);
            let mut command = Command::new(&executable);
            command
                .args([
                    format!("--remote-debugging-port={port}"),
                    format!("--user-data-dir={}", self.profile_dir.display()),
                    format!("--lang={locale}"),
                    "--headless=new".to_string(),
                    "--disable-background-timer-throttling".to_string(),
                    "--disable-backgrounding-occluded-windows".to_string(),
                    "--disable-renderer-backgrounding".to_string(),
                    "--disable-blink-features=AutomationControlled".to_string(),
                    "--disable-component-update".to_string(),
                    "--force-color-profile=srgb".to_string(),
                    "--no-first-run".to_string(),
                    "--no-default-browser-check".to_string(),
                    "--remote-allow-origins=*".to_string(),
                    "--window-size=1280,800".to_string(),
                    "about:blank".to_string(),
                ])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::piped());
            #[cfg(target_os = "linux")]
            unsafe {
                let parent_pid = std::process::id() as libc::pid_t;
                command.pre_exec(move || {
                    if libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGTERM) != 0 {
                        return Err(std::io::Error::last_os_error());
                    }
                    if libc::getppid() != parent_pid {
                        return Err(std::io::Error::new(
                            std::io::ErrorKind::Interrupted,
                            "OpenVibe exited while Chromium was starting",
                        ));
                    }
                    Ok(())
                });
            }
            let mut child = command
                .spawn()
                .map_err(|error| format!("Cannot launch {}: {error}", executable.display()))?;
            let endpoint = format!("http://127.0.0.1:{port}/json/version");
            for _ in 0..80 {
                if let Some(status) = child
                    .try_wait()
                    .map_err(|error| format!("Cannot inspect Chromium process: {error}"))?
                {
                    let diagnostics = child_stderr(&mut child);
                    let singleton_failure = diagnostics.contains("ProcessSingleton")
                        || diagnostics.contains("profile appears to be in use")
                        || diagnostics.contains("SingletonLock");
                    if !recovered_stale_profile
                        && singleton_failure
                        && profile_lock_is_stale(&self.profile_dir)
                    {
                        clear_profile_singletons(&self.profile_dir)?;
                        recovered_stale_profile = true;
                        continue 'launch;
                    }
                    return Err(format!(
                        "Chromium exited before CDP was ready ({status}). {}",
                        compact_diagnostics(&diagnostics)
                    ));
                }
                match client.get(&endpoint).send().await {
                    Ok(response) if response.status().is_success() => {
                        if let Ok(version) = response.json::<Value>().await {
                            break 'launch (child, version);
                        }
                    }
                    _ => {}
                }
                tokio::time::sleep(std::time::Duration::from_millis(75)).await;
            }
            let _ = child.kill();
            let _ = child.wait();
            let diagnostics = child_stderr(&mut child);
            return Err(format!(
                "Chromium did not expose CDP within 8 seconds. {}",
                compact_diagnostics(&diagnostics)
            ));
        };
        if let Some(mut stderr) = child.stderr.take() {
            std::thread::spawn(move || {
                let _ = std::io::copy(&mut stderr, &mut std::io::sink());
            });
        }
        let ws_url = version
            .get("webSocketDebuggerUrl")
            .and_then(Value::as_str)
            .ok_or_else(|| "Chromium started but its CDP endpoint was unavailable".to_string())?;
        let compatibility = BrowserCompatibility::from_version(&version, locale)?;
        let cdp = CdpConnection::connect(ws_url).await?;
        let targets = cdp.command("Target.getTargets", json!({}), None).await?;
        let target_id = targets["targetInfos"]
            .as_array()
            .and_then(|items| items.iter().find(|item| item["type"] == "page"))
            .and_then(|item| item["targetId"].as_str())
            .ok_or_else(|| "Chromium did not create a page target".to_string())?
            .to_string();
        let attached = cdp
            .command(
                "Target.attachToTarget",
                json!({"targetId": target_id, "flatten": true}),
                None,
            )
            .await?;
        let session_id = attached["sessionId"]
            .as_str()
            .ok_or_else(|| "Chromium did not create a CDP page session".to_string())?
            .to_string();
        cdp.command("Page.enable", json!({}), Some(&session_id))
            .await?;
        cdp.command("Runtime.enable", json!({}), Some(&session_id))
            .await?;
        configure_page_compatibility(&cdp, &session_id, &compatibility).await?;
        let id = uuid::Uuid::new_v4().to_string();
        emit(
            "browser:session-started",
            json!({"sessionId": id, "profile": self.profile_dir}),
        );
        Ok(Session {
            id,
            child,
            cdp,
            active_target: target_id,
            active_session: session_id,
            manual_control: false,
            agent_input_blocked: false,
            last_snapshot: None,
            ui_stream: None,
            viewport: (1280, 800),
            compatibility,
        })
    }
}
fn child_stderr(child: &mut Child) -> String {
    let mut diagnostics = String::new();
    if let Some(mut stderr) = child.stderr.take() {
        let _ = stderr.read_to_string(&mut diagnostics);
    }
    diagnostics
}

fn compact_diagnostics(diagnostics: &str) -> String {
    let line = diagnostics
        .lines()
        .rev()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("");
    let compact: String = line.chars().take(600).collect();
    if compact.is_empty() {
        "See OpenVibe logs for Chromium diagnostics.".to_string()
    } else {
        compact
    }
}

fn profile_lock_is_stale(profile_dir: &Path) -> bool {
    #[cfg(target_os = "linux")]
    {
        let Ok(target) = std::fs::read_link(profile_dir.join("SingletonLock")) else {
            return false;
        };
        let target = target.to_string_lossy();
        let Some((host, pid)) = target.rsplit_once('-') else {
            return false;
        };
        let env_host = std::env::var("HOSTNAME").ok();
        let system_host = std::fs::read_to_string("/etc/hostname")
            .ok()
            .map(|value| value.trim().to_string());
        let Ok(pid) = pid.parse::<u32>() else {
            return false;
        };
        let local_host = env_host.as_deref() == Some(host)
            || system_host.as_deref() == Some(host)
            || host == "localhost";
        local_host && !Path::new(&format!("/proc/{pid}")).exists()
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = profile_dir;
        false
    }
}

fn clear_profile_singletons(profile_dir: &Path) -> Result<(), String> {
    for name in ["SingletonLock", "SingletonSocket", "SingletonCookie"] {
        let path = profile_dir.join(name);
        match std::fs::remove_file(&path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(format!(
                    "Cannot recover stale Chromium profile lock {}: {error}",
                    path.display()
                ))
            }
        }
    }
    Ok(())
}
fn browser_locale() -> String {
    ["OPENVIBE_BROWSER_LOCALE", "LANGUAGE", "LC_ALL", "LANG"]
        .into_iter()
        .filter_map(|name| std::env::var(name).ok())
        .filter_map(|value| normalize_locale(value.split(':').next().unwrap_or_default()))
        .next()
        .unwrap_or_else(|| "en-US".to_string())
}

fn normalize_locale(value: &str) -> Option<String> {
    let locale = value
        .split(['.', '@'])
        .next()
        .unwrap_or_default()
        .replace('_', "-");
    if locale.is_empty()
        || matches!(locale.as_str(), "C" | "POSIX")
        || !locale
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return None;
    }
    Some(locale)
}

fn accept_language(locale: &str) -> String {
    let primary = locale.split('-').next().unwrap_or(locale);
    if primary.eq_ignore_ascii_case("en") {
        if locale.eq_ignore_ascii_case("en") {
            "en-US,en;q=0.9".to_string()
        } else {
            format!("{locale},en;q=0.9")
        }
    } else if locale.eq_ignore_ascii_case(primary) {
        format!("{locale},en;q=0.8")
    } else {
        format!("{locale},{primary};q=0.9,en;q=0.8")
    }
}

fn browser_platform() -> &'static str {
    #[cfg(target_os = "windows")]
    return "Win32";
    #[cfg(target_os = "macos")]
    return "MacIntel";
    #[cfg(target_os = "linux")]
    return "Linux x86_64";
    #[allow(unreachable_code)]
    "Unknown"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compatibility_profile_removes_headless_ua_and_keeps_locale() {
        let version = json!({
            "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.0.0 Safari/537.36"
        });
        let compatibility =
            BrowserCompatibility::from_version(&version, "ru-RU".to_string()).unwrap();
        assert!(!compatibility.user_agent.contains("HeadlessChrome"));
        assert!(compatibility.user_agent.contains("Chrome/140.0.0.0"));
        assert_eq!(compatibility.accept_language, "ru-RU,ru;q=0.9,en;q=0.8");
    }

    #[test]
    fn locale_normalization_rejects_posix_and_invalid_values() {
        assert_eq!(normalize_locale("ru_RU.UTF-8"), Some("ru-RU".to_string()));
        assert_eq!(normalize_locale("C.UTF-8"), None);
        assert_eq!(normalize_locale("ru RU"), None);
    }
}
