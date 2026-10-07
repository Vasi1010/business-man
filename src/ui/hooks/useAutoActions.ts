import { useEffect } from 'react'
import type { GameController } from '../controller'

/**
 * Time-based actions any client may trigger: closing an expired auction and
 * ending the game when the time limit is reached. Online, several clients may
 * race to do this; the loser's action simply fails validation and is ignored.
 */
export function useAutoActions(c: GameController) {
  const s = c.state
  const actor = c.meId ?? s.players.find((p) => !p.bankrupt)?.id
  const meActive = !!actor && !s.players.find((p) => p.id === actor)?.bankrupt
  const auctionEnds = s.auction?.endsAt ?? null
  const gameEnds = s.status === 'playing' ? s.endsAt : 0
  const { dispatch, mode } = c

  useEffect(() => {
    if (auctionEnds === null || !actor || !meActive) return
    const jitter = mode === 'online' ? 150 + Math.random() * 600 : 50
    const t = setTimeout(() => {
      void dispatch({ type: 'closeAuction', now: Date.now() }, actor, { silent: true })
    }, Math.max(0, auctionEnds - Date.now()) + jitter)
    return () => clearTimeout(t)
  }, [auctionEnds, actor, meActive, dispatch, mode])

  useEffect(() => {
    if (!gameEnds || !actor || !meActive) return
    const jitter = mode === 'online' ? 200 + Math.random() * 800 : 0
    let fired = false
    const t = setInterval(() => {
      if (fired || Date.now() < gameEnds + jitter) return
      fired = true
      void dispatch({ type: 'endByTime', now: Date.now() }, actor, { silent: true })
    }, 1000)
    return () => clearInterval(t)
  }, [gameEnds, actor, meActive, dispatch, mode])
}
