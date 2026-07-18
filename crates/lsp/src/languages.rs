use crate::LspServerConfig;

pub fn get_language_config(lang: &str) -> Option<LspServerConfig> {
    match lang {
        "go" => Some(LspServerConfig {
            id: "go".to_string(),
            name: "Go".to_string(),
            command: "gopls".to_string(),
            args: vec![],
            env: Default::default(),
        }),
        "typescript" | "ts" | "javascript" | "js" => Some(LspServerConfig {
            id: "ts".to_string(),
            name: "TypeScript / JavaScript".to_string(),
            command: "typescript-language-server".to_string(),
            args: vec!["--stdio".to_string()],
            env: Default::default(),
        }),
        "lua" => Some(LspServerConfig {
            id: "lua".to_string(),
            name: "Lua".to_string(),
            command: "lua-language-server".to_string(),
            args: vec![],
            env: Default::default(),
        }),
        "rust" => Some(LspServerConfig {
            id: "rust".to_string(),
            name: "Rust Analyzer".to_string(),
            command: "rust-analyzer".to_string(),
            args: vec![],
            env: Default::default(),
        }),
        "python" => Some(LspServerConfig {
            id: "python".to_string(),
            name: "Python".to_string(),
            command: "pyright-langserver".to_string(),
            args: vec!["--stdio".to_string()],
            env: Default::default(),
        }),
        "html" => Some(LspServerConfig {
            id: "html".to_string(),
            name: "HTML".to_string(),
            command: "vscode-html-language-server".to_string(),
            args: vec!["--stdio".to_string()],
            env: Default::default(),
        }),
        "css" | "scss" | "less" => Some(LspServerConfig {
            id: "css".to_string(),
            name: "CSS".to_string(),
            command: "vscode-css-language-server".to_string(),
            args: vec!["--stdio".to_string()],
            env: Default::default(),
        }),
        "json" => Some(LspServerConfig {
            id: "json".to_string(),
            name: "JSON".to_string(),
            command: "vscode-json-language-server".to_string(),
            args: vec!["--stdio".to_string()],
            env: Default::default(),
        }),
        "ruby" => Some(LspServerConfig {
            id: "ruby".to_string(),
            name: "Ruby".to_string(),
            command: "solargraph".to_string(),
            args: vec!["stdio".to_string()],
            env: Default::default(),
        }),
        "c" | "cpp" | "c++" => Some(LspServerConfig {
            id: "cpp".to_string(),
            name: "C / C++".to_string(),
            command: "clangd".to_string(),
            args: vec![],
            env: Default::default(),
        }),
        "java" => Some(LspServerConfig {
            id: "java".to_string(),
            name: "Java".to_string(),
            command: "jdtls".to_string(),
            args: vec![],
            env: Default::default(),
        }),
        "csharp" | "cs" => Some(LspServerConfig {
            id: "csharp".to_string(),
            name: "C#".to_string(),
            command: "csharp-ls".to_string(),
            args: vec![],
            env: Default::default(),
        }),
        "php" => Some(LspServerConfig {
            id: "php".to_string(),
            name: "PHP".to_string(),
            command: "intelephense".to_string(),
            args: vec!["--stdio".to_string()],
            env: Default::default(),
        }),
        _ => None,
    }
}

pub fn get_all_servers() -> Vec<LspServerConfig> {
    let langs = vec![
        "go", "ts", "lua", "html", "css", "json", "ruby", "cpp", "java", "csharp", "php", "rust",
        "python",
    ];
    langs
        .into_iter()
        .filter_map(|l| get_language_config(l))
        .collect()
}
