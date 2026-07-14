
fn lang_from_filename(name: &str) -> &str {
    let ext = name.rsplit('.').next().unwrap_or("");
    match ext {
        "ts" | "tsx" | "vue" | "svelte" => "ts",
        "js" | "jsx" | "mjs" | "cjs" => "js",
        "rs" => "rs",
        "py" => "py",
        "go" => "go",
        "java" | "kt" | "scala" => "java",
        _ => "",
    }
}

struct LangDef {
    exts: &'static [&'static str],
    keywords: &'static [&'static str],
}

const LANG_KEYWORDS: &[LangDef] = &[
    LangDef {
        exts: &["ts", "js"],
        keywords: &[
            "const",
            "let",
            "var",
            "function",
            "return",
            "if",
            "else",
            "for",
            "while",
            "class",
            "import",
            "export",
            "from",
            "async",
            "await",
            "type",
            "interface",
            "extends",
            "implements",
            "new",
            "this",
            "throw",
            "try",
            "catch",
            "finally",
            "switch",
            "case",
            "default",
            "break",
            "continue",
            "typeof",
            "instanceof",
            "in",
            "of",
            "as",
            "keyof",
            "readonly",
            "static",
            "private",
            "protected",
            "public",
            "abstract",
            "declare",
            "delete",
            "void",
            "true",
            "false",
        ],
    },
    LangDef {
        exts: &["rs"],
        keywords: &[
            "fn", "let", "mut", "const", "if", "else", "for", "while", "loop", "return", "match",
            "pub", "use", "mod", "struct", "enum", "impl", "trait", "async", "await", "move",
            "ref", "self", "super", "crate", "where", "type", "dyn", "in", "as", "true", "false",
            "Some", "None", "Ok", "Err", "unsafe", "extern", "static", "match",
        ],
    },
    LangDef {
        exts: &["py"],
        keywords: &[
            "def", "class", "return", "if", "elif", "else", "for", "while", "import", "from", "as",
            "with", "try", "except", "finally", "raise", "yield", "lambda", "pass", "break",
            "continue", "and", "or", "not", "in", "is", "True", "False", "None", "self", "async",
            "await",
        ],
    },
    LangDef {
        exts: &["go"],
        keywords: &[
            "func",
            "return",
            "if",
            "else",
            "for",
            "range",
            "switch",
            "case",
            "default",
            "break",
            "continue",
            "var",
            "const",
            "type",
            "struct",
            "interface",
            "import",
            "package",
            "map",
            "chan",
            "go",
            "defer",
            "select",
            "fallthrough",
        ],
    },
    LangDef {
        exts: &["java"],
        keywords: &[
            "public",
            "private",
            "protected",
            "static",
            "final",
            "class",
            "interface",
            "extends",
            "implements",
            "return",
            "if",
            "else",
            "for",
            "while",
            "do",
            "switch",
            "case",
            "default",
            "break",
            "continue",
            "new",
            "this",
            "super",
            "import",
            "package",
            "void",
            "int",
            "boolean",
            "String",
            "null",
            "true",
            "false",
            "throw",
            "throws",
            "try",
            "catch",
            "finally",
        ],
    },
];

fn keywords_for_lang(lang: &str) -> &[&str] {
    for def in LANG_KEYWORDS {
        if def.exts.contains(&lang) {
            return def.keywords;
        }
    }
    &[]
}

