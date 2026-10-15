import { useEffect, useState } from 'react'
import type { GameState } from '../../engine'
import { buildPlayback } from '../playback'

/**
 * False while the latest move is still playing out on screen (dice, walking, cards),
 * so decisions like Buy only appear once the pawn has arrived and everything is shown.
 */
export function useSettled(state: GameState): boolean {
  const [track, setTrack] = useState({ seq: state.seq, busySeq: null as number | null, wait: 0 })

  // Adjust during render (not in an effect) so the Buy button never flashes up first.
  if (state.seq !== track.seq) {
    const wait = state.seq > track.seq ? buildPlayback(state.lastEvents).settledAt : 0
    // Actions with nothing to show (a trade offer, a bid) don't cut a playback short.
    setTrack(wait > 0 ? { seq: state.seq, busySeq: state.seq, wait } : { ...track, seq: state.seq })
  }

  const { busySeq, wait } = track
  useEffect(() => {
    if (busySeq === null) return
    const t = setTimeout(() => setTrack((cur) => (cur.busySeq === busySeq ? { ...cur, busySeq: null } : cur)), wait)
    return () => clearTimeout(t)
  }, [busySeq, wait])

  return busySeq === null
}
