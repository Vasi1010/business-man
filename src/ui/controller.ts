import { createContext, useContext } from 'react'
import { waitingOn, type Action, type GameState, type PlayerId } from '../engine'

/** What the game screen needs, whether the game runs locally or over Supabase. */
export interface GameController {
  mode: 'local' | 'online'
  state: GameState
  /** The signed-in player (online). null in pass-and-play, where everyone shares the device. */
  meId: PlayerId | null
  /** Player ids currently connected (online only). */
  onlineIds: Set<string> | null
  /**
   * Submit an action. Resolves to an error message, or null on success.
   * Errors are shown as a toast unless `silent` is set.
   */
  dispatch: (action: Action, actorId: PlayerId, opts?: { silent?: boolean }) => Promise<string | null>
  roomCode?: string
  isHost?: boolean
  connection?: 'connected' | 'reconnecting'
  playAgain: () => void
  leave: () => void
}

export const ControllerContext = createContext<GameController | null>(null)

export function useController(): GameController {
  const c = useContext(ControllerContext)
  if (!c) throw new Error('No game controller')
  return c
}

/**
 * Whose perspective the UI shows: the signed-in player online, or in
 * pass-and-play whoever the game is waiting on (the turn player during auctions).
 */
export function perspectiveId(state: GameState, meId: PlayerId | null): PlayerId {
  if (meId) return meId
  if (state.auction) return state.turn.playerId
  return waitingOn(state)[0] ?? state.turn.playerId
}

export function canAct(c: GameController, playerId: PlayerId): boolean {
  return c.meId === null || c.meId === playerId
}
