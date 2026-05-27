use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

struct TerminalSession {
    child: Mutex<Option<Child>>,
    killed: Arc<AtomicBool>,
}

impl TerminalSession {
    fn new(shell: &str, shell_args: &[String], cwd: &str) -> Self {
        let child = Command::new(shell)
            .args(shell_args)
            .current_dir(cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn();

        TerminalSession {
            child: Mutex::new(child.ok()),
            killed: Arc::new(AtomicBool::new(false)),
        }
    }

    fn write(&self, data: &str) {
        if let Ok(mut guard) = self.child.lock() {
            if let Some(ref mut child) = *guard {
                if let Some(ref mut stdin) = child.stdin {
                    let _ = stdin.write_all(data.as_bytes());
                    let _ = stdin.flush();
                }
            }
        }
    }

    fn kill(&self) {
        self.killed.store(true, Ordering::SeqCst);
        if let Ok(mut guard) = self.child.lock() {
            if let Some(ref mut child) = *guard {
                let _ = child.kill();
                let _ = child.wait();
            }
            *guard = None;
        }
    }

    fn start_output_reader<F: Fn(String) + Send + 'static, G: Fn(i32) + Send + 'static>(
        &self,
        on_data: F,
        _on_exit: G,
    ) {
        let killed = self.killed.clone();
        let mut guard = self.child.lock().unwrap();
        if let Some(ref mut child) = *guard {
            let stdout = child.stdout.take();
            drop(guard);

            thread::spawn(move || {
                if let Some(out) = stdout {
                    let reader = BufReader::new(out);
                    for line in reader.lines() {
                        if killed.load(Ordering::SeqCst) { break; }
                        if let Ok(l) = line { on_data(l + "\r\n"); }
                    }
                }
            });
        }
    }
}

pub struct TerminalManager {
    sessions: Mutex<HashMap<String, TerminalSession>>,
    default_cwd: String,
}

impl TerminalManager {
    pub fn new(cwd: &str) -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            default_cwd: cwd.to_string(),
        }
    }

    pub fn start<F: Fn(String) + Send + 'static, G: Fn(i32) + Send + 'static>(
        &self,
        id: &str,
        _cols: u16,
        _rows: u16,
        on_data: F,
        on_exit: G,
    ) {
        let mut sessions = self.sessions.lock().unwrap();
        if sessions.contains_key(id) {
            return;
        }
        let (shell, shell_args) = pick_shell();
        let session = TerminalSession::new(&shell, &shell_args, &self.default_cwd);
        session.start_output_reader(on_data, on_exit);
        sessions.insert(id.to_string(), session);
    }

    pub fn write(&self, id: &str, data: &str) {
        if let Some(session) = self.sessions.lock().unwrap().get(id) {
            session.write(data);
        }
    }

    pub fn resize(&self, _id: &str, _cols: u16, _rows: u16) {}

    pub fn kill(&self, id: &str) {
        if let Some(session) = self.sessions.lock().unwrap().remove(id) {
            session.kill();
        }
    }

    pub fn kill_all(&self) {
        let mut sessions = self.sessions.lock().unwrap();
        for (_, session) in sessions.drain() {
            session.kill();
        }
    }
}

fn pick_shell() -> (String, Vec<String>) {
    #[cfg(windows)]
    {
        let pwsh = "C:\\Program Files\\PowerShell\\7\\pwsh.exe";
        if std::path::Path::new(pwsh).exists() {
            return (pwsh.to_string(), vec!["-NoLogo".to_string()]);
        }
        let windir = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
        let winps = format!("{}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", windir);
        (winps, vec!["-NoLogo".to_string()])
    }
    #[cfg(not(windows))]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        (shell, vec![])
    }
}
