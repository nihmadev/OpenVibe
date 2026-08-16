use super::accumulator::Callbacks;

#[derive(Default)]
pub(super) struct ReasoningParser {
    in_tag: bool,
    active: bool,
    pending: String,
}

impl ReasoningParser {
    pub fn process(
        &mut self,
        text: &str,
        api_reasoning: bool,
        content: &mut String,
        reasoning: &mut Option<String>,
        reasoning_name: &mut Option<String>,
        callbacks: &Callbacks<'_>,
    ) {
        if !api_reasoning && self.active && !self.in_tag {
            self.active = false;
            (callbacks.on_reasoning_end)();
        }
        if api_reasoning {
            self.active = true;
        }

        let mut input = std::mem::take(&mut self.pending);
        input.push_str(text);
        let mut rest = input.as_str();
        while !rest.is_empty() {
            // Native reasoning channels may still follow OpenVibe's named
            // thought protocol. Extract the transport tag instead of leaking
            // it into the stored reasoning text.
            if api_reasoning && !self.in_tag {
                if let Some((position, length)) = find_tag(rest, false) {
                    let tag = &rest[position..position + length];
                    if let Some(name) = extract_name(tag) {
                        push_reasoning(&rest[..position], reasoning, callbacks);
                        *reasoning_name = Some(name.to_string());
                        (callbacks.on_reasoning_name)(name);
                        self.in_tag = true;
                        rest = &rest[position + length..];
                        continue;
                    }
                }
                if let Some(position) = partial_tag_start(rest, false) {
                    push_reasoning(&rest[..position], reasoning, callbacks);
                    self.pending.push_str(&rest[position..]);
                    break;
                }
            }
            if self.in_tag || api_reasoning {
                if let Some((position, length)) = find_tag(rest, true) {
                    push_reasoning(&rest[..position], reasoning, callbacks);
                    self.in_tag = false;
                    self.active = false;
                    (callbacks.on_reasoning_end)();
                    rest = &rest[position + length..];
                } else if let Some(position) = partial_tag_start(rest, true) {
                    push_reasoning(&rest[..position], reasoning, callbacks);
                    self.pending.push_str(&rest[position..]);
                    break;
                } else {
                    push_reasoning(rest, reasoning, callbacks);
                    break;
                }
            } else if let Some((position, length)) = find_allowed_open_tag(rest, content) {
                push_content(&rest[..position], content, callbacks);
                let tag = &rest[position..position + length];
                if let Some(name) = extract_name(tag) {
                    *reasoning_name = Some(name.to_string());
                    (callbacks.on_reasoning_name)(name);
                }
                self.in_tag = true;
                self.active = true;
                rest = &rest[position + length..];
            } else if let Some(position) = partial_allowed_open(rest, content) {
                push_content(&rest[..position], content, callbacks);
                self.pending.push_str(&rest[position..]);
                break;
            } else {
                push_content(rest, content, callbacks);
                break;
            }
        }
    }

    pub fn finish(
        &mut self,
        content: &mut String,
        reasoning: &mut Option<String>,
        callbacks: &Callbacks<'_>,
    ) {
        if !self.pending.is_empty() {
            if self.in_tag || self.active {
                push_reasoning(&self.pending, reasoning, callbacks);
            } else {
                push_content(&self.pending, content, callbacks);
            }
            self.pending.clear();
        }
        if self.in_tag || self.active {
            (callbacks.on_reasoning_end)();
        }
    }
}

fn push_content(text: &str, output: &mut String, callbacks: &Callbacks<'_>) {
    if !text.is_empty() {
        output.push_str(text);
        (callbacks.on_delta)(text);
    }
}

fn push_reasoning(text: &str, output: &mut Option<String>, callbacks: &Callbacks<'_>) {
    if !text.is_empty() {
        output.get_or_insert_with(String::new).push_str(text);
        (callbacks.on_reasoning)(text);
    }
}

fn find_allowed_open_tag(text: &str, content: &str) -> Option<(usize, usize)> {
    let mut offset = 0;
    while let Some((position, length)) = find_tag(&text[offset..], false) {
        let position = offset + position;
        let before = &text[..position];
        let tag = &text[position..position + length];
        let at_start = content.trim().is_empty() && before.trim().is_empty();
        let line_prefix = before.rsplit('\n').next().unwrap_or("");
        let visible_named = extract_name(tag).is_some()
            && line_prefix.len() <= 3
            && line_prefix
                .chars()
                .all(|ch| matches!(ch, ' ' | '\t' | '\r'));
        if at_start || visible_named {
            return Some((position, length));
        }
        offset = position + length;
    }
    None
}

fn partial_allowed_open(text: &str, content: &str) -> Option<usize> {
    let position = partial_tag_start(text, false)?;
    let before = &text[..position];
    let line_prefix = before.rsplit('\n').next().unwrap_or("");
    ((content.trim().is_empty() && before.trim().is_empty()) || line_prefix.trim().is_empty())
        .then_some(position)
}

fn find_tag(text: &str, closing: bool) -> Option<(usize, usize)> {
    text.match_indices('<').find_map(|(position, _)| {
        if let TagMatch::Complete(length) = classify_tag(&text[position..], closing) {
            Some((position, length))
        } else {
            None
        }
    })
}

fn partial_tag_start(text: &str, closing: bool) -> Option<usize> {
    let position = text.rfind('<')?;
    matches!(classify_tag(&text[position..], closing), TagMatch::Partial).then_some(position)
}

enum TagMatch {
    Complete(usize),
    Partial,
    Invalid,
}

fn classify_tag(candidate: &str, closing: bool) -> TagMatch {
    let lower = candidate.to_ascii_lowercase();
    let prefixes: &[&str] = if closing {
        &["</think", "</thought"]
    } else {
        &["<think", "<thought"]
    };
    for prefix in prefixes {
        if prefix.starts_with(&lower) {
            return TagMatch::Partial;
        }
        if lower.starts_with(prefix) {
            let suffix = &candidate[prefix.len()..];
            let Some(first) = suffix.chars().next() else {
                return TagMatch::Partial;
            };
            if first != '>' && !first.is_ascii_whitespace() {
                continue;
            }
            if let Some(end) = suffix.find('>') {
                if closing && !suffix[..end].trim().is_empty() {
                    return TagMatch::Invalid;
                }
                return TagMatch::Complete(prefix.len() + end + 1);
            }
            return TagMatch::Partial;
        }
    }
    TagMatch::Invalid
}

fn extract_name(tag: &str) -> Option<&str> {
    let inner = tag.strip_suffix('>')?;
    let name_at = inner
        .match_indices(|ch: char| ch.eq_ignore_ascii_case(&'n'))
        .map(|(index, _)| index)
        .find(|index| {
            inner[*index..].len() >= 4
                && inner[*index..*index + 4].eq_ignore_ascii_case("name")
                && (*index == 0
                    || inner[..*index]
                        .chars()
                        .next_back()
                        .is_some_and(char::is_whitespace))
        })?;
    let after = inner[name_at + 4..]
        .trim_start()
        .strip_prefix('=')?
        .trim_start();
    let quote = after.chars().next()?;
    if quote == '\'' || quote == '"' {
        let value = &after[quote.len_utf8()..];
        let end = value.find(quote)?;
        (!value[..end].trim().is_empty()).then_some(value[..end].trim())
    } else {
        let end = after.find(char::is_whitespace).unwrap_or(after.len());
        (!after[..end].is_empty()).then_some(&after[..end])
    }
}
