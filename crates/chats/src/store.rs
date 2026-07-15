use crate::migration;
use crate::types::*;
use rusqlite::{params, Connection, OptionalExtension, Result as SqlResult};

pub struct ChatStore {
    conn: Connection,
}

impl ChatStore {
    pub fn new(db_path: &str) -> SqlResult<Self> {
        let mut conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL")?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS chats (
                id         TEXT PRIMARY KEY,
                title      TEXT NOT NULL DEFAULT 'New chat',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
        )?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS messages (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id           TEXT NOT NULL,
                role              TEXT NOT NULL,
                content           TEXT,
                name              TEXT,
                tool_call_id      TEXT,
                tool_calls        TEXT,
                reasoning_content TEXT,
                created_at        INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
            )",
        )?;
        conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)")?;

        migration::run(&mut conn)?;

        Ok(Self { conn })
    }

    pub fn list(&self) -> SqlResult<Vec<ChatSummary>> {
        let mut stmt = self.conn.prepare(
            "SELECT c.id, c.title, c.created_at, c.updated_at, COUNT(m.id)
                 FROM chats c
                 LEFT JOIN messages m ON c.id = m.chat_id
                 GROUP BY c.id
                 ORDER BY c.created_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ChatSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                message_count: row.get(4)?,
            })
        })?;
        rows.collect()
    }

    pub fn get(&self, id: &str) -> SqlResult<Option<ChatRecord>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, title, created_at, updated_at FROM chats WHERE id = ?")?;

        let record_opt = stmt
            .query_row(params![id], |row| {
                Ok(ChatRecord {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                    messages: Vec::new(),
                })
            })
            .optional()?;

        let mut record = match record_opt {
            Some(r) => r,
            None => return Ok(None),
        };

        let mut msg_stmt = self.conn.prepare(
            "SELECT role, content, name, tool_call_id, tool_calls, reasoning_content
                 FROM messages WHERE chat_id = ? ORDER BY id ASC",
        )?;

        let msgs: Vec<agent::chat::ChatMessage> = msg_stmt
            .query_map(params![id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                ))
            })?
            .filter_map(|r| r.ok())
            .map(
                |(role, content_json, name, tool_call_id, tool_calls_json, reasoning)| {
                    let content = content_json.and_then(|s| {
                        Some(
                            serde_json::from_str(&s)
                                .unwrap_or_else(|_| serde_json::Value::String(s)),
                        )
                    });
                    let tool_calls = tool_calls_json.and_then(|s| serde_json::from_str(&s).ok());
                    agent::chat::ChatMessage {
                        role,
                        content,
                        name,
                        tool_call_id,
                        tool_calls,
                        reasoning_content: reasoning,
                    }
                },
            )
            .collect();

        record.messages = msgs;
        Ok(Some(record))
    }

    pub fn save(&mut self, record: &ChatRecord) -> SqlResult<()> {
        let tx = self.conn.transaction()?;

        tx.execute(
            "INSERT INTO chats (id, title, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET
               title = excluded.title, updated_at = excluded.updated_at",
            params![
                record.id,
                record.title,
                record.created_at,
                record.updated_at
            ],
        )?;

        tx.execute("DELETE FROM messages WHERE chat_id = ?", params![record.id])?;

        {
            let mut stmt = tx.prepare(
                "INSERT INTO messages (chat_id, role, content, name, tool_call_id, tool_calls, reasoning_content)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
            )?;

            for msg in &record.messages {
                let content_str = msg.content.as_ref().map(|c| {
                    if c.is_string() {
                        c.as_str().unwrap().to_string()
                    } else {
                        c.to_string()
                    }
                });
                stmt.execute(params![
                    record.id,
                    msg.role,
                    content_str,
                    msg.name,
                    msg.tool_call_id,
                    msg.tool_calls
                        .as_ref()
                        .map(|tc| serde_json::to_string(tc).unwrap_or_default()),
                    msg.reasoning_content,
                ])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    pub fn delete(&self, id: &str) -> SqlResult<()> {
        self.conn
            .execute("DELETE FROM messages WHERE chat_id = ?", params![id])?;
        self.conn
            .execute("DELETE FROM chats WHERE id = ?", params![id])?;
        Ok(())
    }

    pub fn close(self) -> SqlResult<()> {
        self.conn.close().map_err(|(_conn, e)| e)
    }
}
