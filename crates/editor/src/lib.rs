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
pub struct PackageTypeInfo {
    pub name: String,
    pub type_path: String,
    pub content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreloadTypesResult {
    pub types: Vec<TypeFile>,
    pub packages: Vec<PackageTypeInfo>,
}

fn read_small_file(path: &Path) -> Option<String> {
    let meta = path.metadata().ok()?;
    if meta.len() > 2 * 1024 * 1024 {
        return None;
    }
    fs::read_to_string(path).ok()
}

fn collect_dts_files(dir: &Path, result: &mut Vec<String>, depth: usize) {
    if depth > 8 {
        return;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_dts_files(&path, result, depth + 1);
            } else if path
                .file_name()
                .is_some_and(|n| n.to_string_lossy().ends_with(".d.ts"))
            {
                result.push(path.to_string_lossy().to_string());
            }
        }
    }
}

pub fn preload_types(cwd: &str) -> Result<PreloadTypesResult, String> {
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

    // 2. Scan node_modules/@types for type package directories.
    //    Also read their package.json to discover transitive type deps
    //    (e.g. @types/react depends on csstype, @types/prop-types, etc.)
    let types_dir = cwd_path.join("node_modules").join("@types");
    if let Ok(entries) = fs::read_dir(&types_dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let name = entry.file_name().to_string_lossy().to_string();
                let ts_name = if name.starts_with("__") {
                    name.replacen("__", "/", 1)
                } else {
                    name.clone()
                };
                type_names.insert(ts_name);

                // Discover transitive deps from @types/<pkg>/package.json
                let at_types_pkg = entry.path().join("package.json");
                if let Some(raw) = read_small_file(&at_types_pkg) {
                    if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&raw) {
                        for key in ["dependencies", "devDependencies", "peerDependencies"] {
                            if let Some(obj) = pkg.get(key).and_then(|v| v.as_object()) {
                                for dep_name in obj.keys() {
                                    type_names.insert(dep_name.clone());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let mut seen_paths = HashSet::new();
    let mut types = Vec::new();
    let mut packages = Vec::new();

    // 3. Resolve and read type files for each discovered name
    for type_name in &type_names {
        let paths_to_try = [
            cwd_path
                .join("node_modules")
                .join(type_name)
                .join("package.json"),
            cwd_path
                .join("node_modules")
                .join("@types")
                .join(type_name)
                .join("package.json"),
            cwd_path
                .join("node_modules")
                .join("@types")
                .join(type_name.replace("/", "__"))
                .join("package.json"),
            cwd_path
                .join("node_modules")
                .join(type_name)
                .join("index.d.ts"),
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

            if p.extension().is_some_and(|e| e == "json") {
                if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content) {
                    let types_field = pkg.get("types").or_else(|| pkg.get("typings"));
                    if let Some(types_val) = types_field.and_then(|v| v.as_str()) {
                        let types_rel = types_val.strip_prefix("./").unwrap_or(types_val);
                        let types_file = p.parent().unwrap().join(types_rel);
                        let tf_str = types_file.to_string_lossy().to_string();
                        if !seen_paths.contains(&tf_str) {
                            if let Some(tc) = read_small_file(&types_file) {
                                seen_paths.insert(tf_str.clone());
                                packages.push(PackageTypeInfo {
                                    name: type_name.clone(),
                                    type_path: tf_str.clone(),
                                    content: tc.clone(),
                                });
                                types.push(TypeFile {
                                    path: tf_str.clone(),
                                    content: tc,
                                });
                            }
                        }
                    }
                }
            } else {
                packages.push(PackageTypeInfo {
                    name: type_name.clone(),
                    type_path: p_str.clone(),
                    content: content.clone(),
                });
                types.push(TypeFile {
                    path: p_str.clone(),
                    content,
                });
                break;
            }
        }
    }

    // 4. Walk all .d.ts files in each @types/<pkg>/ directory to register
    //    every type file (covers internal imports like ./global.d.ts).
    //    These only go into `types` (extraLibs), not `packages` (path mappings).
    if let Ok(entries) = fs::read_dir(&types_dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let mut dts_files = Vec::new();
                collect_dts_files(&entry.path(), &mut dts_files, 0);
                for path_str in dts_files {
                    if seen_paths.contains(&path_str) {
                        continue;
                    }
                    if let Some(tc) = read_small_file(Path::new(&path_str)) {
                        seen_paths.insert(path_str.clone());
                        types.push(TypeFile {
                            path: path_str,
                            content: tc,
                        });
                    }
                }
            }
        }
    }

    // 5. For packages with bundled types (not in @types), walk their
    //    node_modules/<pkg>/ directory for .d.ts files so that cross-package
    //    imports resolve (e.g. csstype imported by @types/react).
    for type_name in &type_names {
        let pkg_dir = cwd_path.join("node_modules").join(type_name);
        if !pkg_dir.is_dir() {
            continue;
        }
        // Skip if this package already lives under @types (already handled in step 4)
        if cwd_path
            .join("node_modules")
            .join("@types")
            .join(type_name)
            .is_dir()
        {
            continue;
        }
        // Check that this package actually ships type declarations
        let has_types = read_small_file(&pkg_dir.join("package.json"))
            .and_then(|raw| {
                serde_json::from_str::<serde_json::Value>(&raw)
                    .ok()
                    .and_then(|pkg| {
                        pkg.get("types")
                            .or_else(|| pkg.get("typings"))
                            .and_then(|v| v.as_str())
                            .map(|_| ())
                    })
            })
            .is_some();
        if !has_types {
            continue;
        }
        let mut dts_files = Vec::new();
        collect_dts_files(&pkg_dir, &mut dts_files, 0);
        for path_str in dts_files {
            if seen_paths.contains(&path_str) {
                continue;
            }
            if let Some(tc) = read_small_file(Path::new(&path_str)) {
                seen_paths.insert(path_str.clone());
                // Only push to `types` (extraLibs). The entry was already
                // registered in `packages` in step 3 for path mapping.
                types.push(TypeFile {
                    path: path_str,
                    content: tc,
                });
            }
        }
    }

    // 6. Find local type declaration files in the project
    let mut local_matches = walker::find_files(cwd, "**/*.d.ts", 45);
    // Also include .ts files that commonly contain global declarations (e.g. types.ts)
    local_matches.extend(walker::find_files(cwd, "types.ts", 5));

    for file_match in local_matches {
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

    Ok(PreloadTypesResult { types, packages })
}
