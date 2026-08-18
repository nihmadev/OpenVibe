export interface TerminalDataEvent {
  id: string;
  chunk: string;
}

export interface TerminalExitEvent {
  id: string;
  code: number;
}
