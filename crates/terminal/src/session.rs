use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

pub struct TerminalSession {
    master: Mutex<Option<Box<dyn portable_pty::MasterPty + Send>>>,
    child: Arc<Mutex<Option<Box<dyn portable_pty::Child + Send + Sync>>>>,
    writer: Mutex<Option<Box<dyn std::io::Write + Send>>>,
    killed: Arc<AtomicBool>,
}

impl TerminalSession {
    pub fn new(shell: &str, shell_args: &[String], cwd: &str, cols: u16, rows: u16) -> Self {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .expect("Failed to create pty");

        let mut cmd = CommandBuilder::new(shell);
        cmd.args(shell_args);
        cmd.cwd(cwd);

        let child = pair
            .slave
            .spawn_command(cmd)
            .expect("Failed to spawn shell");
        let writer = pair.master.take_writer().expect("Failed to take writer");

        TerminalSession {
            master: Mutex::new(Some(pair.master)),
            child: Arc::new(Mutex::new(Some(child))),
            writer: Mutex::new(Some(writer)),
            killed: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn write(&self, data: &str) {
        if let Ok(mut guard) = self.writer.lock() {
            if let Some(writer) = guard.as_mut() {
                let _ = writer.write_all(data.as_bytes());
            }
        }
    }

    pub fn resize(&self, cols: u16, rows: u16) {
        if let Ok(guard) = self.master.lock() {
            if let Some(master) = guard.as_ref() {
                let _ = master.resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                });
            }
        }
    }

    pub fn kill(&self) {
        self.killed.store(true, Ordering::SeqCst);
        if let Ok(mut guard) = self.child.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
        if let Ok(mut guard) = self.writer.lock() {
            *guard = None;
        }
        if let Ok(mut guard) = self.master.lock() {
            *guard = None;
        }
    }

    pub fn start_output_reader<F: Fn(String) + Send + 'static, G: Fn(i32) + Send + 'static>(
        &self,
        on_data: F,
        on_exit: G,
    ) {
        let killed = self.killed.clone();
        let child_arc = self.child.clone();

        let mut reader = {
            let guard = self.master.lock().unwrap();
            if let Some(master) = guard.as_ref() {
                master.try_clone_reader().unwrap()
            } else {
                return;
            }
        };

        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            let mut leftover = Vec::new();

            loop {
                if killed.load(Ordering::SeqCst) {
                    break;
                }
                match reader.read(&mut buf) {
                    Ok(n) if n > 0 => {
                        let mut data = std::mem::take(&mut leftover);
                        data.extend_from_slice(&buf[..n]);

                        let mut current_data = &data[..];
                        let mut text = String::new();
                        let mut new_leftover = Vec::new();

                        while !current_data.is_empty() {
                            match std::str::from_utf8(current_data) {
                                Ok(s) => {
                                    text.push_str(s);
                                    break;
                                }
                                Err(e) => {
                                    let valid = e.valid_up_to();
                                    let valid_str = unsafe {
                                        std::str::from_utf8_unchecked(&current_data[..valid])
                                    };
                                    text.push_str(valid_str);

                                    if let Some(err_len) = e.error_len() {
                                        text.push(std::char::REPLACEMENT_CHARACTER);
                                        current_data = &current_data[valid + err_len..];
                                    } else {
                                        new_leftover = current_data[valid..].to_vec();
                                        break;
                                    }
                                }
                            }
                        }

                        if !text.is_empty() {
                            on_data(text);
                        }
                        leftover = new_leftover;
                    }
                    _ => {
                        let mut exit_code = 0;
                        if let Ok(mut guard) = child_arc.lock() {
                            if let Some(mut child) = guard.take() {
                                if let Ok(status) = child.wait() {
                                    exit_code = status.exit_code() as i32;
                                }
                            }
                        }
                        on_exit(exit_code);
                        break;
                    }
                }
            }
        });
    }
}
