import { BOARD, type GameState } from '../engine'

/** What the board centre says about the game right now. */
export function boardStatus(state: GameState): string {
  const current = state.players.find((p) => p.id === state.turn.playerId)
  if (state.status === 'finished') return 'Game over'
  if (state.debts.length > 0) return `${state.players.find((p) => p.id === state.debts[0].debtorId)?.name} is settling a debt`
  if (state.auction) return `Auction: ${BOARD[state.auction.tile].name}`
  return `${current?.name}'s turn`
}

