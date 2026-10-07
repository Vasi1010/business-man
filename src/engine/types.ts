export type PlayerId = string

export type TokenId = 'auto' | 'elephant' | 'peacock' | 'tiger' | 'diya' | 'houseboat'

export interface PlayerSetup {
  id: PlayerId
  name: string
  token: TokenId
  color: string
}

export interface Player extends PlayerSetup {
  cash: number
  position: number
  inJail: boolean
  /** Failed doubles attempts during the current jail stay. */
  jailAttempts: number
  jailPasses: number
  /** True once the player has passed (or landed on) Start at least once. */
  lapped: boolean
  /** "Roll a 12 to start moving" house rule. */
  started: boolean
  bankrupt: boolean
  missNextTurn: boolean
}

export type RestHouseMode = 'collect' | 'skipTurn'
export type WealthTaxMode = 'perBuilding' | 'percent'

export interface Settings {
  firstLapRule: boolean
  auctions: boolean
  restHouseMode: RestHouseMode
  wealthTaxMode: WealthTaxMode
  jailHalfRent: boolean
  rollTwelveToStart: boolean
  startingCash: number
  startSalary: number
  /** 0 = no limit. */
  timeLimitMinutes: number
  incomeTax: number
  wealthTaxPerHouse: number
  wealthTaxPerHotel: number
  wealthTaxPercent: number
  clubAmount: number
  restHouseAmount: number
  jailFine: number
}

export interface PropertyState {
  owner: PlayerId | null
  /** 0 = site, 1–3 houses, 4 = hotel. */
  level: number
  mortgaged: boolean
}

export type TurnPhase = 'roll' | 'buy' | 'end'

export interface TurnState {
  playerId: PlayerId
  phase: TurnPhase
  doublesCount: number
  /** The current player rolled doubles and gets another roll after resolving this one. */
  extraRoll: boolean
  /** Tile awaiting a buy/decline decision during phase 'buy'. */
  pendingTile: number | null
  /** Set once the player has rolled at least once this turn. */
  hasRolled: boolean
}

export interface Debt {
  debtorId: PlayerId
  /** null = the bank */
  creditorId: PlayerId | null
  amount: number
  reason: string
}

export interface Auction {
  tile: number
  highBid: number
  highBidderId: PlayerId | null
  endsAt: number
  passed: PlayerId[]
}

export interface TradeBundle {
  tiles: number[]
  cash: number
  passes: number
}

export interface Trade {
  id: number
  fromId: PlayerId
  toId: PlayerId
  /** What the proposer gives. */
  give: TradeBundle
  /** What the proposer wants in return. */
  get: TradeBundle
}

export interface LogEntry {
  seq: number
  text: string
}

export interface CardReveal {
  seq: number
  deck: 'chance' | 'chest'
  roll: number
  playerId: PlayerId
  title: string
  text: string
}

export type GameEvent =
  | { type: 'money'; playerId: PlayerId; amount: number; reason: string }
  | { type: 'dice'; playerId: PlayerId; dice: [number, number] }
  | { type: 'card'; reveal: CardReveal }
  | { type: 'jail'; playerId: PlayerId }
  | { type: 'bankrupt'; playerId: PlayerId }
  | { type: 'gameOver'; winnerId: PlayerId | null }

export interface GameState {
  schema: 1
  settings: Settings
  players: Player[]
  /** Keyed by board index (ownable tiles only). */
  properties: Record<number, PropertyState>
  turn: TurnState
  debts: Debt[]
  auction: Auction | null
  /** Tiles waiting to be auctioned (e.g. after bankruptcy to the bank). */
  auctionQueue: number[]
  trades: Trade[]
  nextTradeId: number
  lastRoll: { playerId: PlayerId; dice: [number, number]; seq: number } | null
  lastCard: CardReveal | null
  log: LogEntry[]
  /** Increments on every successful action. */
  seq: number
  /** Events produced by the most recent action (for toasts/sounds on remote clients). */
  lastEvents: GameEvent[]
  status: 'playing' | 'finished'
  winnerId: PlayerId | null
  startedAt: number
  /** 0 = no time limit. */
  endsAt: number
}

export type Action =
  | { type: 'roll'; dice: [number, number]; now?: number }
  | { type: 'payJailFine'; now?: number }
  | { type: 'useJailPass'; now?: number }
  | { type: 'buy'; now?: number }
  | { type: 'decline'; now: number }
  | { type: 'bid'; amount: number; now: number }
  | { type: 'passAuction'; now?: number }
  | { type: 'closeAuction'; now: number }
  | { type: 'build'; tile: number; now?: number }
  | { type: 'sellBuilding'; tile: number; now?: number }
  | { type: 'mortgage'; tile: number; now?: number }
  | { type: 'unmortgage'; tile: number; now?: number }
  | { type: 'proposeTrade'; toId: PlayerId; give: TradeBundle; get: TradeBundle; now?: number }
  | { type: 'respondTrade'; tradeId: number; accept: boolean; now?: number }
  | { type: 'counterTrade'; tradeId: number; give: TradeBundle; get: TradeBundle; now?: number }
  | { type: 'cancelTrade'; tradeId: number; now?: number }
  | { type: 'payDebt'; now?: number }
  | { type: 'declareBankruptcy'; now: number }
  | { type: 'endTurn'; now?: number }
  | { type: 'endByTime'; now: number }

export type ApplyResult = { state: GameState; events: GameEvent[] } | { error: string }
