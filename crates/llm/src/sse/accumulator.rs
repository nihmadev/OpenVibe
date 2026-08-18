use std::collections::BTreeMap;

use super::reasoning::ReasoningParser;
use agent_api::{AssistantTurn, TokenUsage, ToolCall, ToolCallFunction};

pub(super) struct Callbacks<'a> {
    pub on_delta: &'a (dyn Fn(&str) + Send + Sync),
    pub on_reasoning: &'a (dyn Fn(&str) + Send + Sync),
    pub on_reasoning_name: &'a (dyn Fn(&str) + Send + Sync),
    pub on_reasoning_end: &'a (dyn Fn() + Send + Sync),
    pub on_tool_args: &'a (dyn Fn(&str, &str) + Send + Sync),
}

#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub(super) enum ToolKey {
    OpenAi(usize),
    Legacy,
    Anthropic(usize),
}

#[derive(Default)]
struct ToolCallAcc {
    id: String,
    type_: String,
    name: String,
    arguments: String,
    extra_fields: serde_json::Map<String, serde_json::Value>,
    func_extra_fields: serde_json::Map<String, serde_json::Value>,
}

pub(super) struct Accumulator<'a> {
    content: String,
    reasoning_content: Option<String>,
    reasoning_name: Option<String>,
    reasoning: ReasoningParser,
    tools: BTreeMap<ToolKey, ToolCallAcc>,
    usage: Option<TokenUsage>,
    finish_reason: Option<String>,
    callbacks: Callbacks<'a>,
}

impl<'a> Accumulator<'a> {
    pub fn new(callbacks: Callbacks<'a>) -> Self {
        Self {
            content: String::new(),
            reasoning_content: None,
            reasoning_name: None,
            reasoning: ReasoningParser::default(),
            tools: BTreeMap::new(),
            usage: None,
            finish_reason: None,
            callbacks,
        }
    }

    pub fn text(&mut self, text: &str, reasoning: bool) {
        self.reasoning.process(
            text,
            reasoning,
            &mut self.content,
            &mut self.reasoning_content,
            &mut self.reasoning_name,
            &self.callbacks,
        );
    }

    pub fn set_usage(&mut self, usage: TokenUsage) {
        self.usage = Some(usage);
    }

    pub fn merge_usage(&mut self, usage: TokenUsage) {
        let current = self.usage.get_or_insert_with(TokenUsage::default);
        if usage.prompt_tokens > 0 {
            current.prompt_tokens = usage.prompt_tokens;
        }
        if usage.completion_tokens > 0 {
            current.completion_tokens = usage.completion_tokens;
        }
        current.total_tokens = current.prompt_tokens + current.completion_tokens;
        if usage.cache_creation_input_tokens.is_some() {
            current.cache_creation_input_tokens = usage.cache_creation_input_tokens;
        }
        if usage.cache_read_input_tokens.is_some() {
            current.cache_read_input_tokens = usage.cache_read_input_tokens;
        }
    }

    pub fn set_finish_reason(&mut self, reason: &str) {
        if !reason.is_empty() {
            self.finish_reason = Some(reason.to_string());
        }
    }

    pub fn start_tool(
        &mut self,
        key: ToolKey,
        id: Option<&str>,
        name: Option<&str>,
        type_: Option<&str>,
    ) {
        let entry = self
            .tools
            .entry(key.clone())
            .or_insert_with(|| ToolCallAcc {
                id: default_tool_id(&key),
                type_: "function".to_string(),
                ..ToolCallAcc::default()
            });
        if let Some(id) = id {
            entry.id = id.to_string();
        }
        if let Some(name) = name {
            entry.name.push_str(name);
        }
        if let Some(type_) = type_ {
            entry.type_ = type_.to_string();
        }
    }

    pub fn tool_arguments(&mut self, key: &ToolKey, delta: &str) -> Result<(), String> {
        let entry = self
            .tools
            .get_mut(key)
            .ok_or_else(|| format!("Received arguments for unknown tool call {key:?}"))?;
        entry.arguments.push_str(delta);
        (self.callbacks.on_tool_args)(&entry.id, delta);
        Ok(())
    }

    pub fn tool_name(&mut self, key: &ToolKey, delta: &str) -> Result<(), String> {
        let entry = self
            .tools
            .get_mut(key)
            .ok_or_else(|| format!("Received name for unknown tool call {key:?}"))?;
        entry.name.push_str(delta);
        Ok(())
    }

    pub fn tool_extra(
        &mut self,
        key: &ToolKey,
        fields: serde_json::Map<String, serde_json::Value>,
        function_fields: serde_json::Map<String, serde_json::Value>,
    ) -> Result<(), String> {
        let entry = self
            .tools
            .get_mut(key)
            .ok_or_else(|| format!("Received fields for unknown tool call {key:?}"))?;
        entry.extra_fields.extend(fields);
        entry.func_extra_fields.extend(function_fields);
        Ok(())
    }

    pub fn finish(mut self) -> Result<AssistantTurn, String> {
        self.reasoning.finish(
            &mut self.content,
            &mut self.reasoning_content,
            &self.callbacks,
        );
        let tool_calls = self
            .tools
            .into_values()
            .map(|tool| ToolCall {
                id: tool.id,
                type_: tool.type_,
                function: ToolCallFunction {
                    name: tool.name,
                    arguments: tool.arguments,
                    extra_fields: tool.func_extra_fields,
                },
                extra_fields: tool.extra_fields,
            })
            .collect();
        Ok(AssistantTurn {
            content: self.content,
            tool_calls,
            reasoning_content: self.reasoning_content,
            reasoning_name: self.reasoning_name,
            usage: self.usage,
            finish_reason: self.finish_reason,
        })
    }
}

fn default_tool_id(key: &ToolKey) -> String {
    match key {
        ToolKey::OpenAi(index) => format!("call_{index}"),
        ToolKey::Legacy => "call_0".to_string(),
        ToolKey::Anthropic(index) => format!("call_{index}"),
    }
}
