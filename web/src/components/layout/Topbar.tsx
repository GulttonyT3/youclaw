import { Bot } from 'lucide-react'

export function Topbar() {
  return (
    <header className="h-14 border-b border-border flex items-center px-4 shrink-0">
      <div className="flex items-center gap-2">
        <Bot className="h-6 w-6 text-primary" />
        <span className="font-semibold text-lg">ZoerClaw</span>
      </div>
      <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Running
        </span>
      </div>
    </header>
  )
}
