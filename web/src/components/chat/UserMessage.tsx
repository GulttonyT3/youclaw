import { User, FileIcon, FileTextIcon } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Message as AIMessage, MessageContent } from '@/components/ai-elements/message'
import { useI18n } from '@/i18n'
import type { Message } from '@/hooks/useChat'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentImage({ data, mediaType, filename }: { data: string; mediaType: string; filename: string }) {
  return (
    <button
      type="button"
      className="rounded-lg overflow-hidden border border-border hover:opacity-90 transition-opacity cursor-pointer"
      onClick={() => {
        const w = window.open()
        if (w) {
          w.document.write(`<img src="data:${mediaType};base64,${data}" alt="${filename}" style="max-width:100%">`)
          w.document.title = filename
        }
      }}
    >
      <img
        src={`data:${mediaType};base64,${data}`}
        alt={filename}
        className="max-w-[200px] max-h-[200px] object-cover"
      />
    </button>
  )
}

function AttachmentFile({ filename, mediaType, size }: { filename: string; mediaType: string; size: number }) {
  const Icon = mediaType.startsWith('text/') ? FileTextIcon : FileIcon
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 bg-muted/50 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate max-w-[160px]">{filename}</span>
      <span className="text-muted-foreground text-xs shrink-0">{formatFileSize(size)}</span>
    </div>
  )
}

export function UserMessage({ message }: { message: Message }) {
  const { t } = useI18n()
  const images = message.attachments?.filter(a => a.mediaType.startsWith('image/')) ?? []
  const files = message.attachments?.filter(a => !a.mediaType.startsWith('image/')) ?? []

  return (
    <AIMessage from="user" data-testid="message-user">
      <div className="flex gap-3 py-3 flex-row-reverse">
        <Avatar className="h-8 w-8 mt-0.5">
          <AvatarFallback className="text-[10px] font-semibold bg-blue-500/20 text-blue-500">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 flex flex-col items-end">
          <div className="text-xs font-medium text-muted-foreground mb-1.5">
            {t.chat.you}
            <span className="ml-2 text-[10px] opacity-60">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <MessageContent>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {images.map((a, i) => (
                  <AttachmentImage key={i} data={a.data} mediaType={a.mediaType} filename={a.filename} />
                ))}
              </div>
            )}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {files.map((a, i) => (
                  <AttachmentFile key={i} filename={a.filename} mediaType={a.mediaType} size={a.size} />
                ))}
              </div>
            )}
          </MessageContent>
        </div>
      </div>
    </AIMessage>
  )
}
