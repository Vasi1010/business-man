import { useEffect, useRef, useState } from 'react'
import { BOARD_SIZE, JAIL_TILE, type Player } from '../../engine'
import { sfx } from '../sound'

const STEP_MS = 140

/**
 * Board positions for drawing tokens. They walk tile by tile towards each
 * player's real position; going to Jail jumps straight there.
 */
export function useAnimatedPositions(players: Player[]): Record<string, number> {
  const playersRef = useRef(players)
  const [display, setDisplay] = useState<Record<string, number>>(() =>
    Object.fromEntries(players.map((p) => [p.id, p.position])),
  )
  const displayRef = useRef(display)

  useEffect(() => {
    playersRef.current = players
  })

  const key = players.map((p) => `${p.id}:${p.position}:${p.inJail ? 1 : 0}`).join('|')

  useEffect(() => {
    const tick = () => {
      let moved = false
      let stepped = false
      const next = { ...displayRef.current }
      for (const p of playersRef.current) {
        const cur = next[p.id]
        if (cur === undefined || p.bankrupt) {
          next[p.id] = p.position
          continue
        }
        if (cur === p.position) continue
        moved = true
        const forward = (p.position - cur + BOARD_SIZE) % BOARD_SIZE
        if (p.inJail && p.position === JAIL_TILE) next[p.id] = JAIL_TILE
        else if (forward > BOARD_SIZE - 4) next[p.id] = (cur - 1 + BOARD_SIZE) % BOARD_SIZE
        else {
          next[p.id] = (cur + 1) % BOARD_SIZE
          stepped = true
        }
      }
      if (moved) {
        displayRef.current = next
        setDisplay(next)
        if (stepped) sfx.step()
      }
      return moved
    }
    if (!tick()) return
    const timer = setInterval(() => {
      if (!tick()) clearInterval(timer)
    }, STEP_MS)
    return () => clearInterval(timer)
  }, [key])

  return display
}
