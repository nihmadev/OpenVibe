export interface AgentSendResult {
  ok: boolean;
  error?: string;
}

/** Raw sub-agent trace event payload as emitted by `agent_get_sub_trace`. */
export interface SubAgentTraceEvent {
  kind: "chunk" | "tool-call" | "tool-result";
  id?: string;
  text?: string;
  name?: string;
  args?: unknown;
  ok?: boolean;
}

export interface AgentContextUsage {
  usedTokens: number;
  maxTokens: number;
  percent: number;
}
