use super::ProjectStore;
use crate::{
    error::Result,
    models::Project,
    utils::{basename, chrono_now, pick_color},
};
use rusqlite::params;
use uuid::Uuid;

impl ProjectStore {
    pub fn list(&self) -> Result<Vec<Project>> {
        let mut stmt = self.conn
            .prepare("SELECT id, path, name, color, added_at, icon, photo FROM projects ORDER BY added_at ASC")?;

        let rows = stmt.query_map([], |row| Project::try_from(row))?;

        let mut projects = Vec::new();
        for r in rows {
            projects.push(r?);
        }
        Ok(projects)
    }

    fn get_by_id(&self, id: &str) -> Result<Option<Project>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, name, color, added_at, icon, photo FROM projects WHERE id = ?",
        )?;
        match stmt.query_row(params![id], |row| Project::try_from(row)) {
            Ok(p) => Ok(Some(p)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn get_active(&self) -> Result<Option<Project>> {
        let active_id: Option<String> = match self.conn.query_row(
            "SELECT value FROM state WHERE key = 'activeId'",
            [],
            |row| row.get(0),
        ) {
            Ok(id) => Some(id),
            Err(rusqlite::Error::QueryReturnedNoRows) => None,
            Err(e) => return Err(e.into()),
        };

        match active_id {
            Some(id) => self.get_by_id(&id),
            None => Ok(None),
        }
    }

    pub fn ensure(&mut self, path: &str) -> Result<Project> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, name, color, added_at, icon, photo FROM projects WHERE path = ?",
        )?;

        match stmt.query_row(params![path], |row| Project::try_from(row)) {
            Ok(p) => return Ok(p),
            Err(rusqlite::Error::QueryReturnedNoRows) => {}
            Err(e) => return Err(e.into()),
        }

        let mut stmt = self.conn.prepare("SELECT color FROM projects")?;
        let used: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        let id = Uuid::new_v4().to_string();
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
            )?;

        Ok(project)
    }

    pub fn add(&mut self, path: &str) -> Result<Project> {
        let project = self.ensure(path)?;
        self.conn.execute(
            "INSERT OR REPLACE INTO state (key, value) VALUES ('activeId', ?1)",
            params![project.id],
        )?;
        Ok(project)
    }

    pub fn remove(&mut self, id: &str) -> Result<Option<Project>> {
        let all = self.list()?;
        let idx = all.iter().position(|p| p.id == id);
        if idx.is_none() {
            return Ok(None);
        }
        let idx = idx.unwrap();

        self.conn
            .execute("DELETE FROM projects WHERE id = ?", params![id])?;

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
                    self.conn.execute(
                        "INSERT OR REPLACE INTO state (key, value) VALUES ('activeId', ?1)",
                        params![p.id],
                    )?;
                    Some((*p).clone())
                }
                None => {
                    self.conn.execute(
                        "INSERT OR REPLACE INTO state (key, value) VALUES ('activeId', NULL)",
                        params![],
                    )?;
                    None
                }
            }
        } else {
            self.get_active()?
        };
        Ok(next_active)
    }

    pub fn rename(&self, id: &str, name: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE projects SET name = ? WHERE id = ?",
            params![name, id],
        )?;
        Ok(())
    }

    pub fn set_color(&self, id: &str, color: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE projects SET color = ? WHERE id = ?",
            params![color, id],
        )?;
        Ok(())
    }

    pub fn set_icon(&self, id: &str, icon: Option<&str>) -> Result<()> {
        match icon {
            Some(val) => {
                self.conn.execute(
                    "UPDATE projects SET icon = ? WHERE id = ?",
                    params![val, id],
                )?;
            }
            None => {
                self.conn
                    .execute("UPDATE projects SET icon = NULL WHERE id = ?", params![id])?;
            }
        }
        Ok(())
    }

    pub fn set_photo(&self, id: &str, photo: Option<&str>) -> Result<()> {
        match photo {
            Some(val) => {
                self.conn.execute(
                    "UPDATE projects SET photo = ? WHERE id = ?",
                    params![val, id],
                )?;
            }
            None => {
                self.conn
                    .execute("UPDATE projects SET photo = NULL WHERE id = ?", params![id])?;
            }
        }
        Ok(())
    }

    pub fn set_active(&self, id: &str) -> Result<Option<Project>> {
        let p = match self.get_by_id(id)? {
            Some(proj) => proj,
            None => return Ok(None),
        };
        self.conn.execute(
            "INSERT OR REPLACE INTO state (key, value) VALUES ('activeId', ?1)",
            params![id],
        )?;
        Ok(Some(p))
    }

    pub fn clear_active(&self) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO state (key, value) VALUES ('activeId', NULL)",
            params![],
        )?;
        Ok(())
    }
}