/// Tokenize a single line of code into syntax tokens (no query highlighting).
pub fn tokenize_line(line: &str, lang: &str) -> Vec<crate::types::SyntaxToken> {
    let keywords = keywords_for_lang(lang);
    let mut tokens = Vec::new();
    let mut i = 0;
    let bytes = line.as_bytes();
    while i < bytes.len() {
        // Strings
        if i < bytes.len() && (bytes[i] == b'"' || bytes[i] == b'\'' || bytes[i] == b'`') {
            let quote = bytes[i];
            let start = i;
            i += 1;
            while i < bytes.len() && bytes[i] != quote {
                if bytes[i] == b'\\' {
                    i += 1;
                }
                i += 1;
            }
            if i < bytes.len() {
                i += 1;
            }
            tokens.push(crate::types::SyntaxToken {
                text: line[start..i].to_string(),
                class_name: "sc-token-string".to_string(),
            });
            continue;
        }
        // Comments
        if i + 1 < bytes.len() && bytes[i] == b'/' && (bytes[i + 1] == b'/' || bytes[i + 1] == b'*')
        {
            tokens.push(crate::types::SyntaxToken {
                text: line[i..].to_string(),
                class_name: "sc-token-comment".to_string(),
            });
            break;
        }
        // Numbers
        if bytes[i].is_ascii_digit() {
            let start = i;
            while i < bytes.len() && (bytes[i].is_ascii_digit() || bytes[i] == b'.') {
                i += 1;
            }
            tokens.push(crate::types::SyntaxToken {
                text: line[start..i].to_string(),
                class_name: "sc-token-number".to_string(),
            });
            continue;
        }
        // Identifiers / keywords
        if bytes[i].is_ascii_alphabetic() || bytes[i] == b'_' || bytes[i] == b'$' {
            let start = i;
            while i < bytes.len()
                && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'_' || bytes[i] == b'$')
            {
                i += 1;
            }
            let word = &line[start..i];
            let class = if keywords.contains(&word) {
                "sc-token-keyword"
            } else {
                "sc-token-identifier"
            };
            tokens.push(crate::types::SyntaxToken {
                text: word.to_string(),
                class_name: class.to_string(),
            });
            continue;
        }
        // Whitespace
        if bytes[i].is_ascii_whitespace() {
            let start = i;
            while i < bytes.len() && bytes[i].is_ascii_whitespace() {
                i += 1;
            }
            tokens.push(crate::types::SyntaxToken {
                text: line[start..i].to_string(),
                class_name: "sc-token-ws".to_string(),
            });
            continue;
        }
        // Punctuation / other (handle multi-byte UTF-8)
        let ch = line[i..]
            .chars()
            .next()
            .unwrap_or(std::char::REPLACEMENT_CHARACTER);
        let char_len = ch.len_utf8();
        tokens.push(crate::types::SyntaxToken {
            text: line[i..i + char_len].to_string(),
            class_name: "sc-token-punctuation".to_string(),
        });
        i += char_len;
    }
    tokens
}

/// Tokenize a line and highlight query matches within tokens.
/// Returns (tokens, match_ranges) where match_ranges are byte offset ranges to highlight.
pub fn highlight_line(
    line: &str,
    lang: &str,
    query: &str,
    match_case: bool,
) -> Vec<crate::types::SyntaxToken> {
    let tokens = tokenize_line(line, lang);
    if query.is_empty() {
        return tokens;
    }

    let q = if match_case {
        query.to_string()
    } else {
        query.to_ascii_lowercase()
    };
    let mut result = Vec::new();

    for token in &tokens {
        let txt = if match_case {
            &token.text
        } else {
            &token.text.to_ascii_lowercase()
        };
        let mut last = 0usize;
        let mut in_match = false;
        let mut match_started = last;

        // Simple scan through the text for query matches
        let query_bytes = q.as_bytes();
        let text_bytes = txt.as_bytes();
        let mut pos = 0;
        while pos + query_bytes.len() <= text_bytes.len() {
            let matched = if query_bytes.is_empty() {
                false
            } else {
                &text_bytes[pos..pos + query_bytes.len()] == query_bytes
            };
            if matched {
                if !in_match {
                    // push preceding unmatched part
                    if pos > last {
                        result.push(crate::types::SyntaxToken {
                            text: token.text[last..pos].to_string(),
                            class_name: token.class_name.clone(),
                        });
                    }
                    in_match = true;
                    match_started = pos;
                }
                pos += query_bytes.len();
            } else {
                if in_match {
                    result.push(crate::types::SyntaxToken {
                        text: token.text[match_started..pos].to_string(),
                        class_name: "sc-match-highlight".to_string(),
                    });
                    in_match = false;
                    last = pos;
                }
                pos += 1;
            }
        }
        if in_match {
            result.push(crate::types::SyntaxToken {
                text: token.text[match_started..].to_string(),
                class_name: "sc-match-highlight".to_string(),
            });
        } else if last < token.text.len() {
            result.push(crate::types::SyntaxToken {
                text: token.text[last..].to_string(),
                class_name: token.class_name.clone(),
            });
        }
    }
    result
}

/// Highlight multiple lines in one batch call.
pub fn highlight_lines(
    lines: &[&str],
    file_name: &str,
    query: &str,
    match_case: bool,
) -> Vec<Vec<crate::types::SyntaxToken>> {
    let lang = lang_from_filename(file_name);
    lines
        .iter()
        .map(|line| highlight_line(line, lang, query, match_case))
        .collect()
}
