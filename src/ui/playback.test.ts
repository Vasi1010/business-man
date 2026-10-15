import { describe, expect, it } from 'vitest'
import type { GameEvent } from '../engine'
import { CARD_MS, DICE_MS, buildPlayback, walkDuration } from './playback'

const dice: GameEvent = { type: 'dice', playerId: 'a', dice: [2, 3] }

describe('playback timeline', () => {
  it('walks first, then shows rent once the pawn arrives', () => {
    const events: GameEvent[] = [
      dice,
      { type: 'move', playerId: 'a', from: 15, to: 20, how: 'walk' },
      { type: 'money', playerId: 'a', amount: -500, reason: 'rent' },
    ]
    const p = buildPlayback(events)
    expect(p.moves[0]).toMatchObject({ path: [16, 17, 18, 19, 20], start: DICE_MS })
    expect(p.at[2]).toBeGreaterThanOrEqual(DICE_MS + walkDuration(5))
    expect(p.settledAt).toBe(p.at[2])
  })

  it('shows the card on arrival and only then makes the card move', () => {
    const events: GameEvent[] = [
      dice,
      { type: 'move', playerId: 'a', from: 15, to: 20, how: 'walk' },
      { type: 'card', reveal: { seq: 1, deck: 'chance', roll: 5, playerId: 'a', title: 'On the move', text: '' } },
      { type: 'move', playerId: 'a', from: 20, to: 24, how: 'walk' },
      { type: 'money', playerId: 'a', amount: -2400, reason: 'rent' },
    ]
    const p = buildPlayback(events)
    const arrive = p.moves[0].start + walkDuration(5)
    expect(p.card!.show).toBeGreaterThanOrEqual(arrive)
    expect(p.moves[1].start).toBeGreaterThanOrEqual(p.card!.show + CARD_MS)
    expect(p.at[4]).toBeGreaterThan(p.moves[1].start)
  })

  it('goes backwards for "go back 3" and hops straight to Jail', () => {
    const p = buildPlayback([
      { type: 'move', playerId: 'a', from: 2, to: 35, how: 'back' },
      { type: 'move', playerId: 'a', from: 35, to: 9, how: 'jail' },
    ])
    expect(p.moves[0].path).toEqual([1, 0, 35])
    expect(p.moves[1].path).toEqual([9])
  })

  it('has nothing to wait for when nothing moves', () => {
    expect(buildPlayback([{ type: 'money', playerId: 'a', amount: -3000, reason: 'building' }]).settledAt).toBe(0)
  })
})
