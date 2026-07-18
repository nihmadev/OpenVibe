import React, { useEffect, useState } from "react";
import { DiffEditor } from "../DiffEditor/DiffEditor.js";
import { vibe } from "../../tauri-bridge.js";
import { getLanguage } from "../Icons/utils.js";
import { useI18n } from "../../hooks/useI18n.js";
import "./EditorArea.css";

interface GitDiffViewerProps {
  path: string; // The virtual path, e.g. "git-diff:?type=working&path=/absolute/path"
  cwd: string;
}

export function GitDiffViewer({ path, cwd }: GitDiffViewerProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [original, setOriginal] = useState("");
  const [modified, setModified] = useState("");
  const [lang, setLang] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDiff() {
      setLoading(true);
      setError(null);

      try {
        const url = new URL(path);
        const type = url.searchParams.get("type");
        const filePath = url.searchParams.get("path") || "";
        const hash = url.searchParams.get("hash") || "";

        setLang(getLanguage(filePath));

        let origRef = "";
        let modRef = "";

        if (type === "working") {
          origRef = "HEAD";
          modRef = "WORKING";
        } else if (type === "staged") {
          origRef = "HEAD";
          modRef = "INDEX";
        } else if (type === "commit") {
          origRef = hash + "~1"; // parent commit
          modRef = hash;
        } else {
          throw new Error("Invalid git-diff URI type");
        }

        const [origRes, modRes] = await Promise.all([
          vibe.git.fileContent(cwd, filePath, origRef).catch((e) => ({ ok: false, error: String(e) })),
          vibe.git.fileContent(cwd, filePath, modRef).catch((e) => ({ ok: false, error: String(e) })),
        ]);

        if (cancelled) return;

        // Only show an error if the "modified" side also failed to load
        // the original side can legitimately be absent for new files (not yet in HEAD/INDEX).
        // For "working" and "staged" types: if modified (WORKING/INDEX) fails it's a real problem.
        // For "commit" type: if orig fails it could be the first commit (no parent) that's fine.
        const modFailed = !modRes?.ok;
        const origFailed = !origRes?.ok;

        if (modFailed && origFailed) {
          // Both sides failed — the file path or ref is invalid
          const reason = (modRes as any)?.error || (origRes as any)?.error || "";
          setError((t("failedToLoadDiff") || "Failed to load diff") + (reason ? `: ${reason}` : ""));
          return;
        }

        // If only the "modified" side failed (e.g. deleted file), show empty modified
        // If only the "original" side failed (e.g. new file), show empty original — that's correct
        setOriginal(origFailed ? "" : origRes.data);
        setModified(modFailed ? "" : modRes.data);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDiff();

    return () => {
      cancelled = true;
    };
  }, [path, cwd, t]);

  if (loading) {
    return <div className="editor-area__empty-hint">{t("loadingDiff") || "Loading diff..."}</div>;
  }

  if (error) {
    return (
      <div className="editor-area__empty-hint" style={{ color: "var(--vscode-errorForeground)" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <DiffEditor original={original} modified={modified} language={lang} />
    </div>
  );
}
