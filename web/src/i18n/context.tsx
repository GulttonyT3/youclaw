import { createContext, useContext, useState, type ReactNode } from 'react'
import { en } from './en'
import { zh } from './zh'
import type { Translations } from './types'

export type Locale = 'en' | 'zh'

interface I18nContextType {
  locale: Locale
  t: Translations
  setLocale: (locale: Locale) => void
}

const locales: Record<Locale, Translations> = { en, zh }

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  t: en,
  setLocale: () => {},
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(
    () => (localStorage.getItem('youclaw-locale') as Locale) || 'en',
  )

  const setLocale = (l: Locale) => {
    localStorage.setItem('youclaw-locale', l)
    setLocaleState(l)
  }

  return (
    <I18nContext.Provider value={{ locale, t: locales[locale], setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
