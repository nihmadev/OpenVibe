use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

pub struct TerminalSession {
    child: Mutex<Option<Child>>,
    killed: Arc<AtomicBool>,
}

impl TerminalSession {
    pub fn new(shell: &str, shell_args: &[String], cwd: &str) -> Self {
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

    pub fn write(&self, data: &str) {
        if let Ok(mut guard) = self.child.lock() {
            if let Some(ref mut child) = *guard {
                if let Some(ref mut stdin) = child.stdin {
                    let _ = stdin.write_all(data.as_bytes());
                    let _ = stdin.flush();
                }
            }
        }
    }

    pub fn kill(&self) {
        self.killed.store(true, Ordering::SeqCst);
        if let Ok(mut guard) = self.child.lock() {
            if let Some(ref mut child) = *guard {
                let _ = child.kill();
                let _ = child.wait();
            }
            *guard = None;
        }
    }

    pub fn start_output_reader<F: Fn(String) + Send + 'static, G: Fn(i32) + Send + 'static>(
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
                        if killed.load(Ordering::SeqCst) {
                            break;
                        }
                        if let Ok(l) = line {
                            on_data(l + "\r\n");
                        }
                    }
                }
            });
        }
    }
}