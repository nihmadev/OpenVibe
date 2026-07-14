use crate::types::LineRange;
use std::path::{Path, PathBuf};
use tree_sitter::Parser;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SymbolKind {
    Function,
    Struct,
    Enum,
    Trait,
    Impl,
    Import,
    Module,
    Unknown,
}

#[derive(Debug, Clone)]
pub struct SymbolDefinition {
    pub name: String,
    pub kind: SymbolKind,
    pub file_path: PathBuf,
    pub range: LineRange,
}

#[derive(Debug, Clone)]
pub struct FileImports {
    pub file_path: PathBuf,
    pub imported_modules: Vec<String>,
}

pub struct AstService {
    parser_rust: Parser,
    parser_js: Parser,
    parser_ts: Parser,
    parser_py: Parser,
}

impl Default for AstService {
    fn default() -> Self {
        Self::new()
    }
}

impl AstService {
    pub fn new() -> Self {
        let mut parser_rust = Parser::new();
        let language_rust = tree_sitter_rust::LANGUAGE.into();
        parser_rust
            .set_language(&language_rust)
            .expect("Error loading Rust tree-sitter grammar");

        let mut parser_js = Parser::new();
        let language_js = tree_sitter_javascript::LANGUAGE.into();
        parser_js
            .set_language(&language_js)
            .expect("Error loading JS tree-sitter grammar");

        let mut parser_ts = Parser::new();
        let language_ts = tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into();
        parser_ts
            .set_language(&language_ts)
            .expect("Error loading TS tree-sitter grammar");

        let mut parser_py = Parser::new();
        let language_py = tree_sitter_python::LANGUAGE.into();
        parser_py
            .set_language(&language_py)
            .expect("Error loading Python tree-sitter grammar");

        Self {
            parser_rust,
            parser_js,
            parser_ts,
            parser_py,
        }
    }

    pub fn parse_file(
        &mut self,
        path: &Path,
        content: &str,
    ) -> (Vec<SymbolDefinition>, FileImports) {
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        match ext {
            "rs" => Self::parse_with_tree_sitter(path, content, &mut self.parser_rust, "rust"),
            "js" | "jsx" => {
                Self::parse_with_tree_sitter(path, content, &mut self.parser_js, "javascript")
            }
            "ts" | "tsx" => {
                Self::parse_with_tree_sitter(path, content, &mut self.parser_ts, "typescript")
            }
            "py" => Self::parse_with_tree_sitter(path, content, &mut self.parser_py, "python"),
            _ => self.parse_heuristic(path, content),
        }
    }

    fn parse_with_tree_sitter(
        path: &Path,
        content: &str,
        parser: &mut Parser,
        lang: &str,
    ) -> (Vec<SymbolDefinition>, FileImports) {
        let mut symbols = Vec::new();
        let mut imported_modules = Vec::new();

        if let Some(tree) = parser.parse(content, None) {
            let root = tree.root_node();
            let mut cursor = root.walk();

            // Simple BFS or DFS using tree-sitter child iteration (only checking top-level nodes for speed)
            for child in root.children(&mut cursor) {
                let kind = child.kind();

                if kind.contains("function") || kind.contains("method") {
                    if let Some(name_node) = child.child_by_field_name("name") {
                        let name = name_node
                            .utf8_text(content.as_bytes())
                            .unwrap_or("")
                            .to_string();
                        let start_line = child.start_position().row as u32 + 1;
                        let end_line = child.end_position().row as u32 + 1;
                        symbols.push(SymbolDefinition {
                            name,
                            kind: SymbolKind::Function,
                            file_path: path.to_path_buf(),
                            range: LineRange {
                                start_line,
                                end_line,
                            },
                        });
                    }
                } else if kind.contains("class")
                    || kind.contains("struct")
                    || kind.contains("interface")
                {
                    if let Some(name_node) = child.child_by_field_name("name") {
                        let name = name_node
                            .utf8_text(content.as_bytes())
                            .unwrap_or("")
                            .to_string();
                        let start_line = child.start_position().row as u32 + 1;
                        let end_line = child.end_position().row as u32 + 1;
                        symbols.push(SymbolDefinition {
                            name,
                            kind: SymbolKind::Struct,
                            file_path: path.to_path_buf(),
                            range: LineRange {
                                start_line,
                                end_line,
                            },
                        });
                    }
                } else if kind == "enum_item" || kind == "enum_declaration" {
                    if let Some(name_node) = child.child_by_field_name("name") {
                        let name = name_node
                            .utf8_text(content.as_bytes())
                            .unwrap_or("")
                            .to_string();
                        let start_line = child.start_position().row as u32 + 1;
                        let end_line = child.end_position().row as u32 + 1;
                        symbols.push(SymbolDefinition {
                            name,
                            kind: SymbolKind::Enum,
                            file_path: path.to_path_buf(),
                            range: LineRange {
                                start_line,
                                end_line,
                            },
                        });
                    }
                } else if kind == "trait_item" {
                    if let Some(name_node) = child.child_by_field_name("name") {
                        let name = name_node
                            .utf8_text(content.as_bytes())
                            .unwrap_or("")
                            .to_string();
                        let start_line = child.start_position().row as u32 + 1;
                        let end_line = child.end_position().row as u32 + 1;
                        symbols.push(SymbolDefinition {
                            name,
                            kind: SymbolKind::Trait,
                            file_path: path.to_path_buf(),
                            range: LineRange {
                                start_line,
                                end_line,
                            },
                        });
                    }
                } else if kind == "use_declaration"
                    || kind == "import_statement"
                    || kind == "import_declaration"
                    || kind == "import_from_statement"
                {
                    let use_text = child.utf8_text(content.as_bytes()).unwrap_or("");
                    if lang == "rust" {
                        let cleaned = use_text
                            .trim_start_matches("use ")
                            .trim_end_matches(';')
                            .trim();
                        imported_modules.push(cleaned.to_string());
                    } else if lang == "javascript" || lang == "typescript" {
                        if let Some(source_node) = child.child_by_field_name("source") {
                            let src = source_node
                                .utf8_text(content.as_bytes())
                                .unwrap_or("")
                                .trim_matches('\'')
                                .trim_matches('\"');
                            imported_modules.push(src.to_string());
                        }
                    } else if lang == "python" {
                        if let Some(module_name_node) = child.child_by_field_name("module_name") {
                            let src = module_name_node.utf8_text(content.as_bytes()).unwrap_or("");
                            imported_modules.push(src.to_string());
                        } else if let Some(name_node) = child.child_by_field_name("name") {
                            let src = name_node.utf8_text(content.as_bytes()).unwrap_or("");
                            imported_modules.push(src.to_string());
                        }
                    }
                } else if kind == "mod_item" {
                    if let Some(name_node) = child.child_by_field_name("name") {
                        let name = name_node
                            .utf8_text(content.as_bytes())
                            .unwrap_or("")
                            .to_string();
                        imported_modules.push(name.clone());
                        let start_line = child.start_position().row as u32 + 1;
                        let end_line = child.end_position().row as u32 + 1;
                        symbols.push(SymbolDefinition {
                            name,
                            kind: SymbolKind::Module,
                            file_path: path.to_path_buf(),
                            range: LineRange {
                                start_line,
                                end_line,
                            },
                        });
                    }
                }
            }
        }

        (
            symbols,
            FileImports {
                file_path: path.to_path_buf(),
                imported_modules,
            },
        )
    }

