//! Provider-neutral SSE frame decoding.

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub(super) struct SseEvent {
    pub event: Option<String>,
    pub data: String,
    pub id: Option<String>,
    pub retry: Option<u64>,
}

#[derive(Default)]
pub(super) struct SseParser {
    buffer: Vec<u8>,
    event: SseEvent,
    data_lines: Vec<String>,
    has_fields: bool,
    consumed: usize,
}

impl SseParser {
    pub fn push(&mut self, bytes: &[u8]) -> Result<Vec<SseEvent>, String> {
        self.buffer.extend_from_slice(bytes);
        self.parse_lines(false)
    }

    pub fn finish(&mut self) -> Result<Vec<SseEvent>, String> {
        let mut events = self.parse_lines(true)?;
        if self.has_fields {
            events.push(self.take_event());
        }
        Ok(events)
    }

    fn parse_lines(&mut self, eof: bool) -> Result<Vec<SseEvent>, String> {
        let mut events = Vec::new();
        while let Some(newline) = self.buffer.iter().position(|byte| *byte == b'\n') {
            let mut line = self.buffer.drain(..=newline).collect::<Vec<_>>();
            line.pop();
            if line.last() == Some(&b'\r') {
                line.pop();
            }
            self.process_line(&line, &mut events)?;
            self.consumed += newline + 1;
        }
        if eof && !self.buffer.is_empty() {
            let mut line = std::mem::take(&mut self.buffer);
            if line.last() == Some(&b'\r') {
                line.pop();
            }
            self.process_line(&line, &mut events)?;
            self.consumed += line.len();
        }
        Ok(events)
    }

    fn process_line(&mut self, bytes: &[u8], events: &mut Vec<SseEvent>) -> Result<(), String> {
        let line = std::str::from_utf8(bytes).map_err(|error| {
            let position = self.consumed + error.valid_up_to();
            let end = (error.valid_up_to() + 8).min(bytes.len());
            format!(
                "Invalid UTF-8 in SSE stream at byte {position}: bytes {:02x?}",
                &bytes[error.valid_up_to()..end]
            )
        })?;

        if line.is_empty() {
            if self.has_fields {
                events.push(self.take_event());
            }
            return Ok(());
        }
        if line.starts_with(':') {
            return Ok(());
        }

        let (field, mut value) = line.split_once(':').unwrap_or((line, ""));
        if let Some(stripped) = value.strip_prefix(' ') {
            value = stripped;
        }
        match field {
            "data" => {
                self.data_lines.push(value.to_string());
                self.has_fields = true;
            }
            "event" => {
                self.event.event = Some(value.to_string());
                self.has_fields = true;
            }
            "id" if !value.contains('\0') => {
                self.event.id = Some(value.to_string());
                self.has_fields = true;
            }
            "retry" => {
                if let Ok(retry) = value.parse() {
                    self.event.retry = Some(retry);
                    self.has_fields = true;
                }
            }
            _ => {}
        }
        Ok(())
    }

    fn take_event(&mut self) -> SseEvent {
        self.event.data = self.data_lines.join("\n");
        self.data_lines.clear();
        self.has_fields = false;
        std::mem::take(&mut self.event)
    }
}
