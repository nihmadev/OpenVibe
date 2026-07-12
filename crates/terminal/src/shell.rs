pub fn pick_shell() -> (String, Vec<String>) {
    #[cfg(windows)]
    {
        let pwsh = "C:\\Program Files\\PowerShell\\7\\pwsh.exe";
        if std::path::Path::new(pwsh).exists() {
            return (pwsh.to_string(), vec!["-NoLogo".to_string()]);
        }
        let windir = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
        let winps = format!(
            "{}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
            windir
        );
        (winps, vec!["-NoLogo".to_string()])
    }
    #[cfg(not(windows))]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        (shell, vec![])
    }
}
