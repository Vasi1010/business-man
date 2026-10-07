import {
  BOARD,
  OWNABLE_TILES,
  SPECIAL_DEFAULTS,
  UNMORTGAGE_INTEREST,
  groupTiles,
  isOwnable,
  type CityTile,
  type OwnableTile,
} from './data/board'
import type { GameState, Player, PlayerId, Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  firstLapRule: false,
  auctions: false,
  restHouseMode: 'collect',
  wealthTaxMode: 'perBuilding',
  jailHalfRent: false,
  rollTwelveToStart: false,
  timeLimitMinutes: 0,
  ...SPECIAL_DEFAULTS,
}

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 6

export function ownableTile(index: number): OwnableTile {
  const t = BOARD[index]
  if (!t || !isOwnable(t)) throw new Error(`Tile ${index} is not ownable`)
  return t
}

export function findPlayer(s: GameState, id: PlayerId): Player | undefined {
  return s.players.find((p) => p.id === id)
}

export function activePlayers(s: GameState): Player[] {
  return s.players.filter((p) => !p.bankrupt)
}

export function ownedTiles(s: GameState, id: PlayerId): number[] {
  return OWNABLE_TILES.filter((i) => s.properties[i]?.owner === id)
}

export function ownsWholeGroup(s: GameState, tileIndex: number, ownerId: PlayerId): boolean {
  const t = BOARD[tileIndex]
  if (t?.kind !== 'city') return false
  return groupTiles(t.group).every((i) => s.properties[i]?.owner === ownerId)
}

export function groupHasBuildings(s: GameState, tileIndex: number): boolean {
  const t = BOARD[tileIndex]
  if (t?.kind !== 'city') return false
  return groupTiles(t.group).some((i) => (s.properties[i]?.level ?? 0) > 0)
}

/** Rent owed when landing on an owned, unmortgaged tile (before multipliers). */
export function rentFor(s: GameState, tileIndex: number): number {
  const prop = s.properties[tileIndex]
  if (!prop || prop.owner === null || prop.mortgaged) return 0
  const t = ownableTile(tileIndex)
  if (t.kind === 'city') {
    if (prop.level > 0) return t.rents[prop.level]
    return ownsWholeGroup(s, tileIndex, prop.owner) ? t.rents[0] * 2 : t.rents[0]
  }
  return s.properties[t.pair]?.owner === prop.owner ? t.pairRent : t.rent
}

export function unmortgageCost(tileIndex: number): number {
  return Math.round(ownableTile(tileIndex).mortgage * (1 + UNMORTGAGE_INTEREST))
}

export function sellBackValue(t: CityTile): number {
  return Math.floor(t.houseCost / 2)
}

export function buildingCounts(s: GameState, id: PlayerId): { houses: number; hotels: number } {
  let houses = 0
  let hotels = 0
  for (const i of ownedTiles(s, id)) {
    const level = s.properties[i].level
    if (level === 4) hotels++
    else houses += level
  }
  return { houses, hotels }
}

export function wealthTaxFor(s: GameState, id: PlayerId): number {
  if (s.settings.wealthTaxMode === 'percent') {
    const total = ownedTiles(s, id).reduce((sum, i) => sum + ownableTile(i).price, 0)
    return Math.round((total * s.settings.wealthTaxPercent) / 100)
  }
  const { houses, hotels } = buildingCounts(s, id)
  return houses * s.settings.wealthTaxPerHouse + hotels * s.settings.wealthTaxPerHotel
}

/** Cash + property prices (mortgaged at half) + money invested in buildings. */
export function netWorth(s: GameState, id: PlayerId): number {
  const p = findPlayer(s, id)
  if (!p || p.bankrupt) return 0
  let total = p.cash
  for (const i of ownedTiles(s, id)) {
    const t = ownableTile(i)
    const prop = s.properties[i]
    total += prop.mortgaged ? Math.floor(t.price / 2) : t.price
    if (t.kind === 'city') total += prop.level * t.houseCost
  }
  return total
}

/** Extra cash a player could raise by selling every building and mortgaging every tile. */
export function liquidationValue(s: GameState, id: PlayerId): number {
  let total = 0
  for (const i of ownedTiles(s, id)) {
    const t = ownableTile(i)
    const prop = s.properties[i]
    if (t.kind === 'city') total += prop.level * sellBackValue(t)
    if (!prop.mortgaged) total += t.mortgage
  }
  return total
}

/** Players ranked by net worth, highest first. Bankrupt players go last. */
export function ranking(s: GameState): { player: Player; worth: number }[] {
  return s.players
    .map((player) => ({ player, worth: netWorth(s, player.id) }))
    .sort((a, b) => {
      if (a.player.bankrupt !== b.player.bankrupt) return a.player.bankrupt ? 1 : -1
      return b.worth - a.worth
    })
}

/** Who the game is currently waiting on (for "whose turn" indicators). */
export function waitingOn(s: GameState): PlayerId[] {
  if (s.status !== 'playing') return []
  if (s.debts.length > 0) return [s.debts[0].debtorId]
  if (s.auction) return auctionBidders(s).filter((id) => id !== s.auction?.highBidderId)
  return [s.turn.playerId]
}

/** Players allowed to bid in the current/next auction. */
export function auctionEligible(s: GameState): PlayerId[] {
  return activePlayers(s)
    .filter((p) => !s.settings.firstLapRule || p.lapped)
    .map((p) => p.id)
}

/** Eligible bidders who have not passed. */
export function auctionBidders(s: GameState): PlayerId[] {
  const passed = s.auction?.passed ?? []
  return auctionEligible(s).filter((id) => !passed.includes(id))
}
