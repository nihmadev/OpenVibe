use std::path::Path;

pub const COLORS: &[&str] = &[
    "#223883ff",
    "#0e5340ff",
    "#7c2d12ff",
    "#361868ff",
    "#155e75ff",
    "#57142fff",
    "#162b63ff",
    "#136428ff",
];

pub fn pick_color(seed: &str, used: &[String]) -> String {
    let mut h: i32 = 0;
    for b in seed.bytes() {
        h = h.wrapping_mul(31).wrapping_add(b as i32);
    }
    let start = h.unsigned_abs() as usize % COLORS.len();
    for i in 0..COLORS.len() {
        let c = COLORS[(start + i) % COLORS.len()];
        if !used.iter().any(|u| u == c) {
            return c.to_string();
        }
    }
    COLORS[start].to_string()
}

pub fn basename(p: &str) -> String {
    Path::new(p)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(p)
        .to_string()
}

pub fn chrono_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
