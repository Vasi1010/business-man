import { create } from 'zustand'

export type ThemePref = 'system' | 'light' | 'dark'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

const media = window.matchMedia('(prefers-color-scheme: dark)')

function applyTheme(theme: ThemePref) {
  const dark = theme === 'dark' || (theme === 'system' && media.matches)
  document.documentElement.classList.toggle('dark', dark)
}

interface Prefs {
  theme: ThemePref
  muted: boolean
  setTheme: (t: ThemePref) => void
  toggleMuted: () => void
}

export const usePrefs = create<Prefs>((set) => ({
  theme: (read('lakhpati:theme') as ThemePref | null) ?? 'system',
  muted: read('lakhpati:muted') === '1',
  setTheme: (theme) => {
    write('lakhpati:theme', theme)
    applyTheme(theme)
    set({ theme })
  },
  toggleMuted: () =>
    set((s) => {
      write('lakhpati:muted', s.muted ? '0' : '1')
      return { muted: !s.muted }
    }),
}))

media.addEventListener('change', () => applyTheme(usePrefs.getState().theme))
