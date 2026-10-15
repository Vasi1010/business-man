import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../../engine'
import { buildPlayback, type Playback } from '../playback'
import { sfx } from '../sound'

export interface TokenMotion {
  /** Tile each token is currently drawn on. */
  positions: Record<string, number>
  /** Increments on every hop, so the token can replay its hop animation. */
  hops: Record<string, number>
  /** Duration of the current hop for each moving player (ms). */
  stepMs: Record<string, number>
}

const settledPositions = (s: GameState) => Object.fromEntries(s.players.map((p) => [p.id, p.position]))

/**
 * Board positions for drawing tokens. Each move from the latest action is replayed
 * in order (dice walk, then any card move or trip to Jail), tile by tile.
 */
export function useAnimatedPositions(state: GameState): TokenMotion {
  const [motion, setMotion] = useState<TokenMotion>(() => ({ positions: settledPositions(state), hops: {}, stepMs: {} }))
  const motionRef = useRef(motion)
  const stateRef = useRef(state)
  // Don't replay whatever happened before this screen opened.
  const seenSeq = useRef(state.seq)
  useEffect(() => {
    stateRef.current = state
  })

  const commit = (next: TokenMotion) => {
    motionRef.current = next
    setMotion(next)
  }

  // Only actions that move a pawn restart the animation; positions catch anything else
  // (e.g. a new game). Unrelated updates like a trade offer don't disturb a walk in progress.
  const moveSeq = state.lastEvents.some((e) => e.type === 'move') ? state.seq : -1
  const key = state.players.map((p) => `${p.id}:${p.position}:${p.bankrupt ? 1 : 0}`).join('|')

  useEffect(() => {
    const s = stateRef.current
    const fresh = moveSeq > seenSeq.current
    seenSeq.current = Math.max(seenSeq.current, moveSeq)
    const plan: Playback = fresh ? buildPlayback(s.lastEvents) : { moves: [], at: [], card: null, settledAt: 0 }
    const timers: ReturnType<typeof setTimeout>[] = []

    // Pawns that move start from where this action began; everyone else sits where they are.
    const start: Record<string, number> = {}
    for (const p of s.players) {
      const first = s.lastEvents.find((e) => e.type === 'move' && e.playerId === p.id)
      start[p.id] = fresh && first?.type === 'move' ? first.from : p.position
    }
    commit({ ...motionRef.current, positions: start })

    for (const m of plan.moves) {
      m.path.forEach((tile, i) => {
        timers.push(
          setTimeout(
            () => {
              const cur = motionRef.current
              commit({
                positions: { ...cur.positions, [m.playerId]: tile },
                hops: { ...cur.hops, [m.playerId]: (cur.hops[m.playerId] ?? 0) + 1 },
                stepMs: { ...cur.stepMs, [m.playerId]: m.stepMs },
              })
              if (m.how !== 'jail') sfx.step()
            },
            m.start + i * m.stepMs,
          ),
        )
      })
    }
    // Whatever happens, end up exactly where the game says.
    timers.push(
      setTimeout(() => commit({ ...motionRef.current, positions: settledPositions(stateRef.current) }), plan.settledAt),
    )
    return () => timers.forEach(clearTimeout)
  }, [moveSeq, key])

  return motion
}
