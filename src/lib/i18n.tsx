// In-house i18n (no backend). t(key, params) → locale dict → en dict → key, so a missing key never breaks a screen.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import en from '@/locales/en.json'
import hi from '@/locales/hi.json'
import mr from '@/locales/mr.json'

export const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
] as const
export type Locale = (typeof LOCALES)[number]['code']

const DICTS: Record<Locale, Record<string, string>> = { en, hi, mr }
/** BCP-47 tags for Intl date formatting (money stays en-IN per spec). */
export const DATE_LOCALE: Record<Locale, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' }

const read = (): Locale => {
  try {
    const v = localStorage.getItem('locale')
    if (v === 'en' || v === 'hi' || v === 'mr') return v
  } catch { /* private mode / blocked storage */ }
  return 'en'
}

type Translate = (key: string, params?: Record<string, string | number>) => string
interface Ctx { locale: Locale; setLocale: (l: Locale) => void; t: Translate }
const LocaleContext = createContext<Ctx | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(read)
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    try { localStorage.setItem('locale', l) } catch { /* ignore */ }
  }, [])
  // Keep <html lang> in step with the UI language (screen readers, hyphenation).
  useEffect(() => { document.documentElement.lang = locale }, [locale])
  const t = useCallback<Translate>((key, params) => {
    const s = DICTS[locale][key] ?? DICTS.en[key] ?? key
    return params ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`)) : s
  }, [locale])
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const c = useContext(LocaleContext)
  if (!c) throw new Error('useLocale must be used within LocaleProvider')
  return c
}
export const useT = () => useLocale().t
