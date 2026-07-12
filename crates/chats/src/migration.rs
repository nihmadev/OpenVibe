use rusqlite::{params, Connection};

pub fn run(conn: &Connection) {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM chats WHERE messages IS NOT NULL AND messages != '[]'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if count == 0 {
        return;
    }
    let mut stmt = conn
        .prepare("SELECT id, messages FROM chats WHERE messages IS NOT NULL AND messages != '[]'")
        .unwrap();
    let rows: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    for (chat_id, json) in &rows {
        let msgs: Vec<serde_json::Value> = serde_json::from_str(json).unwrap_or_default();
        for msg in &msgs {
            conn.execute(
                "INSERT INTO messages (chat_id, role, content, name, tool_call_id, tool_calls, reasoning_content)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    chat_id,
                    msg["role"].as_str().unwrap_or("user"),
                    msg.get("content").map(|c| c.to_string()),
                    msg.get("name").and_then(|v| v.as_str()),
                    msg.get("tool_call_id").and_then(|v| v.as_str()),
                    msg.get("tool_calls").map(|v| v.to_string()),
                    msg.get("reasoning_content").and_then(|v| v.as_str()),
                ],
            )
            .ok();
        }
        conn.execute(
            "UPDATE chats SET messages = '[]' WHERE id = ?",
            params![chat_id],
        )
        .ok();
    }
}
