import type React from "react";
import { useI18n } from "@/platform/localization/localizationService";
import type { Attachment } from "../../../common/chat";

interface ImageViewerProps {
  attachment: Attachment;
  onClose: () => void;
}

/** Full-size preview dialog for an attached image. */
export function PromptImageViewer({ attachment, onClose }: ImageViewerProps): React.ReactElement | null {
  const { t } = useI18n();
  if (!attachment.dataUrl) return null;

  return (
    <div
      className="composer__image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={attachment.name}
      onClick={onClose}
    >
      <div className="composer__image-viewer-content" onClick={(e) => e.stopPropagation()}>
        <img src={attachment.dataUrl} alt={attachment.name} />
        <button type="button" className="composer__image-viewer-close" onClick={onClose} aria-label={t("close")}>
          <span aria-hidden="true">&#215;</span>
        </button>
      </div>
    </div>
  );
}
