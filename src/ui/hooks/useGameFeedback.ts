import { useEffect, useRef } from 'react'
import { type GameState, type PlayerId } from '../../engine'
import { moneyBurst } from '../../store/moneyFx'
import { toast } from '../../store/toasts'
import { sfx } from '../sound'
import { buildPlayback } from '../playback'

/** Sounds, toasts and money animations for whatever the latest action did (works for remote updates too). */
export function useGameFeedback(state: GameState, meId: PlayerId | null) {
  const lastSeq = useRef(state.seq)
  const lastTurn = useRef(state.turn.playerId)

  useEffect(() => {
    if (state.seq <= lastSeq.current) {
      lastSeq.current = state.seq
      return
    }
    lastSeq.current = state.seq
    const name = (id: PlayerId) => state.players.find((p) => p.id === id)?.name ?? '?'
    // Each event plays when the shared timeline reaches it: rent once the pawn lands,
    // a card's money after the card, and so on.
    const plan = buildPlayback(state.lastEvents)
    const later = (ms: number, fn: () => void) => (ms ? setTimeout(fn, ms) : fn())
    let moneyToasts = 0
    let soundAt: { at: number; gain: boolean } | null = null
    state.lastEvents.forEach((e, i) => {
      const at = plan.at[i] ?? 0
      switch (e.type) {
        case 'dice':
          sfx.dice()
          break
        case 'card':
          later(at, () => sfx.card())
          break
        case 'jail':
          later(at, () => sfx.bad())
          break
        case 'bankrupt':
          toast(`${name(e.playerId)} is bankrupt!`, 'loss')
          break
        case 'money': {
          const mine = meId === null || e.playerId === meId
          if (mine && !soundAt) soundAt = { at, gain: e.amount > 0 }
          if (moneyToasts < 4) {
            moneyToasts++
            const player = state.players.find((p) => p.id === e.playerId)
            const who = meId !== null && e.playerId === meId ? 'You' : (player?.name ?? '?')
            const burst = { playerId: e.playerId, amount: e.amount, who, reason: e.reason, color: player?.color ?? '#888888' }
            later(at, () => moneyBurst(burst))
          }
          break
        }
        case 'gameOver':
          sfx.card()
          break
      }
    })
    if (soundAt) {
      const { at, gain } = soundAt
      setTimeout(() => (gain ? sfx.coin() : sfx.pay()), at + 120)
    }

    if (state.turn.playerId !== lastTurn.current) {
      lastTurn.current = state.turn.playerId
      if (meId !== null && state.turn.playerId === meId && state.status === 'playing') {
        sfx.turn()
        toast('Your turn!', 'info')
      } else if (meId === null) {
        sfx.turn()
      }
    }
  }, [state, meId])
}