    fn parse_heuristic(&self, path: &Path, content: &str) -> (Vec<SymbolDefinition>, FileImports) {
        let mut symbols = Vec::new();
        let mut imported_modules = Vec::new();

        for (idx, line) in content.lines().enumerate() {
            let line_num = idx as u32 + 1;
            let trimmed = line.trim();

            if trimmed.starts_with("import ")
                || trimmed.starts_with("from ")
                || trimmed.starts_with("require(")
            {
                imported_modules.push(trimmed.to_string());
            } else if trimmed.starts_with("function ")
                || trimmed.starts_with("export function ")
                || trimmed.starts_with("const ") && trimmed.contains("=>")
            {
                symbols.push(SymbolDefinition {
                    name: trimmed.to_string(),
                    kind: SymbolKind::Function,
                    file_path: path.to_path_buf(),
                    range: LineRange {
                        start_line: line_num,
                        end_line: line_num + 5,
                    },
                });
            } else if trimmed.starts_with("class ")
                || trimmed.starts_with("export class ")
                || trimmed.starts_with("interface ")
            {
                symbols.push(SymbolDefinition {
                    name: trimmed.to_string(),
                    kind: SymbolKind::Struct,
                    file_path: path.to_path_buf(),
                    range: LineRange {
                        start_line: line_num,
                        end_line: line_num + 10,
                    },
                });
            }
        }

        (
            symbols,
            FileImports {
                file_path: path.to_path_buf(),
                imported_modules,
            },
        )
    }

    pub fn skeletonize_file(&mut self, path: &Path, content: &str) -> String {
        let (symbols, imports) = self.parse_file(path, content);
        let mut out = String::new();

        // Add imports
        for import in imports.imported_modules {
            if path.extension().and_then(|e| e.to_str()) == Some("rs") {
                out.push_str(&format!("use {};\n", import));
            } else {
                out.push_str(&format!("import {};\n", import));
            }
        }
        out.push('\n');

        let lines: Vec<&str> = content.lines().collect();

        for sym in symbols {
            let start = sym.range.start_line.saturating_sub(1) as usize;
            let end = (start + 2)
                .min(sym.range.end_line as usize)
                .min(lines.len());
            for i in start..end {
                out.push_str(lines[i]);
                out.push('\n');
            }
            out.push_str("    // ...\n");
            if sym.kind == SymbolKind::Struct
                || sym.kind == SymbolKind::Enum
                || sym.kind == SymbolKind::Trait
            {
                out.push_str("}\n");
            }
            out.push('\n');
        }

        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_rust_code() {
        let mut ast = AstService::new();
        let code = r#"
            use std::collections::HashMap;
            use crate::types::Scg2Config;

            pub struct MyStruct {
                pub value: usize,
            }

            pub fn process_data(data: &str) -> usize {
                data.len()
            }
        "#;

        let (symbols, imports) = ast.parse_file(Path::new("test.rs"), code);

        assert_eq!(imports.imported_modules.len(), 2);
        assert_eq!(symbols.len(), 2);
        assert_eq!(symbols[0].name, "MyStruct");
        assert_eq!(symbols[0].kind, SymbolKind::Struct);
        assert_eq!(symbols[1].name, "process_data");
        assert_eq!(symbols[1].kind, SymbolKind::Function);
    }
}
