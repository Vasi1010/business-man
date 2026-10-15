import { BOARD_SIZE, type GameEvent, type PlayerId } from '../engine'

/**
 * Turns the events of one action into a timeline, so the screen tells the story in order:
 * dice tumble → pawn walks → card appears → pawn moves again → money changes → decisions.
 * It's a pure function of the events, so every part of the UI (and every player online)
 * computes the same timing.
 */

/** Wait for the dice tumble to finish before the pawn sets off. */
export const DICE_MS = 650
const MIN_WALK_MS = 1000
const MAX_WALK_MS = 3000
const PER_STEP_MS = 230
/** A trip to Jail is one long hop. */
const JAIL_MS = 800
/** How long a Chance / Community Chest card stays up before play carries on. */
export const CARD_MS = 2800
/** Short beat after each move before the next thing happens. */
const BEAT_MS = 150

/** Total walk time: 1–3 seconds depending on distance. */
export function walkDuration(steps: number): number {
  return Math.min(MAX_WALK_MS, Math.max(MIN_WALK_MS, steps * PER_STEP_MS))
}

export interface PlannedMove {
  playerId: PlayerId
  /** Tiles visited in order, not including the starting tile. */
  path: number[]
  start: number
  stepMs: number
  how: 'walk' | 'back' | 'jail'
}

export interface Playback {
  moves: PlannedMove[]
  /** When each event should be shown, in the same order as the events. */
  at: number[]
  /** When the card goes up and comes down, if one was drawn. */
  card: { show: number; hide: number } | null
  /** When everything has finished and the player can decide. */
  settledAt: number
}

function pathFor(from: number, to: number, how: PlannedMove['how']): number[] {
  if (how === 'jail') return [to]
  const dir = how === 'back' ? -1 : 1
  const steps = ((to - from) * dir + BOARD_SIZE) % BOARD_SIZE
  return Array.from({ length: steps }, (_, i) => (from + dir * (i + 1) + BOARD_SIZE) % BOARD_SIZE)
}

export function buildPlayback(events: readonly GameEvent[]): Playback {
  let t = 0
  const moves: PlannedMove[] = []
  const at: number[] = []
  let card: Playback['card'] = null
  for (const e of events) {
    at.push(t)
    switch (e.type) {
      case 'dice':
        t += DICE_MS
        break
      case 'move': {
        const path = pathFor(e.from, e.to, e.how)
        if (path.length === 0) break
        const total = e.how === 'jail' ? JAIL_MS : walkDuration(path.length)
        moves.push({ playerId: e.playerId, path, start: t, stepMs: total / path.length, how: e.how })
        // Things caused by the move (salary, rent, a card) show once the pawn arrives.
        t += total + BEAT_MS
        at[at.length - 1] = t
        break
      }
      case 'card':
        card = { show: t, hide: t + CARD_MS }
        t += CARD_MS + BEAT_MS
        break
    }
  }
  return { moves, at, card, settledAt: t }
}
