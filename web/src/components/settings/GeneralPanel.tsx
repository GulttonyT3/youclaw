import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useI18n } from "@/i18n"
import { useAppStore } from "@/stores/app"
import type { Theme } from "@/hooks/useTheme"

const themeOptions: { value: Theme; labelKey: "dark" | "light" | "system"; descKey: "darkDesc" | "lightDesc" | "systemDesc" }[] = [
  { value: "dark", labelKey: "dark", descKey: "darkDesc" },
  { value: "light", labelKey: "light", descKey: "lightDesc" },
  { value: "system", labelKey: "system", descKey: "systemDesc" },
]

const languageOptions = [
  { value: "en", label: "English" },
  { value: "zh", label: "简体中文" },
] as const

export function GeneralPanel() {
  const { t } = useI18n()
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const locale = useAppStore((s) => s.locale)
  const setLocale = useAppStore((s) => s.setLocale)

  return (
    <div className="pt-4 space-y-6">
      {/* 主题 */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
          {t.settings.appearance}
        </h3>
        <RadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          {themeOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-accent"
            >
              <RadioGroupItem value={option.value} />
              <div>
                <span className="text-sm font-medium cursor-pointer">
                  {t.settings[option.labelKey]}
                </span>
                <div className="text-xs text-muted-foreground">{t.settings[option.descKey]}</div>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>
      {/* 语言 */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
          {t.settings.language}
        </h3>
        <RadioGroup value={locale} onValueChange={(v) => setLocale(v as 'en' | 'zh')}>
          {languageOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-accent"
            >
              <RadioGroupItem value={option.value} />
              <span className="text-sm font-medium cursor-pointer">{option.label}</span>
            </label>
          ))}
        </RadioGroup>
      </div>
    </div>
  )
}
