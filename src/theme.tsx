import { createContext, createEffect, createSignal, ParentComponent, useContext } from 'solid-js'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: () => Theme
  setTheme: (t: Theme) => void
  isDark: () => boolean
}

const ThemeContext = createContext<ThemeContextType>()

export const ThemeProvider: ParentComponent = (props) => {
  const [theme, setTheme] = createSignal<Theme>((localStorage.getItem('theme') as Theme) || 'system')

  const [systemIsDark, setSystemIsDark] = createSignal(window.matchMedia('(prefers-color-scheme: dark)').matches)

  createEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (e: MediaQueryListEvent) => setSystemIsDark(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  })

  const isDark = () => {
    if (theme() === 'system') return systemIsDark()
    return theme() === 'dark'
  }

  createEffect(() => {
    const root = document.documentElement
    if (isDark()) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme())
  })

  return <ThemeContext.Provider value={{ theme, setTheme, isDark }}>{props.children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
