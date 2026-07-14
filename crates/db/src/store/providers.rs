use super::ProjectStore;
use crate::{error::Result, models::Provider};
use rusqlite::params;

impl ProjectStore {
    pub fn list_providers(&self) -> Result<Vec<Provider>> {
        let mut stmt = self.conn
            .prepare("SELECT id, name, description, base_url, api_key, model, added_at, custom_icon, models_url, headers, parameters FROM providers ORDER BY added_at ASC")?;
        
        let rows = stmt.query_map([], |row| Provider::try_from(row))?;
        
        let mut providers = Vec::new();
        for r in rows {
            providers.push(r?);
        }
        Ok(providers)
    }

    pub fn save_provider(&self, p: &Provider) -> Result<()> {
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
            )?;
        Ok(())
    }

    pub fn delete_provider(&self, id: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM providers WHERE id = ?", params![id])?;
        Ok(())
    }

    pub fn update_provider_model(&self, id: &str, model: &str) -> Result<()> {
        self.conn
            .execute(
                "UPDATE providers SET model = ? WHERE id = ?",
                params![model, id],
            )?;
        Ok(())
    }
}
