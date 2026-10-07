import { create } from 'zustand'

export type ToastTone = 'gain' | 'loss' | 'info' | 'error'

export interface Toast {
  id: number
  text: string
  tone: ToastTone
}

interface ToastStore {
  toasts: Toast[]
  push: (text: string, tone?: ToastTone) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (text, tone = 'info') => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }))
    setTimeout(() => get().dismiss(id), tone === 'error' ? 4500 : 3200)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = (text: string, tone?: ToastTone) => useToasts.getState().push(text, tone)
