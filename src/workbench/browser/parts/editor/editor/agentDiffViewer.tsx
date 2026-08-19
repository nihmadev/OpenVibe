import { Button } from "@zazaru/ui";
import { useEffect, useState } from "react";
import { CheckIcon, CloseIcon } from "@/base/browser/ui/icons/iconRegistry";
import { getLanguage } from "@/base/browser/ui/icons/iconResolver";
import { Loader } from "@/base/browser/ui/loader/loader";
import { useI18n } from "@/platform/localization/localizationService";
import type { AgentFileChange } from "@/workbench/services/agent/common/agentFileChanges";
import { DiffEditor } from "../diffEditor/diffEditor";
import "./agentDiffViewer.css";
import { agentService } from "@/workbench/services/agent/tauri/agentService";

export function AgentDiffViewer({ path }: { path: string }) {
  const { t } = useI18n();
  const [change, setChange] = useState<AgentFileChange | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let toolCallId = "";
  try {
    const url = new URL(path);
    toolCallId = url.searchParams.get("toolCallId") || "";
  } catch {
    /* handled by the load error */
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    agentService
      .getFileChange(toolCallId)
      .then((result) => {
        if (!cancelled) setChange(result);
      })
      .catch((reason) => {
        if (!cancelled) setError(String(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toolCallId]);

  const decide = async (decision: "accept" | "reject") => {
    setSaving(true);
    setError(null);
    try {
      const result =
        decision === "accept"
          ? await agentService.acceptFileChange(toolCallId)
          : await agentService.rejectFileChange(toolCallId);
      setChange(result);
      if (decision === "reject") {
        window.dispatchEvent(new CustomEvent("vibe:agent-file-changed", { detail: result.path }));
      }
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="editor-area__empty-hint">
        <Loader />
      </div>
    );
  if (!change) return <div className="agent-diff__error">{error || "File change unavailable"}</div>;

  return (
    <div className="agent-diff">
      {error && <div className="agent-diff__error agent-diff__error--bar">{error}</div>}
      <div className="agent-diff__editor">
        <DiffEditor
          original={change.beforeContent ?? ""}
          modified={change.afterContent ?? ""}
          language={getLanguage(change.path)}
          fill
        />
      </div>
      {change.status === "pending" && (
        <div className="agent-diff__actions">
          <Button
            className="agent-diff__accept"
            disabled={saving}
            onClick={() => void decide("accept")}
            icon={<CheckIcon />}
          >
            {t("inlineAccept")}
          </Button>
          <Button
            className="agent-diff__reject"
            disabled={saving}
            onClick={() => void decide("reject")}
            icon={<CloseIcon />}
          >
            {t("inlineReject")}
          </Button>
        </div>
      )}
    </div>
  );
}
