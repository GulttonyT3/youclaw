import { Bot } from 'lucide-react'
import { useI18n } from '@/i18n'

export function Topbar() {
  const { locale, t, setLocale } = useI18n()

  return (
    <header className="h-14 border-b border-border flex items-center px-4 shrink-0">
      <div className="flex items-center gap-2">
        <Bot className="h-6 w-6 text-primary" />
        <span className="font-semibold text-lg">{t.topbar.title}</span>
      </div>
      <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
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
      </div>
    </header>
  )
}
