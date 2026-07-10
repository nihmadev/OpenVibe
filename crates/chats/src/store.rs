use rusqlite::{params, Connection, Result as SqlResult};
use crate::types::*;
use crate::migration;

pub struct ChatStore {
    conn: Connection,
}

impl ChatStore {
    pub fn new(db_path: &str) -> SqlResult<Self> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL")?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS chats (
                id         TEXT PRIMARY KEY,
                title      TEXT NOT NULL DEFAULT 'New chat',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                messages   TEXT NOT NULL DEFAULT '[]'
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
        conn.execute_batch(
            "CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)",
        )?;
        let store = Self { conn };
        migration::run(&store.conn);
        Ok(store)
    }

    pub fn list(&self) -> Vec<ChatSummary> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT c.id, c.title, c.created_at, c.updated_at,
                        COALESCE((SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id), 0)
                 FROM chats c ORDER BY c.updated_at DESC",
            )
            .unwrap();
        let rows = stmt
            .query_map([], |row| {
                Ok(ChatSummary {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                    message_count: row.get(4)?,
                })
            })
            .unwrap();
        rows.filter_map(|r| r.ok()).collect()
    }

    pub fn get(&self, id: &str) -> Option<ChatRecord> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, title, created_at, updated_at FROM chats WHERE id = ?")
            .unwrap();
        let mut record = stmt
            .query_row(params![id], |row| {
                Ok(ChatRecord {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                    messages: Vec::new(),
                })
            })
            .ok()?;

        let mut msg_stmt = self
            .conn
            .prepare(
                "SELECT role, content, name, tool_call_id, tool_calls, reasoning_content
                 FROM messages WHERE chat_id = ? ORDER BY id ASC",
            )
            .unwrap();
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
            })
            .unwrap()
            .filter_map(|r| r.ok())
            .map(
                |(role, content_json, name, tool_call_id, tool_calls_json, reasoning)| {
                    let content = content_json.and_then(|s| serde_json::from_str(&s).ok());
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
        Some(record)
    }

    pub fn save(&self, record: &ChatRecord) {
        self.conn
            .execute(
                "INSERT INTO chats (id, title, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(id) DO UPDATE SET
                   title = excluded.title, updated_at = excluded.updated_at",
                params![record.id, record.title, record.created_at, record.updated_at],
            )
            .unwrap();

        self.conn
            .execute(
                "DELETE FROM messages WHERE chat_id = ?",
                params![record.id],
            )
            .unwrap();

        for msg in &record.messages {
            self.conn
                .execute(
                    "INSERT INTO messages (chat_id, role, content, name, tool_call_id, tool_calls, reasoning_content)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        record.id,
                        msg.role,
                        msg.content.as_ref().map(|c| c.to_string()),
                        msg.name,
                        msg.tool_call_id,
                        msg.tool_calls
                            .as_ref()
                            .map(|tc| serde_json::to_string(tc).unwrap_or_default()),
                        msg.reasoning_content,
                    ],
                )
                .unwrap();
        }
    }

    pub fn delete(&self, id: &str) {
        self.conn
            .execute("DELETE FROM messages WHERE chat_id = ?", params![id])
            .unwrap();
        self.conn
            .execute("DELETE FROM chats WHERE id = ?", params![id])
            .unwrap();
    }

    pub fn close(self) {
        self.conn.close().ok();
    }
}