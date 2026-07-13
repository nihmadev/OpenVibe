use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::path::Path;

const COLORS: &[&str] = &[
    "#223883ff",
    "#0e5340ff",
    "#7c2d12",
    "#361868ff",
    "#155e75",
    "#57142fff",
    "#162b63ff",
    "#136428ff",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub path: String,
    pub name: String,
    pub color: String,
    pub added_at: i64,
    pub icon: Option<String>,
    pub photo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub description: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub added_at: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_icon: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub models_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub headers: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parameters: Option<String>,
}

fn pick_color(seed: &str, used: &[String]) -> String {
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

fn basename(p: &str) -> String {
    let cleaned = p.trim_end_matches(['\\', '/']);
    cleaned
        .split(|c: char| c == '\\' || c == '/')
        .last()
        .unwrap_or(cleaned)
        .to_string()
}

pub struct ProjectStore {
    conn: Connection,
    data_dir: String,
}

impl ProjectStore {
    pub fn new(base_dir: &str) -> SqlResult<Self> {
        std::fs::create_dir_all(base_dir).ok();
        let db_path = Path::new(base_dir).join("projects.db");
        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL")?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS projects (
                id        TEXT PRIMARY KEY,
                path      TEXT NOT NULL UNIQUE,
                name      TEXT NOT NULL,
                color     TEXT NOT NULL,
                added_at  INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS state (
                key   TEXT PRIMARY KEY,
                value TEXT
            );
            CREATE TABLE IF NOT EXISTS providers (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                base_url    TEXT NOT NULL,
                api_key     TEXT NOT NULL,
                model       TEXT NOT NULL,
                added_at    INTEGER NOT NULL,
                custom_icon TEXT DEFAULT NULL,
                models_url  TEXT DEFAULT NULL,
                headers     TEXT DEFAULT NULL,
                parameters  TEXT DEFAULT NULL
            );
            CREATE TABLE IF NOT EXISTS disabled_models (
                model_id TEXT PRIMARY KEY
            );
            CREATE TABLE IF NOT EXISTS enabled_models (
                model_id TEXT PRIMARY KEY
            );",
        )?;

        conn.execute_batch("ALTER TABLE projects ADD COLUMN icon TEXT DEFAULT NULL")
            .ok();
        conn.execute_batch("ALTER TABLE projects ADD COLUMN photo TEXT DEFAULT NULL")
            .ok();

        conn.execute_batch("ALTER TABLE providers ADD COLUMN custom_icon TEXT DEFAULT NULL")
            .ok();
        conn.execute_batch("ALTER TABLE providers ADD COLUMN models_url TEXT DEFAULT NULL")
            .ok();
        conn.execute_batch("ALTER TABLE providers ADD COLUMN headers TEXT DEFAULT NULL")
            .ok();
        conn.execute_batch("ALTER TABLE providers ADD COLUMN parameters TEXT DEFAULT NULL")
            .ok();

        Ok(Self {
            conn,
            data_dir: base_dir.to_string(),
        })
    }

    pub fn list(&self) -> Vec<Project> {
        let mut stmt = self.conn
            .prepare("SELECT id, path, name, color, added_at, icon, photo FROM projects ORDER BY added_at ASC")
            .unwrap();
        let rows = stmt
            .query_map([], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    name: row.get(2)?,
                    color: row.get(3)?,
                    added_at: row.get(4)?,
                    icon: row.get(5)?,
                    photo: row.get(6)?,
                })
            })
            .unwrap();
        rows.filter_map(|r| r.ok()).collect()
    }

    fn get_by_id(&self, id: &str) -> Option<Project> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, path, name, color, added_at, icon, photo FROM projects WHERE id = ?",
            )
            .unwrap();
        stmt.query_row(params![id], |row| {
            Ok(Project {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                color: row.get(3)?,
                added_at: row.get(4)?,
                icon: row.get(5)?,
                photo: row.get(6)?,
            })
        })
        .ok()
    }

    pub fn get_active(&self) -> Option<Project> {
        let active_id: Option<String> = self
            .conn
            .query_row(
                "SELECT value FROM state WHERE key = 'activeId'",
                [],
                |row| row.get(0),
            )
            .ok();
        match active_id {
            Some(id) => self.get_by_id(&id),
            None => None,
        }
    }

    pub fn ensure(&mut self, path: &str) -> Project {
        let existing: Option<Project> = self
            .conn
            .prepare(
                "SELECT id, path, name, color, added_at, icon, photo FROM projects WHERE path = ?",
            )
            .unwrap()
            .query_row(params![path], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    name: row.get(2)?,
                    color: row.get(3)?,
                    added_at: row.get(4)?,
                    icon: row.get(5)?,
                    photo: row.get(6)?,
                })
            })
            .ok();
        if let Some(p) = existing {
            return p;
        }
        let used: Vec<String> = self.list().iter().map(|p| p.color.clone()).collect();
        let id = format!("p{:x}-{}", chrono_now(), rand_suffix());
        let project = Project {
            id: id.clone(),
            path: path.to_string(),
            name: basename(path),
            color: pick_color(path, &used),
            icon: None,
            photo: None,
            added_at: chrono_now(),
        };
        self.conn
            .execute(
                "INSERT INTO projects (id, path, name, color, added_at, icon, photo) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![project.id, project.path, project.name, project.color, project.added_at, project.icon, project.photo],
            )
            .unwrap();
        project
    }

    pub fn add(&mut self, path: &str) -> Project {
        let project = self.ensure(path);
        self.conn
            .execute(
                "INSERT OR REPLACE INTO state (key, value) VALUES ('activeId', ?1)",
                params![project.id],
            )
            .unwrap();
        project
    }

    pub fn remove(&mut self, id: &str) -> Option<Project> {
        let all = self.list();
        let idx = all.iter().position(|p| p.id == id)?;
        self.conn
            .execute("DELETE FROM projects WHERE id = ?", params![id])
            .unwrap();

        let active_id: Option<String> = self
            .conn
            .query_row(
                "SELECT value FROM state WHERE key = 'activeId'",
                [],
                |row| row.get(0),
            )
            .ok();
        let next_active = if active_id.as_deref() == Some(id) {
            let remaining: Vec<&Project> = all.iter().filter(|p| p.id != id).collect();
            let next = remaining
                .get(idx)
                .or_else(|| remaining.get(idx.wrapping_sub(1)))
                .or_else(|| remaining.first());
            match next {
                Some(p) => {
                    self.conn
                        .execute(
                            "INSERT OR REPLACE INTO state (key, value) VALUES ('activeId', ?1)",
                            params![p.id],
                        )
                        .unwrap();
                    Some((*p).clone())
                }
                None => {
                    self.conn
                        .execute(
                            "INSERT OR REPLACE INTO state (key, value) VALUES ('activeId', NULL)",
                            params![],
                        )
                        .unwrap();
                    None
                }
            }
        } else {
            self.get_active()
        };
        next_active
    }

    pub fn rename(&self, id: &str, name: &str) {
        self.conn
            .execute(
                "UPDATE projects SET name = ? WHERE id = ?",
                params![name, id],
            )
            .unwrap();
    }

    pub fn set_color(&self, id: &str, color: &str) {
        self.conn
            .execute(
                "UPDATE projects SET color = ? WHERE id = ?",
                params![color, id],
            )
            .unwrap();
    }

    pub fn set_icon(&self, id: &str, icon: Option<&str>) {
        match icon {
            Some(val) => {
                self.conn
                    .execute(
                        "UPDATE projects SET icon = ? WHERE id = ?",
                        params![val, id],
                    )
                    .unwrap();
            }
            None => {
                self.conn
                    .execute("UPDATE projects SET icon = NULL WHERE id = ?", params![id])
                    .unwrap();
            }
        }
    }

    pub fn set_photo(&self, id: &str, photo: Option<&str>) {
        match photo {
            Some(val) => {
                self.conn
                    .execute(
                        "UPDATE projects SET photo = ? WHERE id = ?",
                        params![val, id],
                    )
                    .unwrap();
            }
            None => {
                self.conn
                    .execute("UPDATE projects SET photo = NULL WHERE id = ?", params![id])
                    .unwrap();
            }
        }
    }

    pub fn set_active(&self, id: &str) -> Option<Project> {
        let p = self.get_by_id(id)?;
        self.conn
            .execute(
                "INSERT OR REPLACE INTO state (key, value) VALUES ('activeId', ?1)",
                params![id],
            )
            .unwrap();
        Some(p)
    }

    pub fn clear_active(&self) {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO state (key, value) VALUES ('activeId', NULL)",
                params![],
            )
            .unwrap();
    }

    pub fn get_state(&self, key: &str) -> Option<String> {
        self.conn
            .query_row(
                "SELECT value FROM state WHERE key = ?",
                params![key],
                |row| row.get(0),
            )
            .ok()
    }

    pub fn set_state(&self, key: &str, value: &str) {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO state (key, value) VALUES (?1, ?2)",
                params![key, value],
            )
            .unwrap();
    }

    pub fn list_providers(&self) -> Vec<Provider> {
        let mut stmt = self.conn
            .prepare("SELECT id, name, description, base_url, api_key, model, added_at, custom_icon, models_url, headers, parameters FROM providers ORDER BY added_at ASC")
            .unwrap();
        let rows = stmt
            .query_map([], |row| {
                Ok(Provider {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    base_url: row.get(3)?,
                    api_key: row.get(4)?,
                    model: row.get(5)?,
                    added_at: row.get(6)?,
                    custom_icon: row.get(7)?,
                    models_url: row.get(8)?,
                    headers: row.get(9)?,
                    parameters: row.get(10)?,
                })
            })
            .unwrap();
        rows.filter_map(|r| r.ok()).collect()
    }

    pub fn save_provider(&self, p: &Provider) {
        self.conn
            .execute(
                "INSERT INTO providers (id, name, description, base_url, api_key, model, added_at, custom_icon, models_url, headers, parameters)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                 ON CONFLICT(id) DO UPDATE SET
                   name = excluded.name, description = excluded.description,
                   base_url = excluded.base_url, api_key = excluded.api_key,
                   model = excluded.model,
                   custom_icon = excluded.custom_icon, models_url = excluded.models_url,
                   headers = excluded.headers, parameters = excluded.parameters",
                params![
                    p.id,
                    p.name,
                    p.description,
                    p.base_url,
                    p.api_key,
                    p.model,
                    p.added_at,
                    p.custom_icon,
                    p.models_url,
                    p.headers,
                    p.parameters,
                ],
            )
            .unwrap();
    }

    pub fn delete_provider(&self, id: &str) {
        self.conn
            .execute("DELETE FROM providers WHERE id = ?", params![id])
            .unwrap();
    }

    pub fn update_provider_model(&self, id: &str, model: &str) {
        self.conn
            .execute(
                "UPDATE providers SET model = ? WHERE id = ?",
                params![model, id],
            )
            .unwrap();
    }

    pub fn list_disabled_models(&self) -> Vec<String> {
        let mut stmt = self
            .conn
            .prepare("SELECT model_id FROM disabled_models")
            .unwrap();
        let rows = stmt.query_map([], |row| row.get::<_, String>(0)).unwrap();
        rows.filter_map(|r| r.ok()).collect()
    }

    pub fn toggle_disabled_model(&self, model_id: &str) -> bool {
        let exists: bool = self
            .conn
            .query_row(
                "SELECT 1 FROM disabled_models WHERE model_id = ?",
                params![model_id],
                |_| Ok(true),
            )
            .unwrap_or(false);
        if exists {
            self.conn
                .execute(
                    "DELETE FROM disabled_models WHERE model_id = ?",
                    params![model_id],
                )
                .unwrap();
            false
        } else {
            self.conn
                .execute(
                    "INSERT INTO disabled_models (model_id) VALUES (?)",
                    params![model_id],
                )
                .unwrap();
            true
        }
    }

    pub fn list_enabled_models(&self) -> Vec<String> {
        let mut stmt = self
            .conn
            .prepare("SELECT model_id FROM enabled_models")
            .unwrap();
        let rows = stmt.query_map([], |row| row.get::<_, String>(0)).unwrap();
        rows.filter_map(|r| r.ok()).collect()
    }

    pub fn toggle_enabled_model(&self, model_id: &str) -> bool {
        let exists: bool = self
            .conn
            .query_row(
                "SELECT 1 FROM enabled_models WHERE model_id = ?",
                params![model_id],
                |_| Ok(true),
            )
            .unwrap_or(false);
        if exists {
            self.conn
                .execute(
                    "DELETE FROM enabled_models WHERE model_id = ?",
                    params![model_id],
                )
                .unwrap();
            false
        } else {
            self.conn
                .execute(
                    "INSERT INTO enabled_models (model_id) VALUES (?)",
                    params![model_id],
                )
                .unwrap();
            true
        }
    }

    pub fn chats_db(&self, project_id: &str) -> String {
        let dir = std::path::Path::new(&self.data_dir)
            .join("projects")
            .join(project_id);
        std::fs::create_dir_all(&dir).ok();
        dir.join("chats.db").to_string_lossy().to_string()
    }
}

fn chrono_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn rand_suffix() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    format!("{:05x}", nanos % 0xFFFFF)
}
