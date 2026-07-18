use crate::AppState;
use lsp::LspServerConfig;
use tauri::{command, State};

#[command]
pub async fn get_lsp_servers() -> Result<Vec<LspServerConfig>, String> {
    Ok(lsp::languages::get_all_servers())
}

#[command]
pub async fn lsp_start_server(id: String, state: State<'_, AppState>) -> Result<(), String> {
    tracing::info!("Received request to start LSP server: {}", id);

    // Basic auto-install for runtimes based on language
    if ["ts", "html", "css", "json", "php"].contains(&id.as_str()) {
        tracing::info!("Ensuring Node.js runtime is installed...");
        state
            .runtime_manager
            .install_nodejs_runtime()
            .await
            .map_err(|e| format!("Failed to install Node.js: {}", e))?;

        let package = match id.as_str() {
            "ts" => "typescript-language-server typescript",
            "html" => "vscode-langservers-extracted",
            "css" => "vscode-langservers-extracted",
            "json" => "vscode-langservers-extracted",
            "php" => "intelephense",
            _ => "",
        };

        if !package.is_empty() {
            tracing::info!("Installing LSP package: {}", package);
            state
                .runtime_manager
                .install_package(lsp::runtime::RuntimeType::Node, package)
                .await
                .map_err(|e| format!("Failed to install NPM package: {}", e))?;
        }
    } else if id == "go" {
        tracing::info!("Ensuring Go runtime is installed...");
        state.runtime_manager.install_go_runtime().await.map_err(|e| format!("Failed to install Go: {}", e))?;

        tracing::info!("Installing LSP package: gopls");
        state
            .runtime_manager
            .install_package(lsp::runtime::RuntimeType::Go, "golang.org/x/tools/gopls@latest")
            .await
            .map_err(|e| format!("Failed to install Go package: {}", e))?;
    } else if id == "lua" {
        tracing::info!("Ensuring Lua runtime is installed...");
        state.runtime_manager.install_lua_runtime().await.map_err(|e| format!("Failed to install Lua: {}", e))?;
    } else if id == "python" {
        tracing::info!("Installing LSP package: pyright");
        state
            .runtime_manager
            .install_package(lsp::runtime::RuntimeType::Python, "pyright")
            .await
            .map_err(|e| format!("Failed to install Python package: {}", e))?;
    } else if id == "ruby" {
        tracing::info!("Installing LSP package: solargraph");
        state
            .runtime_manager
            .install_package(lsp::runtime::RuntimeType::Ruby, "solargraph")
            .await
            .map_err(|e| format!("Failed to install Ruby package: {}", e))?;
    } else if id == "csharp" {
        tracing::info!("Installing LSP package: csharp-ls");
        state
            .runtime_manager
            .install_package(lsp::runtime::RuntimeType::Dotnet, "csharp-ls")
            .await
            .map_err(|e| format!("Failed to install Dotnet package: {}", e))?;
    } else if id == "rust" {
        tracing::info!("Ensuring Rust-analyzer is installed...");
        state
            .runtime_manager
            .install_rust_analyzer_runtime()
            .await
            .map_err(|e| format!("Failed to install rust-analyzer: {}", e))?;
    } else if id == "cpp" {
        tracing::info!("Ensuring Clangd is installed...");
        state.runtime_manager.install_clangd_runtime().await.map_err(|e| format!("Failed to install clangd: {}", e))?;
    } else if id == "java" {
        tracing::info!("Ensuring JDTLS is installed...");
        state.runtime_manager.install_jdtls_runtime().await.map_err(|e| format!("Failed to install jdtls: {}", e))?;
    }

    tracing::info!("Activating LSP server: {}", id);
    state.lsp_manager.activate(&id).await.map_err(|e| format!("Failed to activate server: {}", e))?;

    tracing::info!("LSP server {} started successfully", id);
    Ok(())
}
