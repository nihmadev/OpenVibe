use serde_json::Value;
use std::io::Write;
use std::process::{Command, Stdio};

const MAX_OUTPUT: usize = 512 * 1024;
const BRANCH_FORMAT: &str =
    "%(refname:short)\t%(objectname:short)\t%(HEAD)\t%(upstream:short)\t%(contents:subject)";
const REF_FORMAT: &str = "%(refname)\t%(objectname:short)\t%(creatordate:iso)\t%(subject)";
const LOG_FORMAT: &str = "%H\t%P\t%an\t%ae\t%ad\t%s";

/// Run Git with the repository path and return its standard output.
fn run_git(cwd: &str, arguments: &[String]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(cwd)
        .args(arguments)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GIT_NO_LAZY_FETCH", "1")
        .stdin(Stdio::null())
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    let text = String::from_utf8_lossy(&output.stdout).into_owned();
    if text.len() > MAX_OUTPUT {
        return Ok(format!(
            "{}\n[output truncated at {} bytes]",
            &text[..MAX_OUTPUT],
            MAX_OUTPUT
        ));
    }
    Ok(text)
}
fn string_argument<'a>(args: &'a Value, key: &str, default: &'a str) -> &'a str {
    args.get(key).and_then(Value::as_str).unwrap_or(default)
}

fn optional_string<'a>(args: &'a Value, key: &str) -> Option<&'a str> {
    args.get(key)
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
}

fn validate_ref(value: &str) -> Result<String, String> {
    if value.is_empty() || value.starts_with('-') || value.contains('\0') {
        Err("Invalid Git ref".into())
    } else {
        Ok(value.to_string())
    }
}

fn validate_path(value: &str) -> Result<String, String> {
    if value.starts_with('-') || value.contains('\0') {
        Err("Invalid Git path".into())
    } else {
        Ok(value.to_string())
    }
}

fn optional_argument(args: &Value, key: &str) -> Option<String> {
    optional_string(args, key).map(str::to_string)
}

