use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use agent_api::SubTraceEvent;

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
    sub_traces()
        .lock()
        .map(|traces| traces.get(call_id).cloned().unwrap_or_default())
        .unwrap_or_default()
}
