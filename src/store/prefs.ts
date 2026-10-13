import { create } from 'zustand'

export type ThemePref = 'system' | 'light' | 'dark'
export type BoardView = '3d' | '2d'

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

function hasWebGL(): boolean {
  try {
    const cv = document.createElement('canvas')
    return !!(cv.getContext('webgl2') ?? cv.getContext('webgl'))
  } catch {
    return false
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
  board: BoardView
  setBoard: (b: BoardView) => void
  setTheme: (t: ThemePref) => void
  toggleMuted: () => void
}

export const usePrefs = create<Prefs>((set) => ({
  theme: (read('businessman:theme') as ThemePref | null) ?? 'system',
  muted: read('businessman:muted') === '1',
  board: (read('businessman:board') as BoardView | null) ?? (hasWebGL() ? '3d' : '2d'),
  setBoard: (board) => {
    write('businessman:board', board)
    set({ board })
  },
  setTheme: (theme) => {
    write('businessman:theme', theme)
    applyTheme(theme)
    set({ theme })
  },
  toggleMuted: () =>
    set((s) => {
      write('businessman:muted', s.muted ? '0' : '1')
      return { muted: !s.muted }
    }),
}))

media.addEventListener('change', () => applyTheme(usePrefs.getState().theme))
