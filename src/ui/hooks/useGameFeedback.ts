import { useEffect, useRef } from 'react'
import { formatMoney, type GameState, type PlayerId } from '../../engine'
import { toast } from '../../store/toasts'
import { sfx } from '../sound'

/** Sounds and toasts for whatever the latest action did (works for remote updates too). */
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
    let moneyToasts = 0
    let gained = false
    let lost = false
    for (const e of state.lastEvents) {
      switch (e.type) {
        case 'dice':
          sfx.dice()
          break
        case 'card':
          setTimeout(() => sfx.card(), 250)
          break
        case 'jail':
          sfx.bad()
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
          if (moneyToasts < 3) {
            moneyToasts++
            const who = meId !== null && e.playerId === meId ? 'You' : name(e.playerId)
            toast(
              `${who} ${e.amount > 0 ? '+' : '−'}${formatMoney(Math.abs(e.amount))} · ${e.reason}`,
              mine ? (e.amount > 0 ? 'gain' : 'loss') : 'info',
            )
          }
          break
        }
        case 'gameOver':
          sfx.card()
          break
      }
    }
    if (gained) setTimeout(() => sfx.coin(), 120)
    else if (lost) setTimeout(() => sfx.pay(), 120)

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
