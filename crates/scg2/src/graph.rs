use crate::ast::SymbolDefinition;
use petgraph::graph::{DiGraph, NodeIndex};
use petgraph::visit::EdgeRef;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub enum GraphNode {
    File(PathBuf),
    Symbol(SymbolDefinition),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EdgeKind {
    Imports,
    Defines,
    References,
}

pub struct ContextGraph {
    graph: DiGraph<GraphNode, EdgeKind>,
    node_by_file: HashMap<PathBuf, NodeIndex>,
    symbol_index: HashMap<String, Vec<NodeIndex>>,
}

impl Default for ContextGraph {
    fn default() -> Self {
        Self::new()
    }
}

impl ContextGraph {
    pub fn new() -> Self {
        Self {
            graph: DiGraph::new(),
            node_by_file: HashMap::new(),
            symbol_index: HashMap::new(),
        }
    }

    pub fn get_or_create_file_node(&mut self, path: &Path) -> NodeIndex {
        if let Some(&idx) = self.node_by_file.get(path) {
            return idx;
        }

        let node_idx = self.graph.add_node(GraphNode::File(path.to_path_buf()));
        self.node_by_file.insert(path.to_path_buf(), node_idx);
        node_idx
    }

    pub fn update_file_symbols(
        &mut self,
        file_path: &Path,
        symbols: Vec<SymbolDefinition>,
        imported_modules: Vec<String>,
    ) {
        let file_node = self.get_or_create_file_node(file_path);

        // Remove old symbols for this file
        let mut edges_to_remove = Vec::new();
        for edge in self
            .graph
            .edges_directed(file_node, petgraph::Direction::Outgoing)
        {
            if *edge.weight() == EdgeKind::Defines {
                edges_to_remove.push(edge.target());
            }
        }
        for target in edges_to_remove {
            self.graph.remove_node(target);
        }

        // Add new symbols
        for sym in symbols {
            let sym_name = sym.name.clone();
            let sym_node = self.graph.add_node(GraphNode::Symbol(sym));
            self.graph.add_edge(file_node, sym_node, EdgeKind::Defines);

            self.symbol_index
                .entry(sym_name)
                .or_default()
                .push(sym_node);
        }

        // Connect imports (symbol/file heuristics with exact resolution)
        for import in imported_modules {
            let mut resolved_node = None;
            let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("");

            if ext == "rs" {
                let parts: Vec<&str> = import.trim_start_matches("crate::").split("::").collect();
                let joined = parts.join("/");
                let suffix1 = format!("{}.rs", joined);
                let suffix2 = format!("{}/mod.rs", joined);

                for (known_file, &known_node) in &self.node_by_file {
                    let known_str = known_file.to_string_lossy().replace("\\", "/");
                    if known_str.ends_with(&suffix1) || known_str.ends_with(&suffix2) {
                        resolved_node = Some(known_node);
                        break;
                    }
                }
            } else if (ext == "ts" || ext == "tsx" || ext == "js" || ext == "jsx")
                && import.starts_with('.')
            {
                if let Some(parent) = file_path.parent() {
                        let mut resolved = parent.to_path_buf();
                        for part in import.split('/') {
                            if part == "." {
                                continue;
                            } else if part == ".." {
                                resolved.pop();
                            } else {
                                resolved.push(part);
                            }
                        }
                        let resolved_str = resolved.to_string_lossy().replace("\\", "/");
                        for (known_file, &known_node) in &self.node_by_file {
                            let known_str = known_file.to_string_lossy().replace("\\", "/");
                            if known_str.starts_with(&resolved_str) {
                                let remainder = &known_str[resolved_str.len()..];
                                if remainder == ".ts"
                                    || remainder == ".tsx"
                                    || remainder == ".js"
                                    || remainder == "/index.ts"
                                {
                                    resolved_node = Some(known_node);
                                    break;
                                }
                            }
                        }
                    }
            }

            if let Some(target_node) = resolved_node {
                self.graph
                    .add_edge(file_node, target_node, EdgeKind::Imports);
            } else {
                // Fallback to substring heuristic
                let import_lower = import.to_lowercase();
                for (known_file, &known_node) in &self.node_by_file {
                    let known_file_str = known_file.to_string_lossy().to_lowercase();
                    if import_lower.contains(&known_file_str)
                        || known_file_str.contains(&import_lower)
                    {
                        self.graph
                            .add_edge(file_node, known_node, EdgeKind::Imports);
                    }
                }
            }
        }
    }

    pub fn get_connected_files(&self, file_path: &Path, max_depth: usize) -> Vec<PathBuf> {
        let root = match self.node_by_file.get(file_path) {
            Some(&idx) => idx,
            None => return Vec::new(),
        };

        let mut visited = HashSet::new();
        let mut queue = vec![(root, 0)];
        let mut connected = Vec::new();

        while let Some((curr, depth)) = queue.pop() {
            if !visited.insert(curr) || depth > max_depth {
                continue;
            }

            if let Some(GraphNode::File(p)) = self.graph.node_weight(curr) {
                if p != file_path {
                    connected.push(p.clone());
                }
            }

            for neighbor in self.graph.neighbors(curr) {
                queue.push((neighbor, depth + 1));
            }
        }

        connected
    }

    pub fn find_symbol_definitions(&self, symbol_name: &str) -> Vec<SymbolDefinition> {
        let mut results = Vec::new();
        if let Some(nodes) = self.symbol_index.get(symbol_name) {
            for &idx in nodes {
                if let Some(GraphNode::Symbol(sym)) = self.graph.node_weight(idx) {
                    results.push(sym.clone());
                }
            }
        }
        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ast::SymbolKind;
    use crate::types::LineRange;

    #[test]
    fn test_context_graph_connections() {
        let mut graph = ContextGraph::new();
        let f1 = PathBuf::from("/src/main.rs");
        let f2 = PathBuf::from("/src/types.rs");

        graph.update_file_symbols(
            &f2,
            vec![SymbolDefinition {
                name: "Config".to_string(),
                kind: SymbolKind::Struct,
                file_path: f2.clone(),
                range: LineRange {
                    start_line: 1,
                    end_line: 15,
                },
            }],
            vec![],
        );

        graph.update_file_symbols(
            &f1,
            vec![SymbolDefinition {
                name: "main".to_string(),
                kind: SymbolKind::Function,
                file_path: f1.clone(),
                range: LineRange {
                    start_line: 1,
                    end_line: 10,
                },
            }],
            vec!["types".to_string()],
        );

        let connected = graph.get_connected_files(&f1, 2);
        assert_eq!(connected.len(), 1);
        assert_eq!(connected[0], f2);

        let syms = graph.find_symbol_definitions("Config");
        assert_eq!(syms.len(), 1);
        assert_eq!(syms[0].file_path, f2);
    }
}
