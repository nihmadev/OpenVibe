import { useEffect, useState } from "react";
import { getLanguage } from "@/base/browser/ui/icons/iconResolver";
import { useI18n } from "@/platform/localization/localizationService";
import { gitScmService } from "@/workbench/services/scm/tauri/gitScmService";
import { DiffEditor } from "../diffEditor/diffEditor";
import "./editorArea.css";

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
          origRef = `${hash}~1`; // parent commit
          modRef = hash;
        } else {
          throw new Error("Invalid git-diff URI type");
        }

        const [origRes, modRes] = await Promise.all([
          gitScmService.fileContent(cwd, filePath, origRef),
          gitScmService.fileContent(cwd, filePath, modRef),
        ]);

        if (cancelled) return;

        // Only show an error if the "modified" side also failed to load
        // the original side can legitimately be absent for new files (not yet in HEAD/INDEX).
        // For "working" and "staged" types: if modified (WORKING/INDEX) fails it's a real problem.
        // For "commit" type: if orig fails it could be the first commit (no parent) that's fine.
        if (!modRes.ok && !origRes.ok) {
          // Both sides failed — the file path or ref is invalid
          const reason = modRes.error || origRes.error || "";
          setError((t("failedToLoadDiff") || "Failed to load diff") + (reason ? `: ${reason}` : ""));
          return;
        }

        // If only the "modified" side failed (e.g. deleted file), show empty modified
        // If only the "original" side failed (e.g. new file), show empty original — that's correct
        setOriginal(origRes.ok ? origRes.data : "");
        setModified(modRes.ok ? modRes.data : "");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
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
      <div className="editor-area__empty-hint" style={{ color: "var(--red)" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <DiffEditor original={original} modified={modified} language={lang} fill />
    </div>
  );
}
