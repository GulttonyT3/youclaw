import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useI18n } from "@/i18n"
import { useAppStore } from "@/stores/app"
import { getCreditTransactions, type CreditTransaction } from "@/api/client"
import { LogIn, LogOut, Coins, ExternalLink } from "lucide-react"

export function AccountPanel() {
  const { t } = useI18n()
  const { user, isLoggedIn, authLoading, login, logout, creditBalance, fetchCreditBalance, openPayPage } = useAppStore()
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [loadingTx, setLoadingTx] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)

  useEffect(() => {
    if (isLoggedIn) {
      fetchCreditBalance()
      loadTransactions()
    }
  }, [isLoggedIn])

  const loadTransactions = async () => {
    setLoadingTx(true)
    try {
      const data = await getCreditTransactions({ limit: 20 })
      setTransactions(data.items ?? [])
    } catch {
      setTransactions([])
    }
    setLoadingTx(false)
  }

  const handleTopUp = async () => {
    await openPayPage()
  }

  const handleLogout = async () => {
    await logout()
    setLogoutOpen(false)
  }

  if (!isLoggedIn) {
    return (
      <div className="pt-4 flex flex-col items-center justify-center gap-4 py-16">
        <div className="text-muted-foreground text-sm">{t.account.notLoggedIn}</div>
        <p className="text-xs text-muted-foreground">{t.account.loginHint}</p>
        <Button onClick={login} disabled={authLoading} className="gap-2">
          <LogIn size={16} />
          {authLoading ? t.account.loggingIn : t.account.login}
        </Button>
      </div>
    )
  }

  return (
    <div className="pt-4 space-y-6">
      {/* 用户信息 */}
      <div className="flex items-center gap-4">
        {user?.avatar ? (
          <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{user?.name}</div>
          {user?.email && <div className="text-xs text-muted-foreground truncate">{user.email}</div>}
        </div>
        <Button variant="outline" size="sm" onClick={() => setLogoutOpen(true)} className="gap-1.5">
          <LogOut size={14} />
          {t.account.logout}
        </Button>
      </div>

      {/* 积分余额 */}
      <div className="rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{t.account.creditBalance}</div>
            <div className="text-2xl font-bold mt-1 flex items-center gap-2">
              <Coins size={20} className="text-amber-500" />
              {creditBalance != null ? creditBalance.toLocaleString() : '--'}
            </div>
          </div>
          <Button onClick={handleTopUp} className="gap-1.5">
            <ExternalLink size={14} />
            {t.account.topUp}
          </Button>
        </div>
      </div>

      {/* 积分流水 */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          {t.account.transactions}
        </h3>
        {loadingTx ? (
          <div className="text-sm text-muted-foreground text-center py-4">{t.common.loading}</div>
        ) : transactions.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
            {t.common.noData}
          </div>
        ) : (
          <div className="space-y-1">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent/50">
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{tx.description || tx.type}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString()}
                  </div>
                </div>
                <span className={`text-sm font-medium shrink-0 ${tx.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {tx.amount >= 0 ? '+' : ''}{tx.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* 退出确认弹窗 */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.account.logout}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.account.logoutConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.account.logout}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
