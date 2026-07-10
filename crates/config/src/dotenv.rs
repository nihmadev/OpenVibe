use std::collections::HashMap;
use std::fs;
use std::path::Path;

pub fn load_dotenv(path: &Path, env: &mut HashMap<String, String>) {
    if !path.exists() {
        return;
    }
    let text = match fs::read_to_string(path) {
        Ok(t) => t,
        Err(_) => return,
    };
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some(eq) = trimmed.find('=') {
            let key = trimmed[..eq].trim().to_string();
            let mut value = trimmed[eq + 1..].trim().to_string();
            if (value.starts_with('"') && value.ends_with('"'))
                || (value.starts_with('\'') && value.ends_with('\''))
            {
                value = value[1..value.len() - 1].to_string();
            }
            env.entry(key).or_insert(value);
        }
    }
}
