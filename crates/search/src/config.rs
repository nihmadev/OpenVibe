pub const SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "out",
    ".cache",
    ".turbo",
    "coverage",
    ".vite",
    "target",
    ".vscode",
];

pub const MAX_FILE_BYTES: u64 = 256 * 1024;
pub const MAX_OUTPUT_CHARS: usize = 16_000;

pub fn should_skip(name: &str) -> bool {
    SKIP_DIRS.contains(&name) || name == ".DS_Store"
}
