import { describe, expect, it } from 'vitest'
import { applyAction, type Action, type GameState } from '../engine'
import { game } from '../engine/testUtils'
import { mutateWithRetry, type SyncIO, type VersionedRow } from './sync'

type Row = VersionedRow<GameState>

/** A fake server holding one row, with optional interference before writes. */
function fakeServer(initial: GameState) {
  const server: Row = { state: initial, version: 1 }
  let local: Row | null = { ...server }
  const log: string[] = []
  const hooks: { beforeWrite?: () => void; failNext?: number } = {}
  const io: SyncIO<GameState, Row> = {
    current: () => local,
    refresh: async () => {
      local = { ...server }
      log.push('refresh')
      return local
    },
    write: async (expected, state) => {
      if (hooks.failNext && hooks.failNext-- > 0) throw new Error('Failed to fetch')
      hooks.beforeWrite?.()
      if (server.version !== expected) {
        log.push('conflict')
        return false
      }
      server.state = state
      server.version++
      log.push('write')
      return true
    },
    committed: (r) => {
      local = r
    },
    setConnected: (ok) => log.push(ok ? 'online' : 'offline'),
    sleep: async () => {},
  }
  return { server, io, log, hooks }
}

const act = (action: Action, actor: string) => (s: GameState) => {
  const r = applyAction(s, action, actor)
  return 'error' in r ? { error: r.error } : r.state
}

describe('optimistic sync', () => {
  it('writes at the current version', async () => {
    const { server, io } = fakeServer(game(3))
    const err = await mutateWithRetry(io, act({ type: 'roll', dice: [1, 3] }, 'a'))
    expect(err).toBeNull()
    expect(server.version).toBe(2)
    expect(server.state.players[0].position).toBe(4)
  })

  it('re-fetches and re-applies after a conflicting write', async () => {
    const start = game(3)
    const { server, io, log, hooks } = fakeServer(start)
    // Another player proposes a trade just before our write lands.
    hooks.beforeWrite = () => {
      hooks.beforeWrite = undefined
      const r = applyAction(server.state, { type: 'proposeTrade', toId: 'a', give: { tiles: [], cash: 100, passes: 0 }, get: { tiles: [], cash: 0, passes: 0 } }, 'b')
      if ('error' in r) throw new Error(r.error)
      server.state = r.state
      server.version++
    }
    const err = await mutateWithRetry(io, act({ type: 'roll', dice: [2, 3] }, 'a'))
    expect(err).toBeNull()
    expect(log.filter((x) => x === 'conflict')).toHaveLength(1)
    expect(server.version).toBe(3)
    // Both changes survive: the trade and the roll.
    expect(server.state.trades).toHaveLength(1)
    expect(server.state.players[0].position).toBe(5)
  })

  it('surfaces rule errors that appear after re-fetching', async () => {
    const { server, io, hooks } = fakeServer(game(3))
    // Someone else ends the auction race: by the time we retry, it's no longer our turn.
    hooks.beforeWrite = () => {
      hooks.beforeWrite = undefined
      server.state = { ...server.state, turn: { ...server.state.turn, playerId: 'b' } }
      server.version++
    }
    const err = await mutateWithRetry(io, act({ type: 'roll', dice: [2, 3] }, 'a'))
    expect(err).toBe("It's not your turn")
  })

  it('retries through network errors and reports offline/online', async () => {
    const { server, io, log, hooks } = fakeServer(game(3))
    hooks.failNext = 2
    const err = await mutateWithRetry(io, act({ type: 'roll', dice: [1, 2] }, 'a'))
    expect(err).toBeNull()
    expect(log.filter((x) => x === 'offline')).toHaveLength(2)
    expect(log.at(-1)).toBe('online')
    expect(server.version).toBe(2)
  })

  it('gives up after repeated network failures', async () => {
    const { io, hooks } = fakeServer(game(3))
    hooks.failNext = 99
    const err = await mutateWithRetry(io, act({ type: 'roll', dice: [1, 2] }, 'a'))
    expect(err).toMatch(/Could not reach/)
  })
})
