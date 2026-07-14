# `config` Crate

The `config` crate manages application-wide configuration loading for OpenVibe. It handles reading setting files, resolving environment variables (`.env`), discovering platform directories, and mapping configuration models into runtime structures such as `AgentConfig`.

---

## Overview and Key Features

- **Configuration Management**: Loads system-wide and workspace-specific configuration values into the unified `Config` structure.
- **Environment Variable Resolution**: Integrates `.env` file parsing for local development and API key loading.
- **Provider Settings**: Configures LLM provider options (`base_url`, `model`, `api_key`, `provider_id`).
- **Agent Integration**: Provides conversion utilities (`Config::to_agent_config`) to populate runtime `AgentConfig` instances.
- **Cross-Platform Path Resolution**: Uses `dirs` crate for cross-platform system configuration directory resolution.

---

## Architecture and Modules

| Module                                            | Description                                                                                            |
| :------------------------------------------------ | :----------------------------------------------------------------------------------------------------- |
| `loader` ([`src/loader.rs`](src/loader.rs))       | Contains logic for reading configuration files from disk, merging defaults, and environment variables. |
| `types` ([`src/types.rs`](src/types.rs))          | Defines the primary `Config` struct and conversion methods to `AgentConfig`.                           |
| `provider` ([`src/provider.rs`](src/provider.rs)) | Handles provider-specific settings and presets.                                                        |
| `dotenv` ([`src/dotenv.rs`](src/dotenv.rs))       | Parses `.env` key-value files.                                                                         |

---

## Usage Example

```rust
use config::load_config;

fn main() {
    // Load application configuration
    let cfg = load_config();

    println!("Loaded Model: {}", cfg.model);
    println!("Base URL: {}", cfg.base_url);

    // Convert to AgentConfig for LLM agent runtime
    let agent_cfg = cfg.to_agent_config();
    println!("Agent CWD: {}", agent_cfg.cwd);
}
```

---

## Dependencies

- **Internal Workspace Dependencies**:
  - [`agent`](../agent) — `AgentConfig` mapping target.
- **External Dependencies**:
  - `serde`, `serde_json` — Configuration serialization.
  - `dirs` — System path resolution.
