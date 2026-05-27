import React from "react"

interface ContextItem {
  key: string
  path: string
  comment?: string
  type: "file"
}

interface PromptContextItemsProps {
  items: ContextItem[]
  active?: (item: ContextItem) => boolean
  openComment?: (item: ContextItem) => void
  remove: (key: string) => void
  t: (key: string) => string
}

export function PromptContextItems({ items, active, openComment, remove, t }: PromptContextItemsProps) {
  if (items.length === 0) return null

  const getFilename = (path: string) => path.split(/[\\/]/).pop() ?? path
  const getDirectory = (path: string) => { const i = path.lastIndexOf("/"); const j = path.lastIndexOf("\\"); const idx = Math.max(i, j); return idx >= 0 ? path.slice(0, idx + 1) : "" }

  return (
    <div className="prompt-input__context-items">
      {items.map((item) => {
        const filename = getFilename(item.path)
        const dir = getDirectory(item.path)
        const isActive = active ? active(item) : false

        return (
          <div
            key={item.key}
            className={"prompt-input__context-chip" + (isActive ? " prompt-input__context-chip--active" : "")}
            onClick={() => openComment?.(item)}
          >
            <div className="prompt-input__context-chip-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span className="prompt-input__context-chip-name">{filename}</span>
              <button
                type="button"
                className="prompt-input__context-chip-close"
                onClick={(e) => { e.stopPropagation(); remove(item.key) }}
                aria-label={t("prompt.context.removeFile")}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {item.comment && (
              <div className="prompt-input__context-chip-comment">{item.comment}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
