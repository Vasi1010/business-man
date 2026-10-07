import { useEffect, useRef, useState } from 'react'
import { BOARD_SIZE, JAIL_TILE, type Player } from '../../engine'
import { sfx } from '../sound'

/** Wait for the dice tumble to finish before the token sets off. */
export const START_DELAY_MS = 650
const MIN_WALK_MS = 1000
const MAX_WALK_MS = 3000
const PER_STEP_MS = 230

export interface TokenMotion {
  /** Tile each token is currently drawn on. */
  positions: Record<string, number>
  /** Increments on every hop, so the token can replay its hop animation. */
  hops: Record<string, number>
  /** Duration of the current hop for each moving player (ms). */
  stepMs: Record<string, number>
}

/** How long after a roll the token arrives on its tile. */
export function arrivalDelay(steps: number): number {
  return START_DELAY_MS + walkDuration(steps) + 100
}

/** Total walk time: 1–3 seconds depending on distance. */
export function walkDuration(steps: number): number {
  return Math.min(MAX_WALK_MS, Math.max(MIN_WALK_MS, steps * PER_STEP_MS))
}

/**
 * Board positions for drawing tokens. Tokens hop tile by tile towards each
 * player's real position; going to Jail jumps straight there.
 */
export function useAnimatedPositions(players: Player[]): TokenMotion {
  const [motion, setMotion] = useState<TokenMotion>(() => ({
    positions: Object.fromEntries(players.map((p) => [p.id, p.position])),
    hops: {},
    stepMs: {},
  }))
  const motionRef = useRef(motion)
  const playersRef = useRef(players)
  useEffect(() => {
    playersRef.current = players
  })

  const key = players.map((p) => `${p.id}:${p.position}:${p.inJail ? 1 : 0}:${p.bankrupt ? 1 : 0}`).join('|')

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const commit = (next: TokenMotion) => {
      motionRef.current = next
      setMotion(next)
    }

    for (const p of playersRef.current) {
      const from = motionRef.current.positions[p.id]
      if (from === undefined || p.bankrupt || from === p.position) {
        if (from !== p.position) commit({ ...motionRef.current, positions: { ...motionRef.current.positions, [p.id]: p.position } })
        continue
      }
      // Sent to Jail: no walk.
      if (p.inJail && p.position === JAIL_TILE) {
        commit({ ...motionRef.current, positions: { ...motionRef.current.positions, [p.id]: JAIL_TILE } })
        continue
      }
      const forward = (p.position - from + BOARD_SIZE) % BOARD_SIZE
      const backwards = forward > BOARD_SIZE - 4 // "Go back 3 spaces"
      const steps = backwards ? BOARD_SIZE - forward : forward
      const stepMs = walkDuration(steps) / steps
      for (let i = 1; i <= steps; i++) {
        timers.push(
          setTimeout(
            () => {
              const cur = motionRef.current
              const tile = (from + (backwards ? -i : i) + BOARD_SIZE) % BOARD_SIZE
              commit({
                positions: { ...cur.positions, [p.id]: tile },
                hops: { ...cur.hops, [p.id]: (cur.hops[p.id] ?? 0) + 1 },
                stepMs: { ...cur.stepMs, [p.id]: stepMs },
              })
              sfx.step()
            },
            START_DELAY_MS + (i - 1) * stepMs,
          ),
        )
      }
    }
    // If the state changes mid-walk, the next run continues from wherever the token is drawn.
    return () => timers.forEach(clearTimeout)
  }, [key])

  return motion
}
