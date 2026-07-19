use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TodoArgs {
    tasks: Vec<TodoTask>,
    #[serde(default)]
    checkpoint: Option<TodoCheckpoint>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TodoTask {
    #[serde(default)]
    id: Option<String>,
    title: String,
    status: TodoStatus,
    #[serde(default)]
    priority: Option<String>,
    #[serde(default)]
    order: Option<u32>,
    #[serde(default)]
    depends_on: Vec<String>,
    #[serde(default)]
    acceptance_criteria: Vec<String>,
    #[serde(default)]
    next_action: Option<String>,
    #[serde(default)]
    blocker: Option<String>,
    #[serde(default)]
    evidence: Vec<String>,
    #[serde(default)]
    owner: Option<String>,
    #[serde(default)]
    user_locked: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TodoCheckpoint {
    #[serde(default)]
    goal: Option<String>,
    #[serde(default)]
    summary: Option<String>,
    #[serde(default)]
    next_action: Option<String>,
    #[serde(default)]
    blockers: Vec<String>,
    #[serde(default)]
    constraints: Vec<String>,
    #[serde(default)]
    changed_files: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
enum TodoStatus {
    Pending,
    InProgress,
    Completed,
    Blocked,
    WaitingUser,
    Skipped,
}

pub async fn tool_todo(args: &serde_json::Value) -> Result<String, String> {
    let todo: TodoArgs = serde_json::from_value(args.clone())
        .map_err(|error| format!("Invalid todo arguments: {error}"))?;

    if todo.tasks.iter().any(|task| task.title.trim().is_empty()) {
        return Err("Todo task titles cannot be empty".to_string());
    }

    let mut ids = std::collections::HashSet::new();
    for task in &todo.tasks {
        if let Some(id) = &task.id {
            if !ids.insert(id) {
                return Err(format!("Duplicate todo task id: {id}"));
            }
        }
        if let Some(priority) = &task.priority {
            if !matches!(priority.as_str(), "critical" | "high" | "normal" | "low") {
                return Err(format!("Invalid todo priority: {priority}"));
            }
        }
        let _ = (
            task.order,
            &task.depends_on,
            &task.acceptance_criteria,
            &task.next_action,
            &task.evidence,
            &task.owner,
            task.user_locked,
        );
        if matches!(task.status, TodoStatus::Blocked)
            && task.blocker.as_deref().unwrap_or("").trim().is_empty()
        {
            return Err(format!(
                "Blocked task '{}' must include blocker",
                task.title
            ));
        }
    }

    let completed = todo
        .tasks
        .iter()
        .filter(|task| matches!(task.status, TodoStatus::Completed))
        .count();
    let checkpoint_hint = todo.checkpoint.as_ref().and_then(|checkpoint| {
        let _ = (
            &checkpoint.goal,
            &checkpoint.summary,
            &checkpoint.blockers,
            &checkpoint.constraints,
            &checkpoint.changed_files,
        );
        checkpoint.next_action.as_deref()
    });
    Ok(match checkpoint_hint {
        Some(next) if !next.trim().is_empty() => format!(
            "Todo updated: {completed}/{} tasks completed; next: {next}",
            todo.tasks.len()
        ),
        _ => format!(
            "Todo updated: {completed}/{} tasks completed",
            todo.tasks.len()
        ),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn accepts_a_valid_plan() {
        let result = tool_todo(&serde_json::json!({
            "tasks": [
                { "title": "Inspect", "status": "completed" },
                { "title": "Implement", "status": "in_progress" },
                { "title": "Verify", "status": "pending" }
            ]
        }))
        .await;

        assert_eq!(result.unwrap(), "Todo updated: 1/3 tasks completed");
    }

    #[tokio::test]
    async fn accepts_multiple_parallel_tasks() {
        let result = tool_todo(&serde_json::json!({
            "tasks": [
                { "title": "One", "status": "in_progress" },
                { "title": "Two", "status": "in_progress" }
            ]
        }))
        .await;

        assert_eq!(result.unwrap(), "Todo updated: 0/2 tasks completed");
    }

    #[tokio::test]
    async fn rejects_empty_titles() {
        let result = tool_todo(&serde_json::json!({
            "tasks": [{ "title": "  ", "status": "pending" }]
        }))
        .await;

        assert_eq!(result.unwrap_err(), "Todo task titles cannot be empty");
    }
}
