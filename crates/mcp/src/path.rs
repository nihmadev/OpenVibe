use std::path::PathBuf;

pub fn build_augmented_path() -> String {
    let mut paths = Vec::new();
    if let Ok(current_path) = std::env::var("PATH") {
        paths.push(current_path);
    }

    if let Ok(home) = std::env::var("HOME") {
        let home_p = PathBuf::from(&home);
        let common_dirs = vec![
            home_p.join(".cargo").join("bin"),
            home_p.join(".local").join("bin"),
            home_p.join(".bun").join("bin"),
            home_p.join(".yarn").join("bin"),
            home_p.join(".deno").join("bin"),
            PathBuf::from("/usr/local/bin"),
            PathBuf::from("/opt/homebrew/bin"),
        ];
        for d in common_dirs {
            if d.exists() {
                paths.push(d.to_string_lossy().to_string());
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            let up = PathBuf::from(user_profile);
            let win_dirs = vec![
                up.join(".cargo").join("bin"),
                up.join("AppData").join("Roaming").join("npm"),
            ];
            for d in win_dirs {
                if d.exists() {
                    paths.push(d.to_string_lossy().to_string());
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    let sep = ";";
    #[cfg(not(target_os = "windows"))]
    let sep = ":";

    paths.join(sep)
}
