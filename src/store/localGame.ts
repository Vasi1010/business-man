import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  DEFAULT_SETTINGS,
  applyAction,
  initialState,
  type Action,
  type GameState,
  type PlayerId,
  type PlayerSetup,
  type Settings,
} from '../engine'

/** Pass-and-play: the same engine, run entirely on this device. */
interface LocalGameStore {
  game: GameState | null
  roster: PlayerSetup[]
  settings: Settings
  setRoster: (roster: PlayerSetup[]) => void
  setSettings: (settings: Settings) => void
  start: () => void
  dispatch: (action: Action, actorId: PlayerId) => string | null
  endGame: () => void
}

export const useLocalGame = create<LocalGameStore>()(
  persist(
    (set, get) => ({
      game: null,
      roster: [],
      settings: { ...DEFAULT_SETTINGS },
      setRoster: (roster) => set({ roster }),
      setSettings: (settings) => set({ settings }),
      start: () => {
        const { roster, settings } = get()
        set({ game: initialState(roster, settings, { now: Date.now() }) })
      },
      dispatch: (action, actorId) => {
        const game = get().game
        if (!game) return 'No game in progress'
        const result = applyAction(game, action, actorId)
        if ('error' in result) return result.error
        set({ game: result.state })
        return null
      },
      endGame: () => set({ game: null }),
    }),
    {
      name: 'businessman:local',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = persisted as Partial<LocalGameStore> | undefined
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p?.settings } }
      },
    },
  ),
)
