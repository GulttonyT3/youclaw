import { useI18n } from "@/i18n"
import { useAppStore } from "@/stores/app"
import { LogIn, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Login() {
  const { t, locale, setLocale } = useI18n()
  const { authLoading, login } = useAppStore()

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background text-foreground">
      {/* Logo + 品牌 */}
      <div className="flex flex-col items-center gap-6 mb-10">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="text-3xl font-bold text-primary">Y</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">YouClaw</h1>
        <p className="text-sm text-muted-foreground max-w-xs text-center">
          {t.account.loginHint}
        </p>
      </div>

      {/* 登录按钮 */}
      <Button
        size="lg"
        onClick={() => login()}
        disabled={authLoading}
        className="gap-2 min-w-[200px]"
      >
        {authLoading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            {t.account.loggingIn}
          </>
        ) : (
          <>
            <LogIn size={18} />
            {t.account.login}
          </>
        )}
      </Button>

      {/* 语言切换 */}
      <button
        type="button"
        onClick={() => setLocale(locale === "en" ? "zh" : "en")}
        className="mt-8 px-3 py-1 rounded border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        {locale === "en" ? "中文" : "English"}
      </button>
    </div>
  )
}
