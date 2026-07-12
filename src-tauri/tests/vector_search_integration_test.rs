use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

fn test_root() -> String {
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let dir = std::env::temp_dir().join("openvibe_vec_int_test").join(format!("int_{ts}"));
    fs::create_dir_all(&dir).unwrap();
    dir.to_string_lossy().to_string()
}

fn make_test_project(root: &str) {
    // ... (оставляем без изменений)
    let p = |rel: &str| Path::new(root).join(rel);

    fs::create_dir_all(p("src")).unwrap();
    fs::create_dir_all(p("src/components")).unwrap();
    fs::create_dir_all(p("src/utils")).unwrap();
    fs::create_dir_all(p("tests")).unwrap();

    fs::write(p("src/main.rs"), "fn main() {\n    println!(\"Hello, world!\");\n}\n").unwrap();
    fs::write(p("src/lib.rs"), "pub mod utils;\npub mod components;\n").unwrap();
    fs::write(p("src/utils/math.rs"), 
        "pub fn add(a: i32, b: i32) -> i32 {\n    a + b\n}\n\npub fn subtract(a: i32, b: i32) -> i32 {\n    a - b\n}\n\npub fn multiply(a: i32, b: i32) -> i32 {\n    a * b\n}\n"
    ).unwrap();
    fs::write(p("src/utils/strings.rs"), 
        "pub fn greet(name: &str) -> String {\n    format!(\"Hello, {name}!\")\n}\n\npub fn uppercase(s: &str) -> String {\n    s.to_uppercase()\n}\n"
    ).unwrap();
    fs::write(p("src/components/button.rs"), 
        "pub struct Button {\n    pub label: String,\n    pub disabled: bool,\n}\n\nimpl Button {\n    pub fn new(label: &str) -> Self {\n        Self { label: label.to_string(), disabled: false }\n    }\n\n    pub fn click(&self) {\n        println!(\"Button '{}' clicked\", self.label);\n    }\n}\n"
    ).unwrap();
    fs::write(p("src/components/form.rs"), 
        "pub struct Form {\n    pub fields: Vec<String>,\n}\n\nimpl Form {\n    pub fn new() -> Self {\n        Self { fields: Vec::new() }\n    }\n\n    pub fn add_field(&mut self, name: &str) {\n        self.fields.push(name.to_string());\n    }\n}\n"
    ).unwrap();
}

#[test]
fn test_model_loading_and_search() -> Result<(), String> {
    println!("\n=== MODEL LOADING TEST ===");
    search::vector_search::ensure_model()?;
    println!("✅ Model loaded successfully (BGESmallENV15)");

    println!("\n=== SEMANTIC SEARCH TEST ===");
    let root = test_root();
    make_test_project(&root);
    println!("📁 Test project created at: {}", root);

    println!("🔨 Building vector index...");
    search::vector_search::build_index(&root)?;
    println!("✅ Index built successfully");

    println!("\n🔍 Searching for: 'adding numbers'");
    let results1 = search::vector_search::search_codebase_vector("adding numbers", &root, 5)?;

    println!("📊 Results for 'adding numbers':");
    for (i, r) in results1.iter().enumerate() {
        println!(
            "  {}. [{:.4}] {}:{} — {}",
            i + 1,
            r.score,
            r.path,
            r.line,
            r.content.lines().next().unwrap_or("").trim()
        );
    }

    println!("\n🔍 Searching for: 'click element'");
    let results2 = search::vector_search::search_codebase_vector("click element", &root, 5)?;

    println!("📊 Results for 'click element':");
    for (i, r) in results2.iter().enumerate() {
        println!(
            "  {}. [{:.4}] {}:{} — {}",
            i + 1,
            r.score,
            r.path,
            r.line,
            r.content.lines().next().unwrap_or("").trim()
        );
    }

    let _ = fs::remove_dir_all(&root);
    Ok(())
}

#[test]
fn test_ensure_model_is_singleton() -> Result<(), String> {
    println!("\n=== MODEL SINGLETON TEST ===");
    search::vector_search::ensure_model()?;
    println!("✅ First ensure_model() call");
    search::vector_search::ensure_model()?;
    println!("✅ Second ensure_model() call (should be instant)");
    Ok(())
}

// Остальные тесты можно оставить или тоже улучшить
