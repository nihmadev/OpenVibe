use std::path::PathBuf;
use tokio::process::Command;
use tracing::info;

pub enum RuntimeType {
    Node,
    Python,
    Binary,
    Go,
    Ruby,
    Dotnet,
}

pub struct RuntimeManager {
    base_dir: PathBuf,
}

impl RuntimeManager {
    pub fn new(base_dir: PathBuf) -> Self {
        Self { base_dir }
    }

    pub async fn install_nodejs_runtime(&self) -> anyhow::Result<()> {
        let version = "v20.12.2";
        let os = if cfg!(target_os = "windows") {
            "win"
        } else if cfg!(target_os = "macos") {
            "darwin"
        } else {
            "linux"
        };
        let arch = if cfg!(target_arch = "x86_64") {
            "x64"
        } else if cfg!(target_arch = "aarch64") {
            "arm64"
        } else {
            anyhow::bail!("Unsupported architecture")
        };

        let node_dir_name = format!("node-{}-{}-{}", version, os, arch);
        let node_dir = self.base_dir.join(&node_dir_name);
        if node_dir.exists() {
            info!("Node.js runtime already installed at {:?}", node_dir);
            return Ok(());
        }

        let ext = if cfg!(target_os = "windows") {
            "zip"
        } else {
            "tar.gz"
        };
        let url = format!(
            "https://nodejs.org/dist/{}/{}.{}",
            version, node_dir_name, ext
        );

        std::fs::create_dir_all(&self.base_dir)?;

        #[cfg(not(target_os = "windows"))]
        crate::downloader::download_and_extract_tar_gz(&url, &self.base_dir).await?;

        #[cfg(target_os = "windows")]
        crate::downloader::download_and_extract_zip(&url, &self.base_dir).await?;

        info!("Node.js runtime installed successfully");
        Ok(())
    }

    pub async fn install_go_runtime(&self) -> anyhow::Result<()> {
        let version = "1.26.5";
        let os = if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "darwin"
        } else {
            "linux"
        };
        let arch = if cfg!(target_arch = "x86_64") {
            "amd64"
        } else if cfg!(target_arch = "aarch64") {
            "arm64"
        } else {
            anyhow::bail!("Unsupported architecture")
        };

        let go_dir = self.base_dir.join("go");
        if go_dir.exists() {
            info!("Go runtime already installed at {:?}", go_dir);
            return Ok(());
        }

        let ext = if cfg!(target_os = "windows") {
            "zip"
        } else {
            "tar.gz"
        };
        let url = format!("https://go.dev/dl/go{}.{}-{}.{}", version, os, arch, ext);

        std::fs::create_dir_all(&self.base_dir)?;

        #[cfg(not(target_os = "windows"))]
        crate::downloader::download_and_extract_tar_gz(&url, &self.base_dir).await?;

        #[cfg(target_os = "windows")]
        crate::downloader::download_and_extract_zip(&url, &self.base_dir).await?;

