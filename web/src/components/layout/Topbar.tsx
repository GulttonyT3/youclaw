import { Bot, Settings, Minus, Square, X, Minimize2 } from 'lucide-react'
import { useI18n } from '@/i18n'
import { isElectron, getElectronAPI } from '@/api/transport'
import { useEffect, useState } from 'react'

interface TopbarProps {
  onOpenSettings?: () => void
}

export function Topbar({ onOpenSettings }: TopbarProps) {
  const { locale, t, setLocale } = useI18n()
  const [platform, setPlatform] = useState<string>('')
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (!isElectron) return
    const api = getElectronAPI()
    setPlatform(api.getPlatform())
    const cleanup = api.onWindowMaximizeChange?.((val: boolean) => setIsMaximized(val))
    return cleanup
  }, [])

  const isMac = platform === 'darwin'
  const isWin = platform === 'win32'

  return (
    <header
      className="h-12 border-b border-border flex items-center px-4 shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* macOS: 给交通灯按钮留出空间 */}
      {isMac && <div className="w-20 shrink-0" />}

      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <span className="font-semibold text-base">{t.topbar.title}</span>
      </div>

      <div
        className="ml-auto flex items-center gap-2 text-sm text-muted-foreground"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          {t.topbar.running}
        </span>
        <button
          type="button"
          onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
          className="ml-2 px-2 py-0.5 rounded border border-border text-xs font-medium hover:bg-accent transition-colors"
        >
          {locale === 'en' ? '中' : 'EN'}
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-1.5 rounded hover:bg-accent transition-colors"
          title={t.settings.title}
        >
          <Settings className="h-4 w-4" />
        </button>
        {/* Windows: 自定义窗口控制按钮 */}
        {isWin && (
          <div className="flex items-stretch h-12 ml-2 -mr-4">
            <button
              type="button"
              onClick={() => getElectronAPI().minimizeWindow?.()}
              className="w-11 flex items-center justify-center hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => getElectronAPI().maximizeWindow?.()}
              className="w-11 flex items-center justify-center hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              {isMaximized
                ? <Minimize2 className="h-3 w-3" />
                : <Square className="h-3 w-3" />
              }
            </button>
            <button
              type="button"
              onClick={() => getElectronAPI().closeWindow?.()}
              className="w-11 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
