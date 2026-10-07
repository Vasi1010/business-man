declare const process: { env: Record<string, string | undefined> }

import { describe, expect, it } from 'vitest'
import { OWNABLE_TILES } from './data/board'
import { applyAction, initialState } from './engine'
import { waitingOn } from './rules'
import { players } from './testUtils'
import type { Action, GameState, PlayerId, Settings } from './types'

/** Small deterministic PRNG so failures are reproducible. */
function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function candidates(s: GameState, actor: PlayerId, rand: () => number, now: number): Action[] {
  const die = () => 1 + Math.floor(rand() * 6)
  const list: Action[] = [
    { type: 'roll', dice: [die(), die()] },
    { type: 'buy' },
    { type: 'decline', now },
    { type: 'endTurn' },
    { type: 'payDebt' },
    { type: 'declareBankruptcy', now },
    { type: 'payJailFine' },
    { type: 'useJailPass' },
    { type: 'passAuction' },
    { type: 'closeAuction', now: now + 60_000 },
  ]
  if (s.auction) list.push({ type: 'bid', amount: s.auction.highBid + 100 * (1 + Math.floor(rand() * 5)), now })
  const owned = OWNABLE_TILES.filter((i) => s.properties[i].owner === actor)
  const kinds = ['build', 'sellBuilding', 'mortgage', 'unmortgage'] as const
  for (let k = 0; k < 2 && owned.length; k++) {
    const tile = owned[Math.floor(rand() * owned.length)]
    list.push({ type: kinds[Math.floor(rand() * kinds.length)], tile })
  }
  for (const t of s.trades) if (t.toId === actor) list.push({ type: 'respondTrade', tradeId: t.id, accept: rand() < 0.5 })
  const other = s.players.find((p) => p.id !== actor && !p.bankrupt)
  const mine = OWNABLE_TILES.filter((i) => s.properties[i].owner === actor)
  if (other && mine.length && rand() < 0.05) {
    list.push({ type: 'proposeTrade', toId: other.id, give: { tiles: [mine[0]], cash: 0, passes: 0 }, get: { tiles: [], cash: 500, passes: 0 } })
  }
  return list
}

function play(seed: number, n: number, settings: Partial<Settings>) {
  const rand = rng(seed)
  let s = initialState(players(n), settings, { now: 0 })
  let now = 0
  for (let step = 0; step < Number(process.env.FUZZ_STEPS ?? 1200) && s.status === 'playing'; step++) {
    now += 1000
    const actors = [...new Set([...waitingOn(s), ...s.trades.map((t) => t.toId)])]
    const options: { action: Action; actor: PlayerId }[] = []
    for (const actor of actors) {
      for (const action of candidates(s, actor, rand, now)) {
        const r = applyAction(s, action, actor)
        if (!('error' in r)) options.push({ action, actor })
      }
    }
    if (options.length === 0) {
      // Exhaustive fallback before calling it a deadlock.
      for (const actor of actors) {
        for (const tile of OWNABLE_TILES) {
          for (const type of ['build', 'sellBuilding', 'mortgage', 'unmortgage'] as const) {
            if (!('error' in applyAction(s, { type, tile }, actor))) options.push({ action: { type, tile }, actor })
          }
        }
      }
    }
    if (options.length === 0) {
      console.log(JSON.stringify({ debts: s.debts, auction: s.auction, turn: s.turn, players: s.players, trades: s.trades }, null, 1))
    }
    if (options.length === 0) throw new Error(`Deadlock at step ${step} (seed ${seed}): waiting on ${waitingOn(s).join(',')}`)
    // Mostly prefer progress (rolling, buying, paying) over property management.
    const progress = options.filter((o) => !['build', 'sellBuilding', 'mortgage', 'unmortgage'].includes(o.action.type))
    const pool = progress.length > 0 && rand() < 0.75 ? progress : options
    const pick = pool[Math.floor(rand() * pool.length)]
    const r = applyAction(s, pick.action, pick.actor)
    if ('error' in r) throw new Error(r.error)
    s = r.state
    for (const p of s.players) {
      expect(p.cash, `cash of ${p.id} at step ${step}`).toBeGreaterThanOrEqual(0)
      expect(p.position).toBeGreaterThanOrEqual(0)
      expect(p.position).toBeLessThan(40)
    }
    for (const tile of OWNABLE_TILES) {
      const prop = s.properties[tile]
      if (prop.owner) expect(s.players.find((p) => p.id === prop.owner)?.bankrupt).toBe(false)
      expect(prop.level).toBeGreaterThanOrEqual(0)
      expect(prop.level).toBeLessThanOrEqual(4)
      if (prop.mortgaged) expect(prop.level).toBe(0)
    }
  }
  return s
}

// Quick by default. Soak test: FUZZ_GAMES=50 FUZZ_STEPS=3000 npm test
describe('random full games (fuzz)', () => {
  const variants: Partial<Settings>[] = [
    { startingCash: 6000 },
    { firstLapRule: false, auctions: false, startingCash: 5000 },
    { restHouseMode: 'skipTurn', wealthTaxMode: 'percent', jailHalfRent: true },
    { rollTwelveToStart: true, startingCash: 4000 },
  ]
  it('never deadlocks or breaks invariants', { timeout: 180_000 }, () => {
    for (let seed = 1; seed <= Number(process.env.FUZZ_GAMES ?? 3); seed++) {
      const s = play(seed, 2 + (seed % 5), variants[seed % variants.length])
      expect(s.seq).toBeGreaterThan(100)
    }
  })
})