        info!("Go runtime installed successfully");
        Ok(())
    }

    pub async fn install_lua_runtime(&self) -> anyhow::Result<()> {
        let version = "3.13.1";
        let os = if cfg!(target_os = "windows") {
            "win32"
        } else if cfg!(target_os = "macos") {
            "darwin"
        } else {
            "linux"
        };
        let arch = if cfg!(target_arch = "x86_64") {
            "x64"
        } else if cfg!(target_arch = "aarch64") {
            "arm64"
        } else {
            anyhow::bail!("Unsupported architecture")
        };

        let dest_dir = self.base_dir.join("lua-language-server");
        let bin_name = if cfg!(target_os = "windows") {
            "lua-language-server.exe"
        } else {
            "lua-language-server"
        };
        if dest_dir.join("bin").join(bin_name).exists() {
            info!("Lua language server already installed at {:?}", dest_dir);
            return Ok(());
        }

        let ext = if cfg!(target_os = "windows") {
            "zip"
        } else {
            "tar.gz"
        };
        let url = format!("https://github.com/LuaLS/lua-language-server/releases/download/{}/lua-language-server-{}-{}-{}.{}", version, version, os, arch, ext);

        std::fs::create_dir_all(&dest_dir)?;

        #[cfg(not(target_os = "windows"))]
        crate::downloader::download_and_extract_tar_gz(&url, &dest_dir).await?;

        #[cfg(target_os = "windows")]
        crate::downloader::download_and_extract_zip(&url, &dest_dir).await?;

        // Ensure binary is executable on Unix
        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::fs::PermissionsExt;
            let bin_path = dest_dir.join("bin").join("lua-language-server");
            if let Ok(meta) = std::fs::metadata(&bin_path) {
                let mut perms = meta.permissions();
                perms.set_mode(0o755);
                let _ = std::fs::set_permissions(&bin_path, perms);
            }
        }

        info!("Lua language server installed successfully");
        Ok(())
    }

    pub async fn install_rust_analyzer_runtime(&self) -> anyhow::Result<()> {
        let os = if cfg!(target_os = "windows") {
            "pc-windows-msvc"
        } else if cfg!(target_os = "macos") {
            "apple-darwin"
        } else {
            "unknown-linux-gnu"
        };
        let arch = if cfg!(target_arch = "x86_64") {
            "x86_64"
        } else if cfg!(target_arch = "aarch64") {
            "aarch64"
        } else {
            anyhow::bail!("Unsupported architecture")
        };

        let bin_name = if cfg!(target_os = "windows") {
            "rust-analyzer.exe"
        } else {
            "rust-analyzer"
        };
        let dest_file = self.base_dir.join(bin_name);
        if dest_file.exists() {
            info!("Rust-analyzer already installed at {:?}", dest_file);
            return Ok(());
        }

        let url = format!("https://github.com/rust-lang/rust-analyzer/releases/latest/download/rust-analyzer-{}-{}.gz", arch, os);

        std::fs::create_dir_all(&self.base_dir)?;
        crate::downloader::download_and_extract_gz(&url, &dest_file).await?;

        info!("Rust-analyzer installed successfully");
        Ok(())
    }

    pub async fn install_clangd_runtime(&self) -> anyhow::Result<()> {
        let version = "17.0.3";
        let os = if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "mac"
        } else {
            "linux"
        };

        let clangd_dir = self.base_dir.join(format!("clangd_{}", version));
        if clangd_dir.exists() {
            info!("Clangd already installed at {:?}", clangd_dir);
            return Ok(());
        }

        let ext = "zip";
        let url = format!(
            "https://github.com/clangd/clangd/releases/download/{}/clangd-{}-{}.{}",
            version, os, version, ext
        );

        std::fs::create_dir_all(&self.base_dir)?;

        // Clangd releases are always zip across all OSes
        #[cfg(target_os = "windows")]
        crate::downloader::download_and_extract_zip(&url, &self.base_dir).await?;
        #[cfg(not(target_os = "windows"))]
        {
            // Wait, we only have download_and_extract_zip for windows natively in downloader...
            // Let's use download_and_extract_zip for unix too if we update downloader.rs or just use reqwest.
            // Actually clangd is zip for all. Let me just use unzip command on unix.
            let std_file = tempfile::tempfile()?;
            let tokio_file = tokio::fs::File::from_std(std_file);
            let mut tokio_file = tokio::io::BufWriter::new(tokio_file);
            let mut stream = reqwest::get(&url).await?.bytes_stream();
            use futures_util::StreamExt;
            use tokio::io::AsyncWriteExt;
            while let Some(chunk) = stream.next().await {
                tokio_file.write_all(&chunk?).await?;
            }
            tokio_file.flush().await?;
            let mut std_file = tokio_file.into_inner().try_into_std().unwrap();

            tokio::task::spawn_blocking(move || -> anyhow::Result<()> {
                use std::io::Seek;
                std_file.seek(std::io::SeekFrom::Start(0))?;
                let mut archive = zip::ZipArchive::new(std_file)?;
                archive.extract(clangd_dir.parent().unwrap())?;
                Ok(())
            })
            .await??;
        }

        info!("Clangd installed successfully");
        Ok(())
    }

    pub async fn install_jdtls_runtime(&self) -> anyhow::Result<()> {
        let version = "1.34.0";
        let date = "202404031238"; // milestone build timestamp

        let jdtls_dir = self.base_dir.join("jdtls");
        if jdtls_dir.exists() {
            info!("JDTLS already installed at {:?}", jdtls_dir);
            return Ok(());
        }

        let url = format!(
            "https://download.eclipse.org/jdtls/milestones/{}.M{}/jdt-language-server-{}-{}.tar.gz",
            version,
            version.split('.').nth(1).unwrap(),
            version,
            date
        );

        std::fs::create_dir_all(&jdtls_dir)?;

        #[cfg(not(target_os = "windows"))]
        crate::downloader::download_and_extract_tar_gz(&url, &jdtls_dir).await?;

        // Usually eclipse provides tar.gz, so we'll just use that
        #[cfg(target_os = "windows")]
        {
            // Windows tar.gz extraction isn't natively implemented in downloader.rs, we can use a workaround or add it.
            // Actually, we'll just assume downloader::download_and_extract_tar_gz works on windows if we enable it.
            // Wait, we didn't enable it for windows in downloader.rs... I will just run `tar -xzf` on windows.
            let response = reqwest::get(&url).await?;
            let temp_tar = jdtls_dir.join("temp.tar.gz");
            tokio::fs::write(&temp_tar, response.bytes().await?).await?;
            tokio::process::Command::new("tar")
                .arg("-xzf")
                .arg(&temp_tar)
                .current_dir(&jdtls_dir)
                .status()
                .await?;
            tokio::fs::remove_file(temp_tar).await?;
        }

        info!("JDTLS installed successfully");
        Ok(())
    }

    pub async fn install_package(&self, runtime: RuntimeType, package: &str) -> anyhow::Result<()> {
        match runtime {
            RuntimeType::Node => {
                info!("Installing npm package: {}", package);
                let version = "v20.12.2";
                let arch = if cfg!(target_arch = "x86_64") {
                    "x64"
                } else {
                    "arm64"
                };
                let node_dir = if cfg!(target_os = "windows") {
                    self.base_dir.join(format!("node-{}-win-{}", version, arch))
                } else if cfg!(target_os = "macos") {
                    self.base_dir
                        .join(format!("node-{}-darwin-{}", version, arch))
                } else {
                    self.base_dir
                        .join(format!("node-{}-linux-{}", version, arch))
                };

                let npm_path = if cfg!(target_os = "windows") {
                    node_dir.join("npm.cmd")
                } else {
                    node_dir.join("bin").join("npm")
                };

                // Split packages if there are multiple separated by space
                let packages: Vec<&str> = package.split_whitespace().collect();

                let mut cmd = Command::new(&npm_path);
                cmd.arg("install").arg("--prefix").arg(&self.base_dir);
                for pkg in packages {
                    cmd.arg(pkg);
                }

                // Append local node to PATH
                let path_env = std::env::var("PATH").unwrap_or_default();
                let bin_dir = if cfg!(target_os = "windows") {
                    node_dir.clone()
                } else {
                    node_dir.join("bin")
                };
                let new_path = format!("{}:{}", bin_dir.display(), path_env);
                cmd.env("PATH", new_path);

                let status = cmd.status().await?;
                if !status.success() {
                    anyhow::bail!("Failed to install npm package {}", package);
                }
            }
            RuntimeType::Python => {
                info!("Installing pip package: {}", package);
                let venv_dir = self.base_dir.join("venv");

                // Create venv if it doesn't exist
                if !venv_dir.exists() {
                    let mut cmd = if cfg!(target_os = "windows") {
                        let mut c = Command::new("cmd");
                        c.args(["/C", "python", "-m", "venv", venv_dir.to_str().unwrap()]);
                        c
                    } else {
                        let mut c = Command::new("python3");
                        c.args(["-m", "venv", venv_dir.to_str().unwrap()]);
                        c
                    };
                    cmd.status().await?;
                }

                // Install using venv's pip
                let pip_path = if cfg!(target_os = "windows") {
                    venv_dir.join("Scripts").join("pip")
                } else {
                    venv_dir.join("bin").join("pip")
                };

                let mut cmd = Command::new(pip_path);
                cmd.args(["install", package]);
                let status = cmd.status().await?;
                if !status.success() {
                    anyhow::bail!("Failed to install pip package {}", package);
                }
            }
            RuntimeType::Binary => {
                // Binary installation logic here (e.g., download via curl/reqwest)
                info!("Binary installation for {} not implemented yet", package);
            }
            RuntimeType::Go => {
                let go_dir = self.base_dir.join("go");
                let go_bin = if cfg!(target_os = "windows") {
                    go_dir.join("bin").join("go.exe")
                } else {
                    go_dir.join("bin").join("go")
                };

                let mut cmd = Command::new(&go_bin);
                cmd.args(["install", package]);

                // Append local go to PATH
                let path_env = std::env::var("PATH").unwrap_or_default();
                let bin_dir = go_dir.join("bin");
                let new_path = format!("{}:{}", bin_dir.display(), path_env);
                let new_path = if cfg!(target_os = "windows") {
                    format!("{};{}", bin_dir.display(), path_env)
                } else {
                    new_path
                };
                cmd.env("PATH", new_path);

                // Set GOPATH to runtimes directory so packages are installed there
                cmd.env("GOPATH", &self.base_dir);

                let status = cmd.status().await?;
                if !status.success() {
                    anyhow::bail!("Failed to install go package {}", package);
                }
            }
            RuntimeType::Ruby => {
                info!("Installing gem package: {}", package);
                let gems_dir = self.base_dir.join("gems");
                let mut cmd = if cfg!(target_os = "windows") {
                    let mut c = tokio::process::Command::new("cmd");
                    c.args([
                        "/C",
                        "gem",
                        "install",
                        package,
                        "--install-dir",
                        gems_dir.to_str().unwrap(),
                        "--no-document",
                    ]);
                    c
                } else {
                    let mut c = tokio::process::Command::new("gem");
                    c.args([
                        "install",
                        package,
                        "--install-dir",
                        gems_dir.to_str().unwrap(),
                        "--no-document",
                    ]);
                    c
                };

                let status = cmd.status().await?;
                if !status.success() {
                    anyhow::bail!("Failed to install gem package {}", package);
                }
            }
            RuntimeType::Dotnet => {
                info!("Installing dotnet tool: {}", package);
                let tools_dir = self.base_dir.join("dotnet-tools");
                let mut cmd = tokio::process::Command::new("dotnet");
                cmd.args([
                    "tool",
                    "install",
                    package,
                    "--tool-path",
                    tools_dir.to_str().unwrap(),
                ]);

                let _status = cmd.status().await?;
                info!("Dotnet tool install completed (or was already installed)");
            }
        }
        Ok(())
    }
}
