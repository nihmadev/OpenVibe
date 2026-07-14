use serde::{Deserialize, Serialize};

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

impl<'a> TryFrom<&rusqlite::Row<'a>> for Project {
    type Error = rusqlite::Error;

    fn try_from(row: &rusqlite::Row<'a>) -> std::result::Result<Self, Self::Error> {
        Ok(Project {
            id: row.get(0)?,
            path: row.get(1)?,
            name: row.get(2)?,
            color: row.get(3)?,
            added_at: row.get(4)?,
            icon: row.get(5)?,
            photo: row.get(6)?,
        })
    }
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

impl<'a> TryFrom<&rusqlite::Row<'a>> for Provider {
    type Error = rusqlite::Error;

    fn try_from(row: &rusqlite::Row<'a>) -> std::result::Result<Self, Self::Error> {
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
    }
}
