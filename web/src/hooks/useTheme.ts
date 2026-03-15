import { useEffect } from "react"
import { useAppStore } from "@/stores/app"

export type Theme = "dark" | "light" | "system"

export function applyThemeToDOM(theme: Theme): void {
  const body = document.body

  // 切换时禁用所有 transition，避免颜色渐变不同步
  document.documentElement.style.setProperty("--disable-transitions", "1")
  const style = document.createElement("style")
  style.textContent = "*, *::before, *::after { transition-duration: 0s !important; }"
  document.head.appendChild(style)

  if (theme === "system") {
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    body.classList.toggle("dark", systemDark)
  } else if (theme === "dark") {
    body.classList.add("dark")
  } else {
    body.classList.remove("dark")
  }

  // 下一帧恢复 transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.head.removeChild(style)
      document.documentElement.style.removeProperty("--disable-transitions")
    })
  })
}

// 初始化主题的 hook（在 App 根组件使用）
export function useTheme(): void {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    applyThemeToDOM(theme)
  }, [theme])

  // 监听系统主题变化
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      const current = useAppStore.getState().theme
      if (current === "system") {
        applyThemeToDOM("system")
      }
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])
}
