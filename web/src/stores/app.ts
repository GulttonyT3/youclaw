import { create } from "zustand"
import { getItem, setItem } from "@/lib/storage"
import { applyThemeToDOM, type Theme } from "@/hooks/useTheme"
import { getAuthUser, getAuthStatus, getAuthLoginUrl, authLogout, getCreditBalance, getPayUrl, type AuthUser } from "@/api/client"
import { isTauri } from "@/api/transport"
import type { Locale } from "@/i18n/context"

interface AppState {
  theme: Theme
  setTheme: (theme: Theme) => void

  locale: Locale
  setLocale: (locale: Locale) => void

  sidebarCollapsed: boolean
  toggleSidebar: () => void
  collapseSidebar: () => void
  expandSidebar: () => void

  // Auth
  user: AuthUser | null
  isLoggedIn: boolean
  authLoading: boolean
  fetchUser: () => Promise<void>
  login: () => Promise<void>
  logout: () => Promise<void>

  // Credits
  creditBalance: number | null
  fetchCreditBalance: () => Promise<void>
  openPayPage: () => Promise<void>

  hydrate: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: "system",
  setTheme: (theme) => {
    set({ theme })
    applyThemeToDOM(theme)
    setItem("theme", theme)
  },

  locale: "en",
  setLocale: (locale) => {
    set({ locale })
    setItem("locale", locale)
  },

  sidebarCollapsed: false,
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed
    set({ sidebarCollapsed: next })
    setItem("sidebar-collapsed", String(next))
  },
  collapseSidebar: () => {
    set({ sidebarCollapsed: true })
    setItem("sidebar-collapsed", "true")
  },
  expandSidebar: () => {
    set({ sidebarCollapsed: false })
    setItem("sidebar-collapsed", "false")
  },

  // Auth
  user: null,
  isLoggedIn: false,
  authLoading: false,

  fetchUser: async () => {
    try {
      set({ authLoading: true })
      const user = await getAuthUser()
      set({ user, isLoggedIn: true, authLoading: false })
    } catch {
      set({ user: null, isLoggedIn: false, authLoading: false })
    }
  },

  login: async () => {
    try {
      const { loginUrl } = await getAuthLoginUrl()
      // 用浏览器打开登录页
      if (isTauri) {
        const { open } = await import('@tauri-apps/plugin-opener')
        await open(loginUrl)
      } else {
        window.open(loginUrl, '_blank')
      }

      // 轮询等待登录完成
      set({ authLoading: true })
      const pollInterval = setInterval(async () => {
        try {
          const { loggedIn } = await getAuthStatus()
          if (loggedIn) {
            clearInterval(pollInterval)
            await get().fetchUser()
            await get().fetchCreditBalance()
          }
        } catch {
          // 继续轮询
        }
      }, 2000)

      // 60 秒超时
      setTimeout(() => {
        clearInterval(pollInterval)
        set({ authLoading: false })
      }, 60000)
    } catch (err) {
      console.error('Login failed:', err)
      set({ authLoading: false })
    }
  },

  logout: async () => {
    try {
      await authLogout()
    } catch {
      // 即使远程注销失败也清理本地状态
    }
    set({ user: null, isLoggedIn: false, creditBalance: null })
  },

  // Credits
  creditBalance: null,

  fetchCreditBalance: async () => {
    try {
      const { balance } = await getCreditBalance()
      set({ creditBalance: balance })
    } catch {
      set({ creditBalance: null })
    }
  },

  openPayPage: async () => {
    try {
      const { payUrl } = await getPayUrl()
      if (isTauri) {
        const { open } = await import('@tauri-apps/plugin-opener')
        await open(payUrl)
      } else {
        window.open(payUrl, '_blank')
      }

      // 轮询检测余额变化
      const oldBalance = get().creditBalance
      const pollInterval = setInterval(async () => {
        try {
          const { balance } = await getCreditBalance()
          if (balance !== oldBalance) {
            clearInterval(pollInterval)
            set({ creditBalance: balance })
          }
        } catch {
          // 继续轮询
        }
      }, 3000)

      // 120 秒超时停止轮询
      setTimeout(() => clearInterval(pollInterval), 120000)
    } catch (err) {
      console.error('Open pay page failed:', err)
    }
  },

  hydrate: async () => {
    const [theme, locale, sidebar] = await Promise.all([
      getItem("theme"),
      getItem("locale"),
      getItem("sidebar-collapsed"),
    ])
    const resolvedTheme = (theme as Theme) ?? "system"
    set({
      theme: resolvedTheme,
      locale: (locale as Locale) ?? "en",
      sidebarCollapsed: sidebar === "true",
    })
    applyThemeToDOM(resolvedTheme)

    // 尝试加载已登录用户
    try {
      const { loggedIn } = await getAuthStatus()
      if (loggedIn) {
        await get().fetchUser()
        await get().fetchCreditBalance()
      }
    } catch {
      // 后端未就绪，忽略
    }
  },
}))
