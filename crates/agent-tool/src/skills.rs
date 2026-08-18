use crate::executor::AgentToolExecutor;

const BROWSER_SKILL: &str = include_str!("../skills/browser-control/SKILL.md");

pub fn list_skills() -> String {
    serde_json::json!({
        "skills": [{
            "name": "browser-control",
            "description": "Safely control the isolated OpenVibe Chromium session using DOM snapshots and real browser actions."
        }]
    })
    .to_string()
}

pub fn read_skill(
    args: &serde_json::Value,
    executor: &AgentToolExecutor,
) -> Result<String, String> {
    let name = args
        .get("name")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    if name != "browser-control" {
        return Err(format!("Unknown skill: {name}"));
    }
    if let Some(browser) = executor.browser_manager() {
        browser.mark_skill_read();
    }
    Ok(BROWSER_SKILL.to_string())
}

pub fn read_skill_resource(args: &serde_json::Value) -> Result<String, String> {
    let name = args
        .get("name")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    let resource = args
        .get("resource")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    if name != "browser-control" {
        return Err(format!("Unknown skill: {name}"));
    }
    Err(format!(
        "Skill browser-control has no resource named '{resource}'"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_only_exposes_skill_metadata() {
        let value: serde_json::Value = serde_json::from_str(&list_skills()).unwrap();
        assert_eq!(value["skills"][0]["name"], "browser-control");
        assert!(!list_skills().contains("CAPTCHA"));
        assert!(BROWSER_SKILL.contains("snapshot"));
    }
}
