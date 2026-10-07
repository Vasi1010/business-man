import { applyAction, initialState } from './engine'
import type { Action, GameState, PlayerId, PlayerSetup, Settings } from './types'

export const NOW = 1_000_000

export function players(n: number): PlayerSetup[] {
  const tokens = ['auto', 'elephant', 'peacock', 'tiger', 'diya', 'houseboat'] as const
  return Array.from({ length: n }, (_, i) => ({
    id: 'abcdef'[i],
    name: ['Ayaan', 'Sara', 'Kabir', 'Meera', 'Dev', 'Isha'][i],
    token: tokens[i],
    color: '#000000',
  }))
}

/** A fresh game; by default everyone has already lapped so buying is allowed. */
export function game(n = 3, settings: Partial<Settings> = {}, opts: { lapped?: boolean } = {}): GameState {
  const s = initialState(players(n), settings, { now: NOW })
  if (opts.lapped !== false) s.players.forEach((p) => (p.lapped = true))
  return s
}

/** Mutate a copy of the state to arrange a scenario. */
export function arrange(s: GameState, fn: (draft: GameState) => void): GameState {
  const draft = structuredClone(s)
  fn(draft)
  return draft
}

export function act(s: GameState, action: Action, actor: PlayerId): GameState {
  const r = applyAction(s, { now: NOW, ...action } as Action, actor)
  if ('error' in r) throw new Error(`Unexpected error for ${action.type}: ${r.error}`)
  return r.state
}

export function actError(s: GameState, action: Action, actor: PlayerId): string {
  const r = applyAction(s, { now: NOW, ...action } as Action, actor)
  if (!('error' in r)) throw new Error(`Expected ${action.type} to fail`)
  return r.error
}

/** Non-doubles dice for a total where possible. */
export function diceFor(total: number): [number, number] {
  for (let a = 1; a <= 6; a++) {
    const b = total - a
    if (b >= 1 && b <= 6 && a !== b) return [a, b]
  }
  return [total / 2, total / 2]
}

export function roll(s: GameState, actor: PlayerId, total: number): GameState {
  return act(s, { type: 'roll', dice: diceFor(total) }, actor)
}

export function cash(s: GameState, id: PlayerId): number {
  return s.players.find((p) => p.id === id)!.cash
}

export function player(s: GameState, id: PlayerId) {
  return s.players.find((p) => p.id === id)!
}

export function own(draft: GameState, owner: PlayerId, ...tiles: number[]) {
  for (const t of tiles) draft.properties[t].owner = owner
}

export function place(draft: GameState, id: PlayerId, position: number) {
  draft.players.find((p) => p.id === id)!.position = position
}
