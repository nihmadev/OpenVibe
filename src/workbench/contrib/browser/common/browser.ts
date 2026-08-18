export interface BrowserTab {
  targetId: string;
  title: string;
  url: string;
  active: boolean;
}

export interface BrowserViewport {
  width: number;
  height: number;
  deviceScaleFactor?: number;
}

export type BrowserEvent =
  | { type: "browser:session-started"; sessionId: string }
  | { type: "browser:page-changed"; url?: string; title?: string; targetId?: string; tabs?: BrowserTab[] }
  | { type: "browser:loading"; loading: boolean; url?: string }
  | { type: "browser:snapshot"; image?: string; url?: string; title?: string; viewport?: BrowserViewport }
  | { type: "browser:pointer-move"; x: number; y: number; durationMs: number; target?: string; ref?: string }
  | { type: "browser:pointer-down"; x: number; y: number }
  | { type: "browser:pointer-up"; x: number; y: number }
  | { type: "browser:action-started"; action: string; target?: string; url?: string; ref?: string }
  | { type: "browser:action-completed"; action: string; target?: string; url?: string; durationMs?: number }
  | { type: "browser:manual-control"; manual: boolean; sessionId?: string }
  | { type: "browser:error"; message: string }
  | { type: "browser:session-closed"; sessionId?: string };

export interface BrowserViewProps {
  active: boolean;
}
