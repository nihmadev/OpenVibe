use std::collections::HashMap;
use std::sync::Mutex;

use crate::session::TerminalSession;
use crate::shell;

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
        let (shell, shell_args) = shell::pick_shell();
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