pub async fn status(cwd: &str, args: &Value) -> Result<String, String> {
    let mut command = vec!["status".into(), "--short".into(), "--branch".into()];
    if let Some(p) = optional_argument(args, "path") {
        command.extend(["--".into(), validate_path(&p)?]);
    }
    run_git(cwd, &command)
}
pub async fn branches(cwd: &str, args: &Value) -> Result<String, String> {
    let kind = string_argument(args, "kind", "all");
    let mut command = vec!["for-each-ref".into(), format!("--format={BRANCH_FORMAT}")];
    match kind {
        "local" => command.push("refs/heads".into()),
        "remote" | "remotes" => command.push("refs/remotes".into()),
        "all" => command.extend(["refs/heads".into(), "refs/remotes".into()]),
        _ => return Err("kind must be local, remote, or all".into()),
    }
    if let Some(pattern) = optional_string(args, "pattern") {
        command.push(validate_ref(pattern)?);
    }
    run_git(cwd, &command)
}
pub async fn refs(cwd: &str, args: &Value) -> Result<String, String> {
    let kind = string_argument(args, "kind", "all");
    let mut command = vec!["for-each-ref".into(), format!("--format={REF_FORMAT}")];
    match kind {
        "tags" => command.push("refs/tags".into()),
        "heads" | "local" => command.push("refs/heads".into()),
        "remotes" => command.push("refs/remotes".into()),
        "all" => {}
        _ => return Err("kind must be tags, heads, remotes, or all".into()),
    }
    if let Some(pattern) = optional_string(args, "pattern") {
        command.push(validate_ref(pattern)?);
    }
    run_git(cwd, &command)
}
pub async fn log(cwd: &str, args: &Value) -> Result<String, String> {
    let n = args
        .get("max_count")
        .and_then(Value::as_u64)
        .unwrap_or(20)
        .clamp(1, 100)
        .to_string();
    let reference = validate_ref(string_argument(args, "ref", "HEAD"))?;
    let mut command = vec![
        "log".into(),
        "--date=iso".into(),
        format!("--pretty=format:{LOG_FORMAT}"),
        "-n".into(),
        n,
    ];
    if args.get("all").and_then(Value::as_bool).unwrap_or(false) {
        command.push("--all".into());
    }
    if args
        .get("first_parent")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        command.push("--first-parent".into());
    }
    for (key, flag) in [
        ("author", "--author="),
        ("grep", "--grep="),
        ("since", "--since="),
        ("until", "--until="),
    ] {
        if let Some(value) = optional_string(args, key) {
            command.push(format!("{flag}{value}"));
        }
    }
    command.push(reference);
    if let Some(path) = optional_string(args, "path") {
        command.extend(["--".into(), validate_path(path)?]);
    }
    run_git(cwd, &command)
}
pub async fn diff(cwd: &str, args: &Value) -> Result<String, String> {
    let mut command = vec![
        "diff".into(),
        "--no-ext-diff".into(),
        "--no-textconv".into(),
    ];
    if args.get("staged").and_then(Value::as_bool).unwrap_or(false) {
        command.push("--cached".into());
    }
    if let Some(format) = optional_string(args, "format") {
        match format {
            "stat" => command.push("--stat".into()),
            "name_status" => command.push("--name-status".into()),
            "numstat" => command.push("--numstat".into()),
            "patch" => {}
            _ => return Err("format must be patch, stat, name_status, or numstat".into()),
        }
    }
    if let Some(n) = args.get("context_lines").and_then(Value::as_u64) {
        command.push(format!("-U{}", n.min(100)));
    }
    if args
        .get("ignore_whitespace")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        command.push("--ignore-space-change".into());
    }
    if let Some(base) = optional_string(args, "base") {
        command.push(validate_ref(base)?);
    }
    if let Some(target) = optional_string(args, "target") {
        command.push(validate_ref(target)?);
    }
    if let Some(path) = optional_string(args, "path") {
        command.extend(["--".into(), validate_path(path)?]);
    }
    run_git(cwd, &command)
}
pub async fn show(cwd: &str, args: &Value) -> Result<String, String> {
    let reference = validate_ref(string_argument(args, "ref", "HEAD"))?;
    let mode = string_argument(args, "mode", "metadata");

    if mode == "content" {
        let path = optional_string(args, "path").ok_or("path is required in content mode")?;
        let path = validate_path(path)?;
        // A path after -- selects a patch. The REF:path form reads the blob.
        return run_git(cwd, &["show".into(), format!("{reference}:{path}")]);
    }

    let mut command = vec![
        "show".into(),
        "--no-ext-diff".into(),
        "--no-textconv".into(),
    ];
    match mode {
        "metadata" => command.push("--no-patch".into()),
        "patch" => {}
        _ => return Err("mode must be metadata, patch, or content".into()),
    }
    command.push(reference);
    if let Some(path) = optional_string(args, "path") {
        command.extend(["--".into(), validate_path(path)?]);
    }
    run_git(cwd, &command)
}
pub async fn blame(cwd: &str, args: &Value) -> Result<String, String> {
    let path = validate_path(string_argument(args, "path", ""))?;
    if path.is_empty() {
        return Err("path is required".into());
    }
    let mut command = vec!["blame".into(), "--line-porcelain".into()];
    if let Some(reference) = optional_string(args, "ref") {
        command.push(validate_ref(reference)?);
    }
    if let (Some(start), Some(end)) = (
        args.get("start_line").and_then(Value::as_u64),
        args.get("end_line").and_then(Value::as_u64),
    ) {
        command.push(format!("-L{},{}", start.max(1), end.max(start)));
    }
    command.extend(["--".into(), path]);
    run_git(cwd, &command)
}
pub async fn merge_base(cwd: &str, args: &Value) -> Result<String, String> {
    let base = validate_ref(string_argument(args, "base", ""))?;
    let target = validate_ref(string_argument(args, "target", ""))?;
    if base.is_empty() || target.is_empty() {
        return Err("base and target are required".into());
    }
    if string_argument(args, "mode", "merge_base") == "is_ancestor" {
        run_git(
            cwd,
            &["merge-base".into(), "--is-ancestor".into(), base, target],
        )
    } else {
        run_git(cwd, &["merge-base".into(), base, target])
    }
}
pub async fn tree(cwd: &str, args: &Value) -> Result<String, String> {
    let reference = validate_ref(string_argument(args, "ref", "HEAD"))?;
    let mut command = vec!["ls-tree".into()];
    if args
        .get("recursive")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        command.push("-r".into());
    }
    command.extend([reference, "--".into()]);
    if let Some(path) = optional_string(args, "path") {
        command.push(validate_path(path)?);
    }
    run_git(cwd, &command)
}
pub async fn grep(cwd: &str, args: &Value) -> Result<String, String> {
    let query = string_argument(args, "query", "");
    if query.is_empty() {
        return Err("query is required".into());
    }
    let reference = validate_ref(string_argument(args, "ref", "HEAD"))?;
    let mut command = vec![
        "grep".into(),
        "-n".into(),
        "-I".into(),
        query.into(),
        reference,
        "--".into(),
    ];
    if let Some(path) = optional_string(args, "path") {
        command.push(validate_path(path)?);
    }
    run_git(cwd, &command)
}
pub async fn check_ignore(cwd: &str, args: &Value) -> Result<String, String> {
    let paths = args
        .get("paths")
        .and_then(Value::as_array)
        .ok_or("paths is required")?;
    let input = paths
        .iter()
        .filter_map(Value::as_str)
        .map(validate_path)
        .collect::<Result<Vec<_>, _>>()?
        .join("\n");
    let mut child = Command::new("git")
        .arg("-C")
        .arg(cwd)
        .args(["check-ignore", "-v", "--stdin"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    child
        .stdin
        .take()
        .ok_or("failed to open stdin")?
        .write_all(input.as_bytes())
        .map_err(|e| e.to_string())?;
    let output = child.wait_with_output().map_err(|e| e.to_string())?;
    if !output.status.success() && output.stdout.is_empty() {
        return Ok(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}
pub async fn stash_list(cwd: &str, _args: &Value) -> Result<String, String> {
    run_git(cwd, &["stash".into(), "list".into(), "--date=iso".into()])
}
pub async fn reflog(cwd: &str, args: &Value) -> Result<String, String> {
    let reference = validate_ref(string_argument(args, "ref", "HEAD"))?;
    let n = args
        .get("max_count")
        .and_then(Value::as_u64)
        .unwrap_or(20)
        .clamp(1, 100)
        .to_string();
    run_git(cwd, &["reflog".into(), "-n".into(), n, reference])
}
pub async fn remotes(cwd: &str, _args: &Value) -> Result<String, String> {
    run_git(cwd, &["remote".into(), "-v".into()])
}
pub async fn worktrees(cwd: &str, _args: &Value) -> Result<String, String> {
    run_git(
        cwd,
        &["worktree".into(), "list".into(), "--porcelain".into()],
    )
}
pub async fn submodules(cwd: &str, _args: &Value) -> Result<String, String> {
    run_git(
        cwd,
        &["submodule".into(), "status".into(), "--recursive".into()],
    )
}
