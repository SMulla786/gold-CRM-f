import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'
const KEY = 'ju-theme'

/** index.html sets the <html> class before first paint; this only reads it back and toggles it. */
const initial = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')

const ThemeContext = createContext<{ theme: Theme; resolvedTheme: Theme; setTheme: (t: Theme) => void }>({
  theme: 'light',
  resolvedTheme: 'light',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, set] = useState<Theme>(initial)
  const setTheme = useCallback((t: Theme) => {
    document.documentElement.classList.toggle('dark', t === 'dark')
    try {
      localStorage.setItem(KEY, t)
    } catch {
      /* private mode: theme just won't persist */
    }
    set(t)
  }, [])
  return <ThemeContext.Provider value={{ theme, resolvedTheme: theme, setTheme }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
