use super::ProjectStore;
use crate::error::Result;
use rusqlite::params;

impl ProjectStore {
    pub fn list_disabled_models(&self) -> Result<Vec<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT model_id FROM disabled_models")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut models = Vec::new();
        for r in rows {
            models.push(r?);
        }
        Ok(models)
    }

    pub fn toggle_disabled_model(&self, model_id: &str) -> Result<bool> {
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
                )?;
            Ok(false)
        } else {
            self.conn
                .execute(
                    "INSERT INTO disabled_models (model_id) VALUES (?)",
                    params![model_id],
                )?;
            Ok(true)
        }
    }

    pub fn list_enabled_models(&self) -> Result<Vec<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT model_id FROM enabled_models")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut models = Vec::new();
        for r in rows {
            models.push(r?);
        }
        Ok(models)
    }

    pub fn toggle_enabled_model(&self, model_id: &str) -> Result<bool> {
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
                )?;
            Ok(false)
        } else {
            self.conn
                .execute(
                    "INSERT INTO enabled_models (model_id) VALUES (?)",
                    params![model_id],
                )?;
            Ok(true)
        }
    }
}
