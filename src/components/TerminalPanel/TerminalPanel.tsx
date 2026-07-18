import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import React, { useEffect, useRef } from "react";
import { useI18n } from "../../hooks/useI18n.js";
import { useTheme } from "../../hooks/useTheme.js";

interface Props {
  id: string;
  visible: boolean;
}

const THEME = {
  background: "#161616",
  foreground: "#e6e6e6",
  cursor: "#e6e6e6",
  cursorAccent: "#161616",
  selectionBackground: "#3a3a3a",
  black: "#161616",
  brightBlack: "#555555",
  white: "#e6e6e6",
  brightWhite: "#ffffff",
  red: "#f87171",
  brightRed: "#f87171",
  green: "#86efac",
  brightGreen: "#86efac",
  yellow: "#fbbf24",
  brightYellow: "#fbbf24",
  blue: "#7dd3fc",
  brightBlue: "#7dd3fc",
  magenta: "#e3e2e2ff",
  brightMagenta: "#e3e2e2ff",
  cyan: "#67e8f9",
  brightCyan: "#67e8f9",
};

export function TerminalPanel({ id, visible }: Props): React.ReactElement {
  const { t } = useI18n();
  const { currentTheme, resolvedScheme, previewTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  const activeTheme = previewTheme ?? currentTheme;
  const activeVars = resolvedScheme === "dark" ? activeTheme.darkVars : activeTheme.lightVars;
  const bg = activeVars["--bg"] || "#161616";
  const fg = activeVars["--fg"] || "#e6e6e6";
  const bgRef = useRef(bg);
  const fgRef = useRef(fg);
  bgRef.current = bg;
  fgRef.current = fg;

  // Mount xterm + start PTY once per pane
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const term = new XTerm({
      fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
      cursorStyle: "block",
      allowProposedApi: true,
      scrollback: 5000,
      theme: { ...THEME, background: bgRef.current, foreground: fgRef.current, cursor: fgRef.current },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    try {
      fit.fit();
    } catch {
      // not laid out yet, will fit when visible
    }
    termRef.current = term;
    fitRef.current = fit;

    const inputDisp = term.onData((data) => {
      window.vibe.term.write(id, data);
    });
    const offData = window.vibe.term.onData((p) => {
      if (p.id === id) term.write(p.chunk);
    });
    const offExit = window.vibe.term.onExit((p) => {
      if (p.id !== id) return;
      term.writeln(`\r\n\x1b[2m${t("shellExited", { code: String(p.code) })}\x1b[0m`);
    });

    window.vibe.term.start(id, term.cols, term.rows);

    const resize = (): void => {
      if (!termRef.current || !fitRef.current) return;
      try {
        fitRef.current.fit();
      } catch {
        // ignore
      }
      window.vibe.term.resize(id, termRef.current.cols, termRef.current.rows);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      ro.disconnect();
      inputDisp.dispose();
      offData();
      offExit();
      window.vibe.term.kill(id);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [id, t]);

  // Update terminal theme whenever app theme colors change
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = { ...THEME, background: bg, foreground: fg, cursor: fg };
    }
  }, [bg, fg]);

  // Refit and focus when becoming visible
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      try {
        fitRef.current?.fit();
        const t = termRef.current;
        if (t) {
          window.vibe.term.resize(id, t.cols, t.rows);
          t.focus();
        }
      } catch {
        // ignore
      }
    }, 0);
    return () => clearTimeout(t);
  }, [visible, id]);

  return (
    <div className="termpane" style={{ display: visible ? "flex" : "none" }}>
      <div className="termpane__xterm" ref={containerRef} />
    </div>
  );
}
