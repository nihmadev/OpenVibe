pub mod models;
pub mod projects;
pub mod providers;

use crate::error::Result;
use rusqlite::Connection;
use std::path::Path;

pub struct ProjectStore {
    pub(crate) conn: Connection,
    pub(crate) data_dir: String,
}

impl ProjectStore {
    pub fn new(base_dir: &str) -> Result<Self> {
        std::fs::create_dir_all(base_dir)?;
        let db_path = Path::new(base_dir).join("projects.db");
        let mut conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL")?;

        Self::run_migrations(&mut conn)?;

        Ok(Self {
            conn,
            data_dir: base_dir.to_string(),
        })
    }

    fn run_migrations(conn: &mut Connection) -> Result<()> {
        let user_version: i32 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;

        if user_version < 1 {
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
                    added_at    INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS disabled_models (
                    model_id TEXT PRIMARY KEY
                );
                CREATE TABLE IF NOT EXISTS enabled_models (
                    model_id TEXT PRIMARY KEY
                );",
            )?;
            conn.execute_batch("PRAGMA user_version = 1")?;
        }

        if user_version < 2 {
            // We ignore errors here in case columns were already added partially before proper migrations
            let _ = conn.execute_batch("ALTER TABLE projects ADD COLUMN icon TEXT DEFAULT NULL");
            let _ = conn.execute_batch("ALTER TABLE projects ADD COLUMN photo TEXT DEFAULT NULL");
            let _ = conn
                .execute_batch("ALTER TABLE providers ADD COLUMN custom_icon TEXT DEFAULT NULL");
            let _ =
                conn.execute_batch("ALTER TABLE providers ADD COLUMN models_url TEXT DEFAULT NULL");
            let _ =
                conn.execute_batch("ALTER TABLE providers ADD COLUMN headers TEXT DEFAULT NULL");
            let _ =
                conn.execute_batch("ALTER TABLE providers ADD COLUMN parameters TEXT DEFAULT NULL");
            conn.execute_batch("PRAGMA user_version = 2")?;
        }

        Ok(())
    }

    pub fn get_state(&self, key: &str) -> Result<Option<String>> {
        match self.conn.query_row(
            "SELECT value FROM state WHERE key = ?",
            rusqlite::params![key],
            |row| row.get(0),
        ) {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn set_state(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO state (key, value) VALUES (?1, ?2)",
            rusqlite::params![key, value],
        )?;
        Ok(())
    }

    pub fn chats_db(&self, project_id: &str) -> String {
        let dir = std::path::Path::new(&self.data_dir)
            .join("projects")
            .join(project_id);
        std::fs::create_dir_all(&dir).ok();
        dir.join("chats.db").to_string_lossy().to_string()
    }
}
