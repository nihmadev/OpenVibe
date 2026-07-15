use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use crate::agent::Agent;
use crate::chat::ChatMessage;
use crate::config::{AgentConfig, LlmConfig};
use crate::request::stream_chat;

impl Agent {
    pub async fn summarize_with(
        config: AgentConfig,
        messages: Vec<ChatMessage>,
        client: &reqwest::Client,
    ) -> String {
        if messages.len() < 2 {
            return "New chat".to_string();
        }

        let context_messages: Vec<ChatMessage> = if messages.len() > 10 {
            let mut msgs = vec![messages[0].clone()];
            let start = messages.len().saturating_sub(5);
            msgs.extend_from_slice(&messages[start..]);
            msgs
        } else {
            messages.clone()
        };

        let mut prompt = context_messages;
        prompt.push(ChatMessage {
            role: "user".to_string(),
            content: Some(serde_json::Value::String(
                "Provide a very short (max 3-5 words) descriptive title for this conversation. \
                 Respond ONLY with the title text. No quotes, no intro like 'Title:', \
                 no punctuation at the end."
                    .to_string(),
            )),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
        });

        let cancel = Arc::new(AtomicBool::new(false));
        let title = Arc::new(Mutex::new(String::new()));

        let llm_config = LlmConfig {
            api_key: config.api_key.clone(),
            base_url: config.base_url.clone(),
            model: config.model.clone(),
            api_url: config.api_url.clone(),
            provider_id: config.provider_id.clone(),
        };

        let title_capture = title.clone();
        let result = stream_chat(
            &llm_config,
            prompt,
            vec![],
            &cancel,
            client,
            &|chunk: &str| {
                if let Ok(mut t) = title_capture.lock() {
                    t.push_str(chunk);
                }
            },
            &|_| {},
            &|| {},
            &|_, _| {},
        )
        .await;

        match result {
            Ok(turn) => {
                let mut t = turn.content.trim().to_string();
                let prefixes = [
                    "Title:",
                    "Topic:",
                    "Summary:",
                    "Название:",
                    "Тема:",
                    "Заголовок:",
                    "title:",
                    "topic:",
                    "summary:",
                ];
                for prefix in &prefixes {
                    if let Some(rest) = t.strip_prefix(prefix) {
                        t = rest.trim().to_string();
                        break;
                    }
                }
                if (t.starts_with('"') && t.ends_with('"'))
                    || (t.starts_with('\'') && t.ends_with('\''))
                {
                    t = t[1..t.len().saturating_sub(1)].to_string();
                }
                while t.ends_with('.') || t.ends_with('!') || t.ends_with('?') {
                    t.truncate(t.len().saturating_sub(1));
                }
                let t = t.trim().to_string();
                if !t.is_empty() && t.chars().count() <= 100 {
                    return t;
                }
                Self::fallback_title(&messages)
            }
            Err(_) => Self::fallback_title(&messages),
        }
    }

    fn fallback_title(messages: &[ChatMessage]) -> String {
        for msg in messages {
            if msg.role == "user" {
                if let Some(ref content) = msg.content {
                    let text = match content {
                        serde_json::Value::String(s) => s.clone(),
                        serde_json::Value::Array(arr) => arr
                            .iter()
                            .filter_map(|p| p.get("text").and_then(|v| v.as_str()))
                            .collect::<Vec<_>>()
                            .join(" "),
                        _ => String::new(),
                    };
                    let line = text.lines().next().unwrap_or("").trim();
                    if !line.is_empty() {
                        let mut res: String = line.chars().take(30).collect();
                        if line.chars().count() > 30 {
                            res.push('…');
                        }
                        return res;
                    }
                }
            }
        }
        "New chat".to_string()
    }

    pub async fn summarize(&self, client: &reqwest::Client) -> String {
        Self::summarize_with(self.config().clone(), self.messages.clone(), client).await
    }
}
