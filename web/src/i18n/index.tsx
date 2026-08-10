import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { en } from './en'
import { zh } from './zh'
import type { Dict, Locale } from './types'

const dicts: Record<Locale, Dict> = { zh, en }
const STORAGE_KEY = 'mch.locale'

function resolveInitial(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'zh' || stored === 'en') return stored
  const system = navigator.language.toLowerCase()
  return system.startsWith('zh') ? 'zh' : 'en'
}

interface I18nValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nValue>({
  locale: 'zh',
  setLocale: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(resolveInitial)

  const setLocale = (next: Locale) => {
    setLocaleState(next)
    localStorage.setItem(STORAGE_KEY, next)
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en'
  }

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])

  const t = (key: string) => dicts[locale][key] ?? key

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
