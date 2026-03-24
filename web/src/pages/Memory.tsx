import { useState, useEffect, useCallback } from 'react'
import { Globe, Save, Pencil, X } from 'lucide-react'
import { getGlobalMemory, updateGlobalMemory } from '../api/client'
import { useI18n } from '../i18n'
import { useDragRegion } from "@/hooks/useDragRegion"

export function Memory() {
  const { t } = useI18n()
  const drag = useDragRegion()
  const [memoryContent, setMemoryContent] = useState('')
  const [editContent, setEditContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const loadMemory = useCallback(() => {
    getGlobalMemory()
      .then((res) => {
        setMemoryContent(res.content)
        setEditContent(res.content)
      })
      .catch(() => {
        setMemoryContent('')
        setEditContent('')
      })
  }, [])

  useEffect(() => {
    loadMemory()
  }, [loadMemory])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateGlobalMemory(editContent)
      setMemoryContent(editContent)
      setIsEditing(false)
    } catch {
      // Silently ignore
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="h-9 shrink-0 flex items-center justify-between px-3 border-b border-[var(--subtle-border)]" {...drag}>
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">{t.memory.title}</h2>
        </div>
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setEditContent(memoryContent)
                  setIsEditing(false)
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-accent-foreground transition-all duration-200 ease-[var(--ease-soft)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                data-testid="memory-save-btn"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-accent-foreground transition-all duration-200 ease-[var(--ease-soft)] disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button
              data-testid="memory-edit-btn"
              onClick={() => {
                setEditContent(memoryContent)
                setIsEditing(true)
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-accent-foreground transition-all duration-200 ease-[var(--ease-soft)]"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-[var(--subtle-border)] bg-muted/20">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span>{t.memory.globalFile}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t.memory.globalHint}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isEditing ? (
          <textarea
            data-testid="memory-textarea"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-full bg-transparent text-sm font-mono resize-none focus:outline-none text-foreground placeholder:text-muted-foreground"
            placeholder={t.memory.writePlaceholder}
          />
        ) : (
          <div className="text-sm whitespace-pre-wrap font-mono text-foreground/80">
            {memoryContent || (
              <span className="text-muted-foreground italic">
                {t.memory.noContent}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
