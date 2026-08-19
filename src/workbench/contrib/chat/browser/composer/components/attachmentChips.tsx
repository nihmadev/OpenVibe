import { FileIcon } from "@/base/browser/ui/icons/fileIcons";
import { Tooltip } from "@/base/browser/ui/tooltip/tooltip";
import type { Attachment } from "../../../common/chat";

interface AttachmentChipsProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

export function AttachmentChips({ attachments, onRemove }: AttachmentChipsProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="composer__chips">
      {attachments.map((a) => (
        <Tooltip key={a.id} text={a.path ?? a.name}>
          <div className={`chip ${a.kind === "image" ? "chip--image" : ""}`}>
            {a.kind === "image" ? (
              <img className="chip__img" src={a.dataUrl} alt="" />
            ) : (
              <span className="chip__icon">
                <FileIcon name={a.name} />
              </span>
            )}
            <span className="chip__name">{a.name}</span>
            <button className="chip__close" onClick={() => onRemove(a.id)} aria-label="Remove">
              ×
            </button>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
