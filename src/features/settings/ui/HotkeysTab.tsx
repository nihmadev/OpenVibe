import type { Dispatch, SetStateAction } from "react";
import type { ShortcutCategory, ShortcutDef } from "@/features/shortcuts/application/useShortcuts";
import { useI18n } from "@/shared/i18n/useI18n";
import { ControlRow } from "@/shared/ui/kit";

const CATEGORY_ORDER: ShortcutCategory[] = [
  "navigation",
  "search",
  "chat",
  "workspace",
  "terminal",
  "project",
  "editor",
];

interface Props {
  shortcuts?: ShortcutDef[];
  recordingId: string | null;
  setRecordingId: Dispatch<SetStateAction<string | null>>;
  errorMsg: string | null;
  setErrorMsg: Dispatch<SetStateAction<string | null>>;
  onResetBinding?: (id: string) => Promise<void>;
}

export function HotkeysTab({ shortcuts, recordingId, setRecordingId, errorMsg, setErrorMsg, onResetBinding }: Props) {
  const { t } = useI18n();
  const grouped: Partial<Record<ShortcutCategory, ShortcutDef[]>> = {};
  for (const shortcut of shortcuts ?? [])
    grouped[shortcut.category] = [...(grouped[shortcut.category] ?? []), shortcut];
  return (
    <div className="settings__section">
      {!shortcuts || shortcuts.length === 0 ? (
        <div className="settings__models-empty">
          <p>{t("noHotkeys")}</p>
        </div>
      ) : (
        <div className="settings__hotkeys-list">
          {CATEGORY_ORDER.map((category) => {
            const items = grouped[category];
            if (!items?.length) return null;
            return (
              <div key={category} className="settings__hotkeys-section">
                <div className="settings__hotkeys-section-header">{t(category)}</div>
                {items.map((shortcut) => {
                  const isRecording = recordingId === shortcut.id;
                  return (
                    <ControlRow key={shortcut.id} label={shortcut.label}>
                      <button
                        className={`settings__hotkey-btn${isRecording ? " settings__hotkey-btn--recording" : ""}`}
                        onClick={() => {
                          if (isRecording) return;
                          setRecordingId(shortcut.id);
                          setErrorMsg(null);
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          onResetBinding?.(shortcut.id);
                        }}
                      >
                        {isRecording ? "..." : shortcut.keys}
                      </button>
                    </ControlRow>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      {errorMsg && <div className="settings__hotkeys-error">{errorMsg}</div>}
    </div>
  );
}
