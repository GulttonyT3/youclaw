import { useContext } from 'react'
import { I18nContext } from './ctx'

export { I18nProvider } from './context'
export type { Locale } from './ctx'

export function useI18n() {
  return useContext(I18nContext)
}
