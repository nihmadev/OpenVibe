use search::walker;
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeFile {
    pub path: String,
    pub content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreloadTypesResult {
    pub types: Vec<TypeFile>,
}

fn read_small_file(path: &Path) -> Option<String> {
    let meta = path.metadata().ok()?;
    if meta.len() > 2 * 1024 * 1024 {
        return None;
    }
    fs::read_to_string(path).ok()
}

#[tauri::command]
pub async fn editor_preload_types(cwd: String) -> Result<PreloadTypesResult, String> {
    let cwd_path = Path::new(&cwd);
    let mut type_names = HashSet::new();

    // 1. Read package.json for dependency names
    let pkg_path = cwd_path.join("package.json");
    if let Some(raw) = read_small_file(&pkg_path) {
        if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&raw) {
            for key in ["dependencies", "devDependencies"] {
                if let Some(obj) = pkg.get(key).and_then(|v| v.as_object()) {
                    for name in obj.keys() {
                        type_names.insert(name.clone());
                    }
                }
            }
        }
    }

    // 2. List node_modules/@types for type package directories
    let types_dir = cwd_path.join("node_modules").join("@types");
    if let Ok(entries) = fs::read_dir(&types_dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("__") {
                    // Scoped type package (__scope__pkg → /scope__pkg)
                    type_names.insert(name.replacen("__", "/", 1));
                } else {
                    type_names.insert(name);
                }
            }
        }
    }

    let mut seen_paths = HashSet::new();
    let mut types = Vec::new();

    // 3. Resolve and read type files for each discovered name
    for type_name in &type_names {
        let paths_to_try = [
            cwd_path.join("node_modules").join(type_name).join("package.json"),
            cwd_path.join("node_modules").join("@types").join(type_name).join("package.json"),
            cwd_path
                .join("node_modules")
                .join("@types")
                .join(type_name.replace("/", "__"))
                .join("package.json"),
            cwd_path.join("node_modules").join(type_name).join("index.d.ts"),
            cwd_path
                .join("node_modules")
                .join("@types")
                .join(type_name)
                .join("index.d.ts"),
        ];

        for p in &paths_to_try {
            let p_str = p.to_string_lossy().to_string();
            if seen_paths.contains(&p_str) {
                continue;
            }

            let Some(content) = read_small_file(p) else {
                continue;
            };
            seen_paths.insert(p_str.clone());

            if p.extension().map_or(false, |e| e == "json") {
                if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content) {
                    let types_field = pkg.get("types").or_else(|| pkg.get("typings"));
                    if let Some(types_val) = types_field.and_then(|v| v.as_str()) {
                        let types_rel = if types_val.starts_with("./") {
                            &types_val[2..]
                        } else {
                            types_val
                        };
                        let types_file = p.parent().unwrap().join(types_rel);
                        let tf_str = types_file.to_string_lossy().to_string();
                        if !seen_paths.contains(&tf_str) {
                            if let Some(tc) = read_small_file(&types_file) {
                                seen_paths.insert(tf_str.clone());
                                types.push(TypeFile {
                                    path: tf_str,
                                    content: tc,
                                });
                            }
                        }
                    }
                }
            } else {
                types.push(TypeFile {
                    path: p_str,
                    content,
                });
                break;
            }
        }
    }

    // 4. Find local .d.ts files in the project (up to 50)
    let local_types = walker::find_files(&cwd, "**/*.d.ts", 50);
    for file_match in local_types {
        if seen_paths.contains(&file_match.path) {
            continue;
        }
        if let Some(content) = read_small_file(Path::new(&file_match.path)) {
            seen_paths.insert(file_match.path.clone());
            types.push(TypeFile {
                path: file_match.path,
                content,
            });
        }
    }

    Ok(PreloadTypesResult { types })
}
