use search::walker;
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
}

#[tauri::command]
pub fn fs_list(dir: String) -> Result<Vec<FsEntry>, String> {
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    let mut result: Vec<FsEntry> = entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            !search::config::should_skip(&name)
        })
        .map(|e| {
            let path = e.path();
            let name = e.file_name().to_string_lossy().to_string();
            let full = path.to_string_lossy().to_string();
            let is_dir = path.is_dir();
            let size = if path.is_file() { path.metadata().ok().map(|m| m.len()) } else { None };
            FsEntry { name, path: full, is_dir, size }
        })
        .collect();
    result.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            return if a.is_dir { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater };
        }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });
    Ok(result)
}

#[tauri::command]
pub async fn fs_read(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    let meta = p.metadata().map_err(|e| e.to_string())?;
    let limit: u64 = 2 * 1024 * 1024;
    if meta.len() > limit {
        return Err(format!("File too large ({} bytes)", meta.len()));
    }
    fs::read_to_string(p).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_read_binary(path: String) -> Result<serde_json::Value, String> {
    let data = fs::read(&path).map_err(|e| e.to_string())?;
    let size = data.len();
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(serde_json::json!({ "data": b64, "size": size }))
}

#[tauri::command]
pub async fn fs_write(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_rename(from: String, to: String) -> Result<(), String> {
    fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_delete(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn fs_create_file(dir: String, name: String) -> Result<String, String> {
    let p = Path::new(&dir).join(&name);
    if p.exists() {
        return Err("File already exists".to_string());
    }
    fs::write(&p, "").map_err(|e| e.to_string())?;
    Ok(p.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn fs_create_dir(dir: String, name: String) -> Result<String, String> {
    let p = Path::new(&dir).join(&name);
    fs::create_dir(&p).map_err(|e| e.to_string())?;
    Ok(p.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn fs_find(
    root: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<search::types::FileMatch>, String> {
    Ok(walker::find_files(&root, &query, limit.unwrap_or(30)))
}

#[tauri::command]
pub async fn fs_find_all(
    root: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<search::types::FileMatch>, String> {
    Ok(walker::find_all(&root, &query, limit.unwrap_or(50)))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilteredResult {
    pub total: usize,
    pub matches: Vec<search::types::ContentMatch>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileGroupsResult {
    pub files: Vec<search::types::FileGroupEntry>,
    pub total_matches: usize,
}

#[tauri::command]
pub async fn fs_search_content(
    root: String,
    query: String,
    max_results: Option<usize>,
    match_case: Option<bool>,
    match_whole_word: Option<bool>,
    use_regex: Option<bool>,
    include: Option<String>,
    exclude: Option<String>,
) -> Result<Vec<search::types::ContentMatch>, String> {
    let cwd = std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let use_regex = use_regex.unwrap_or(false);
    let match_case = match_case.unwrap_or(false);
    let match_whole_word = match_whole_word.unwrap_or(false);
    let max = max_results.unwrap_or(500);
    let include = include.unwrap_or_default();
    let exclude = exclude.unwrap_or_default();

    // Populate cache via broad search, then return a filtered page
    search::ensure_cached(&cwd, &query, &root, use_regex).await?;
    let (_total, page) = search::filter_cached(
        &cwd, &query, &root, use_regex,
        match_case, match_whole_word,
        &include, &exclude,
        0, max,
    )?;
    Ok(page)
}

#[tauri::command]
pub async fn fs_search_content_filter(
    root: String,
    query: String,
    match_case: bool,
    match_whole_word: bool,
    use_regex: bool,
    include: String,
    exclude: String,
    offset: usize,
    limit: usize,
) -> Result<FilteredResult, String> {
    let cwd = std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let (total, matches) = search::filter_cached(
        &cwd, &query, &root, use_regex,
        match_case, match_whole_word,
        &include, &exclude,
        offset, limit,
    )?;
    Ok(FilteredResult { total, matches })
}

#[tauri::command]
pub async fn fs_search_content_files(
    root: String,
    query: String,
    match_case: Option<bool>,
    match_whole_word: Option<bool>,
    use_regex: Option<bool>,
    include: Option<String>,
    exclude: Option<String>,
    max_files: Option<usize>,
) -> Result<FileGroupsResult, String> {
    let cwd = std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let use_regex = use_regex.unwrap_or(false);
    let match_case = match_case.unwrap_or(false);
    let match_whole_word = match_whole_word.unwrap_or(false);
    let max_files = max_files.unwrap_or(1000);
    let include = include.unwrap_or_default();
    let exclude = exclude.unwrap_or_default();

    // Use file_groups_from_cache — iterates cached matches with refs, no cloning of all matches
    search::ensure_cached(&cwd, &query, &root, use_regex).await?;
    let (files, total_matches) = search::file_groups_from_cache(
        &cwd, &query, &root, use_regex,
        match_case, match_whole_word,
        &include, &exclude,
        max_files,
    )?;

    Ok(FileGroupsResult { files, total_matches })
}

#[tauri::command]
pub async fn fs_search_content_file_matches(
    root: String,
    query: String,
    match_case: bool,
    match_whole_word: bool,
    use_regex: bool,
    include: String,
    exclude: String,
    file_path: String,
    offset: usize,
    limit: usize,
) -> Result<FilteredResult, String> {
    let cwd = std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    search::ensure_cached(&cwd, &query, &root, use_regex).await?;
    let (page, total) = search::file_matches_from_cache(
        &cwd, &query, &root, use_regex,
        match_case, match_whole_word,
        &include, &exclude,
        &file_path, offset, limit,
    )?;

    Ok(FilteredResult { total, matches: page })
}

#[tauri::command]
pub async fn fs_highlight_lines(
    lines: Vec<String>,
    file_name: String,
    query: String,
    match_case: bool,
) -> Result<Vec<Vec<search::types::SyntaxToken>>, String> {
    let refs: Vec<&str> = lines.iter().map(|s| s.as_str()).collect();
    Ok(search::highlight_lines(&refs, &file_name, &query, match_case))
}

#[tauri::command]
pub async fn fs_project_info(dir: String) -> Result<serde_json::Value, String> {
    let pkg = Path::new(&dir).join("package.json");
    let raw = fs::read_to_string(&pkg).map_err(|e| e.to_string())?;
    let data: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    let name = data.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let version = data.get("version").and_then(|v| v.as_str()).unwrap_or("");
    Ok(serde_json::json!({ "name": name, "version": version }))
}

#[tauri::command]
pub async fn whisper_transcribe(audio_base64: String, mime_type: String) -> Result<serde_json::Value, String> {
    let api_key = std::env::var("GROQ_API_KEY")
        .or_else(|_| std::env::var("VIBE_API_KEY"))
        .or_else(|_| std::env::var("OPENAI_API_KEY"))
        .unwrap_or_default();
    if api_key.is_empty() {
        return Err("No API key for whisper".to_string());
    }
    let base_url = if std::env::var("GROQ_API_KEY").is_ok() {
        "https://api.groq.com/openai/v1".to_string()
    } else {
        "https://api.openai.com/v1".to_string()
    };

    use base64::Engine;
    let audio_bytes = base64::engine::general_purpose::STANDARD.decode(&audio_base64).map_err(|e| e.to_string())?;

    let ext = if mime_type.contains("webm") {
        "webm"
    } else if mime_type.contains("ogg") {
        "ogg"
    } else if mime_type.contains("mp4") {
        "mp4"
    } else {
        "wav"
    };

    let boundary = format!("----vibewhisper{}", chrono_now());
    let mut body = Vec::new();
    body.extend_from_slice(
        format!("--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"audio.{ext}\"\r\nContent-Type: {mime_type}\r\n\r\n").as_bytes()
    );
    body.extend_from_slice(&audio_bytes);
    body.extend_from_slice(b"\r\n");
    body.extend_from_slice(
        format!("--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\nwhisper-large-v3\r\n")
            .as_bytes(),
    );
    body.extend_from_slice(format!("--{boundary}--\r\n").as_bytes());

    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/audio/transcriptions", base_url))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", format!("multipart/form-data; boundary={}", boundary))
        .body(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = res.status();
    if !status.is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(format!("{}: {}", status, text));
    }

    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let text = data.get("text").and_then(|v| v.as_str()).unwrap_or("");
    Ok(serde_json::json!({ "ok": true, "text": text }))
}

fn chrono_now() -> i64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as i64
}
