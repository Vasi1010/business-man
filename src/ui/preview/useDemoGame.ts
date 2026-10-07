import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyAction, initialState, type Action, type GameState } from '../../engine'
import type { GameController } from '../controller'
import { arrivalDelay } from '../hooks/useAnimatedPositions'
import { PLAYER_COLORS } from '../tokens'

/** A furnished demo game: four players, some cities owned and built on. */
function demoState(): GameState {
  const s = initialState(
    [
      { id: 'a', name: 'Ayaan', token: 'auto', color: PLAYER_COLORS[0].hex },
      { id: 'b', name: 'Sara', token: 'elephant', color: PLAYER_COLORS[1].hex },
      { id: 'c', name: 'Kabir', token: 'peacock', color: PLAYER_COLORS[2].hex },
      { id: 'd', name: 'Meera', token: 'tiger', color: PLAYER_COLORS[3].hex },
    ],
    { startingCash: 60000 },
    { now: Date.now() },
  )
  const own = (id: string, tiles: number[], level = 0) =>
    tiles.forEach((t) => {
      s.properties[t].owner = id
      s.properties[t].level = level
    })
  own('a', [1, 3], 4)
  own('b', [38, 39], 2)
  own('c', [21, 23, 24], 1)
  own('d', [5, 15])
  own('a', [12])
  s.properties[28].owner = 'c'
  s.properties[28].mortgaged = true
  s.players[1].position = 7
  s.players[2].position = 18
  s.players[3].position = 26
  return s
}

const randomDie = () => 1 + Math.floor(Math.random() * 6)

/** Runs the demo: Roll → walk → auto buy → end turn. */
export function useDemoGame(): { controller: GameController; roll: () => void; busy: boolean } {
  const [state, setState] = useState<GameState>(demoState)
  const [busy, setBusy] = useState(false)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  const apply = useCallback((action: Action, actor: string) => {
    const r = applyAction(stateRef.current, { ...action, now: Date.now() } as Action, actor)
    if ('error' in r) return r.error
    stateRef.current = r.state
    setState(r.state)
    return null
  }, [])

  const roll = useCallback(() => {
    if (busy) return
    setBusy(true)
    const s = stateRef.current
    const actor = s.turn.playerId
    const dice: [number, number] = [randomDie(), randomDie()]
    if (s.players.find((p) => p.id === actor)?.inJail) apply({ type: 'payJailFine' }, actor)
    apply({ type: 'roll', dice }, actor)
    setTimeout(() => {
      const after = stateRef.current
      if (after.debts.length) apply({ type: 'payDebt' }, after.debts[0].debtorId)
      if (stateRef.current.turn.phase === 'buy') {
        if (apply({ type: 'buy' }, actor)) apply({ type: 'decline', now: Date.now() }, actor)
      }
      if (stateRef.current.turn.phase === 'end') apply({ type: 'endTurn' }, actor)
      setBusy(false)
    }, arrivalDelay(dice[0] + dice[1]) + 300)
  }, [apply, busy])

  const controller = useMemo<GameController>(
    () => ({
      mode: 'local',
      state,
      meId: null,
      onlineIds: null,
      dispatch: async (action, actor) => apply(action, actor),
      playAgain: () => setState(demoState()),
      leave: () => {},
    }),
    [state, apply],
  )
  return { controller, roll, busy }
}
