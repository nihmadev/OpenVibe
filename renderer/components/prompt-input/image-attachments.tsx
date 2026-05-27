import React from "react"
import type { Attachment } from "./types.js"

interface PromptImageAttachmentsProps {
  attachments: Attachment[]
  onOpen: (attachment: Attachment) => void
  onRemove: (id: string) => void
  removeLabel: string
}

export function PromptImageAttachments({ attachments, onOpen, onRemove, removeLabel }: PromptImageAttachmentsProps) {
  if (attachments.length === 0) return null

  return (
    <div className="prompt-input__image-attachments">
      {attachments.map((att) => (
        <div key={att.id} className="prompt-input__image-attachment">
          {att.dataUrl ? (
            <img
              src={att.dataUrl}
              alt={att.name}
              className="prompt-input__image-thumb"
              onClick={() => onOpen(att)}
            />
          ) : (
            <div className="prompt-input__image-fallback">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}
          <button
            type="button"
            className="prompt-input__image-remove"
            onClick={() => onRemove(att.id)}
            aria-label={removeLabel}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="prompt-input__image-name">
            <span>{att.name}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
