use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubTraceEvent {
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ok: Option<bool>,
}

fn sub_traces() -> &'static Mutex<HashMap<String, Vec<SubTraceEvent>>> {
    static TRACES: OnceLock<Mutex<HashMap<String, Vec<SubTraceEvent>>>> = OnceLock::new();
    TRACES.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn store_sub_event(call_id: &str, event: SubTraceEvent) {
    if let Ok(mut traces) = sub_traces().lock() {
        traces.entry(call_id.to_string()).or_default().push(event);
    }
}

pub fn get_sub_trace(call_id: &str) -> Vec<SubTraceEvent> {
    if let Ok(traces) = sub_traces().lock() {
        traces.get(call_id).cloned().unwrap_or_default()
    } else {
        vec![]
    }
}
