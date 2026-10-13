import { create } from 'zustand'

export interface MoneyBurst {
  id: number
  amount: number
  who: string
  reason: string
  color: string
}

interface MoneyFxStore {
  bursts: MoneyBurst[]
  push: (b: Omit<MoneyBurst, 'id'>) => void
}

/** How long each gain/loss animation stays on screen. */
export const BURST_MS = 2700

let nextId = 1

/** Big on-screen red/green money animations. */
export const useMoneyFx = create<MoneyFxStore>((set) => ({
  bursts: [],
  push: (b) => {
    const id = nextId++
    set((s) => ({ bursts: [...s.bursts.slice(-3), { ...b, id }] }))
    setTimeout(() => set((s) => ({ bursts: s.bursts.filter((x) => x.id !== id) })), BURST_MS)
  },
}))

export const moneyBurst = (b: Omit<MoneyBurst, 'id'>) => useMoneyFx.getState().push(b)
