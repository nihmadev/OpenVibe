use std::path::Path;

pub fn resolve_path(cwd: &str, p: &str) -> String {
    let path = Path::new(p);
    if path.is_absolute() {
        p.to_string()
    } else {
        Path::new(cwd).join(p).to_string_lossy().to_string()
    }
}

pub fn clip(text: &str, max: usize) -> String {
    if text.len() <= max {
        text.to_string()
    } else {
        let mut end = max;
        while !text.is_char_boundary(end) {
            end -= 1;
        }
        format!(
            "{}\n…[truncated, {} more chars]",
            &text[..end],
            text.len() - max
        )
    }
}

pub fn glob_to_regex(pattern: &str) -> String {
    let owned;
    let p = if pattern.starts_with('.') {
        owned = format!("*{}", pattern);
        &owned
    } else {
        pattern
    };
    let mut re = String::with_capacity(p.len() * 2);
    let mut chars = p.chars().peekable();
    while let Some(ch) = chars.next() {
        match ch {
            '*' if chars.peek() == Some(&'*') => {
                chars.next();
                re.push_str(".*");
            }
            '*' => re.push_str(".*"),
            '?' => re.push('.'),
            '.' | '+' | '(' | ')' | '|' | '^' | '$' | '[' | ']' | '{' | '}' | '\\' => {
                re.push('\\');
                re.push(ch);
            }
            _ => re.push(ch),
        }
    }
    re
}

pub fn compile_patterns(patterns: &str) -> Vec<regex::Regex> {
    patterns
        .split(',')
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .filter_map(|p| regex::Regex::new(&glob_to_regex(p)).ok())
        .collect()
}

pub fn matches_any(path: &str, patterns: &[regex::Regex]) -> bool {
    if patterns.is_empty() {
        return true;
    }
    patterns.iter().any(|re| re.is_match(path))
}
