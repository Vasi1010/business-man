import { useEffect, useRef } from 'react'
import { type GameState, type PlayerId } from '../../engine'
import { moneyBurst } from '../../store/moneyFx'
import { toast } from '../../store/toasts'
import { sfx } from '../sound'
import { arrivalDelay } from './useAnimatedPositions'

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
    const roll = state.lastRoll
    const delay = roll && roll.seq === state.seq ? arrivalDelay(roll.dice[0] + roll.dice[1]) : 0
    const later = (fn: () => void) => (delay ? setTimeout(fn, delay) : fn())
    let moneyToasts = 0
    let gained = false
    let lost = false
    for (const e of state.lastEvents) {
      switch (e.type) {
        case 'dice':
          sfx.dice()
          break
        case 'card':
          setTimeout(() => sfx.card(), delay || 250)
          break
        case 'jail':
          later(() => sfx.bad())
          break
        case 'bankrupt':
          toast(`${name(e.playerId)} is bankrupt!`, 'loss')
          break
        case 'money': {
          const mine = meId === null || e.playerId === meId
          if (mine) {
            if (e.amount > 0) gained = true
            else lost = true
          }
          if (moneyToasts < 4) {
            moneyToasts++
            const player = state.players.find((p) => p.id === e.playerId)
            const who = meId !== null && e.playerId === meId ? 'You' : (player?.name ?? '?')
            const burst = { amount: e.amount, who, reason: e.reason, color: player?.color ?? '#888888' }
            later(() => moneyBurst(burst))
          }
          break
        }
        case 'gameOver':
          sfx.card()
          break
      }
    }
    if (gained) setTimeout(() => sfx.coin(), delay + 120)
    else if (lost) setTimeout(() => sfx.pay(), delay + 120)

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
