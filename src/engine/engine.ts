import {
  AUCTION_SECONDS,
  AUCTION_STEP,
  BOARD,
  BOARD_SIZE,
  CHANCE,
  CHEST,
  HOTEL_LEVEL,
  JAIL_TILE,
  OWNABLE_TILES,
  TRANSPORT_TILES,
  groupTiles,
  type Card,
} from './data/board'
import { formatMoney as m } from './format'
import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  activePlayers,
  auctionBidders,
  auctionEligible,
  buildingCounts,
  findPlayer,
  groupHasBuildings,
  liquidationValue,
  ownableTile,
  ownedTiles,
  ownsWholeGroup,
  ranking,
  rentFor,
  sellBackValue,
  unmortgageCost,
  wealthTaxFor,
} from './rules'
import type {
  Action,
  ApplyResult,
  GameEvent,
  GameState,
  Player,
  PlayerId,
  PlayerSetup,
  PropertyState,
  Settings,
  Trade,
  TradeBundle,
} from './types'

const LOG_LIMIT = 200

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

export function initialState(
  players: PlayerSetup[],
  settings: Partial<Settings> = {},
  options: { now?: number } = {},
): GameState {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`Lakhpati needs ${MIN_PLAYERS}–${MAX_PLAYERS} players`)
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) {
    throw new Error('Player ids must be unique')
  }
  const merged: Settings = { ...DEFAULT_SETTINGS, ...settings }
  const now = options.now ?? 0
  const properties: Record<number, PropertyState> = {}
  for (const i of OWNABLE_TILES) properties[i] = { owner: null, level: 0, mortgaged: false }

  return {
    schema: 1,
    settings: merged,
    players: players.map((p) => ({
      ...p,
      cash: merged.startingCash,
      position: 0,
      inJail: false,
      jailAttempts: 0,
      jailPasses: 0,
      lapped: false,
      started: !merged.rollTwelveToStart,
      bankrupt: false,
      missNextTurn: false,
    })),
    properties,
    turn: newTurn(players[0].id),
    debts: [],
    auction: null,
    auctionQueue: [],
    trades: [],
    nextTradeId: 1,
    lastRoll: null,
    lastCard: null,
    log: [{ seq: 0, text: `Game started. ${players[0].name} goes first.` }],
    seq: 0,
    lastEvents: [],
    status: 'playing',
    winnerId: null,
    startedAt: now,
    endsAt: merged.timeLimitMinutes > 0 ? now + merged.timeLimitMinutes * 60_000 : 0,
  }
}

function newTurn(playerId: PlayerId): GameState['turn'] {
  return { playerId, phase: 'roll', doublesCount: 0, extraRoll: false, pendingTile: null, hasRolled: false }
}

/* ------------------------------------------------------------------ */
/* Context helpers                                                     */
/* ------------------------------------------------------------------ */

class RuleError extends Error {}

interface Ctx {
  s: GameState
  events: GameEvent[]
  now: number
}

function fail(message: string): never {
  throw new RuleError(message)
}

function log(ctx: Ctx, text: string) {
  ctx.s.log.push({ seq: ctx.s.seq, text })
  if (ctx.s.log.length > LOG_LIMIT) ctx.s.log.splice(0, ctx.s.log.length - LOG_LIMIT)
}

function getPlayer(ctx: Ctx, id: PlayerId): Player {
  const p = findPlayer(ctx.s, id)
  if (!p) fail('Unknown player')
  return p
}

function name(ctx: Ctx, id: PlayerId | null): string {
  return id === null ? 'the bank' : (findPlayer(ctx.s, id)?.name ?? 'someone')
}

function tileName(i: number): string {
  return BOARD[i].name
}

function credit(ctx: Ctx, p: Player, amount: number, reason: string) {
  if (amount <= 0) return
  p.cash += amount
  ctx.events.push({ type: 'money', playerId: p.id, amount, reason })
}

function debit(ctx: Ctx, p: Player, amount: number, reason: string) {
  if (amount <= 0) return
  p.cash -= amount
  ctx.events.push({ type: 'money', playerId: p.id, amount: -amount, reason })
}

/**
 * Charge a player. Pays immediately if they have the cash (and no earlier
 * unpaid debt), otherwise queues a debt they must settle before play continues.
 */
function charge(
  ctx: Ctx,
  payerId: PlayerId,
  creditorId: PlayerId | null,
  amount: number,
  reason: string,
  text?: string,
) {
  if (amount <= 0) return
  const payer = getPlayer(ctx, payerId)
  const owesAlready = ctx.s.debts.some((d) => d.debtorId === payerId)
  if (!owesAlready && payer.cash >= amount) {
    transfer(ctx, payer, creditorId, amount, reason)
    log(ctx, text ?? `${payer.name} paid ${m(amount)} to ${name(ctx, creditorId)} (${reason}).`)
    return
  }
  ctx.s.debts.push({ debtorId: payerId, creditorId, amount, reason })
  log(ctx, `${payer.name} owes ${m(amount)} to ${name(ctx, creditorId)} (${reason}) and must raise funds.`)
}

function transfer(ctx: Ctx, payer: Player, creditorId: PlayerId | null, amount: number, reason: string) {
  debit(ctx, payer, amount, reason)
  if (creditorId !== null) credit(ctx, getPlayer(ctx, creditorId), amount, reason)
}

/* ------------------------------------------------------------------ */
/* Guards                                                              */
/* ------------------------------------------------------------------ */

function requireActive(ctx: Ctx, actorId: PlayerId): Player {
  const p = findPlayer(ctx.s, actorId)
  if (!p) fail('You are not in this game')
  if (p.bankrupt) fail('You are bankrupt')
  return p
}

/** Turn actions (roll, buy, end turn…): only the current player, with nothing else pending. */
function requireTurn(ctx: Ctx, actorId: PlayerId): Player {
  const p = requireActive(ctx, actorId)
  if (ctx.s.debts.length > 0) fail(`Waiting for ${name(ctx, ctx.s.debts[0].debtorId)} to settle a debt`)
  if (ctx.s.auction) fail('An auction is in progress')
  if (ctx.s.turn.playerId !== actorId) fail("It's not your turn")
  return p
}

/**
 * Property management. 'raise' (sell/mortgage) is also allowed for the player
 * currently settling a debt; 'spend' (build/unmortgage) only on your own turn.
 */
function requireManage(ctx: Ctx, actorId: PlayerId, kind: 'raise' | 'spend'): Player {
  const p = requireActive(ctx, actorId)
  if (ctx.s.auction) fail('An auction is in progress')
  if (ctx.s.debts.length > 0) {
    if (kind === 'raise' && ctx.s.debts[0].debtorId === actorId) return p
    if (ctx.s.debts[0].debtorId === actorId) fail('Settle your debt first')
    fail(`Waiting for ${name(ctx, ctx.s.debts[0].debtorId)} to settle a debt`)
  }
  if (ctx.s.turn.playerId !== actorId) fail('You can only do that on your turn')
  return p
}

function requireOwnedBy(ctx: Ctx, tile: number, id: PlayerId): PropertyState {
  const prop = ctx.s.properties[tile]
  if (!prop) fail('That tile cannot be owned')
  if (prop.owner !== id) fail(`You don't own ${tileName(tile)}`)
  return prop
}

/* ------------------------------------------------------------------ */
/* Movement and landing                                                */
/* ------------------------------------------------------------------ */

function passStart(ctx: Ctx, p: Player) {
  credit(ctx, p, ctx.s.settings.startSalary, 'Start salary')
  p.lapped = true
  log(ctx, `${p.name} passed Start and collected ${m(ctx.s.settings.startSalary)}.`)
}

function moveForward(ctx: Ctx, p: Player, steps: number, diceTotal: number) {
  const target = p.position + steps
  if (target >= BOARD_SIZE) passStart(ctx, p)
  p.position = target % BOARD_SIZE
  landOn(ctx, p, diceTotal, 1)
}

/** Advance (forward) to a specific tile, collecting salary if Start is passed or landed on. */
function advanceTo(ctx: Ctx, p: Player, tile: number, diceTotal: number, rentMultiplier = 1) {
  if (tile <= p.position) passStart(ctx, p)
  p.position = tile
  landOn(ctx, p, diceTotal, rentMultiplier)
}

function sendToJail(ctx: Ctx, p: Player) {
  p.position = JAIL_TILE
  p.inJail = true
  p.jailAttempts = 0
  if (ctx.s.turn.playerId === p.id) {
    ctx.s.turn.extraRoll = false
    ctx.s.turn.doublesCount = 0
    ctx.s.turn.pendingTile = null
  }
  ctx.events.push({ type: 'jail', playerId: p.id })
  log(ctx, `${p.name} went to Jail.`)
}

function othersOf(ctx: Ctx, p: Player): Player[] {
  return activePlayers(ctx.s).filter((o) => o.id !== p.id)
}

function landOn(ctx: Ctx, p: Player, diceTotal: number, rentMultiplier: number) {
  const tile = BOARD[p.position]
  const st = ctx.s.settings
  switch (tile.kind) {
    case 'start':
      return
    case 'jail':
      log(ctx, `${p.name} is just visiting Jail.`)
      return
    case 'city':
    case 'service':
      landOnOwnable(ctx, p, p.position, rentMultiplier)
      return
    case 'chance':
      drawCard(ctx, p, 'chance', diceTotal)
      return
    case 'chest':
      drawCard(ctx, p, 'chest', diceTotal)
      return
    case 'incomeTax':
      charge(ctx, p.id, null, st.incomeTax, 'Income Tax', `${p.name} paid ${m(st.incomeTax)} Income Tax.`)
      return
    case 'wealthTax': {
      const tax = wealthTaxFor(ctx.s, p.id)
      if (tax === 0) log(ctx, `${p.name} owes no Wealth Tax.`)
      else charge(ctx, p.id, null, tax, 'Wealth Tax', `${p.name} paid ${m(tax)} Wealth Tax.`)
      return
    }
    case 'club':
      log(ctx, `${p.name} is hosting at the Club.`)
      for (const o of othersOf(ctx, p)) charge(ctx, p.id, o.id, st.clubAmount, 'Club')
      return
    case 'restHouse':
      if (st.restHouseMode === 'skipTurn') {
        p.missNextTurn = true
        log(ctx, `${p.name} is resting and will miss their next turn.`)
      } else {
        log(ctx, `${p.name} is at the Rest House and collects from everyone.`)
        for (const o of othersOf(ctx, p)) charge(ctx, o.id, p.id, st.restHouseAmount, 'Rest House')
      }
      return
  }
}

function landOnOwnable(ctx: Ctx, p: Player, tile: number, rentMultiplier: number) {
  const prop = ctx.s.properties[tile]
  if (prop.owner === null) {
    if (ctx.s.settings.firstLapRule && !p.lapped) {
      log(ctx, `${p.name} landed on ${tileName(tile)} but can't buy until they pass Start.`)
      return
    }
    if (ctx.s.turn.playerId === p.id) ctx.s.turn.pendingTile = tile
    return
  }
  if (prop.owner === p.id) return
  if (prop.mortgaged) {
    log(ctx, `${tileName(tile)} is mortgaged — no rent due.`)
    return
  }
  const owner = getPlayer(ctx, prop.owner)
  let rent = rentFor(ctx.s, tile) * rentMultiplier
  if (owner.inJail && ctx.s.settings.jailHalfRent) rent = Math.floor(rent / 2)
  charge(
    ctx,
    p.id,
    owner.id,
    rent,
    `rent for ${tileName(tile)}`,
    `${p.name} paid ${m(rent)} rent to ${owner.name} for ${tileName(tile)}.`,
  )
}

function drawCard(ctx: Ctx, p: Player, deck: 'chance' | 'chest', diceTotal: number) {
  const card: Card | undefined = (deck === 'chance' ? CHANCE : CHEST)[diceTotal]
  if (!card) fail('No card for that roll')
  const reveal = {
    seq: ctx.s.seq,
    deck,
    roll: diceTotal,
    playerId: p.id,
    title: card.title,
    text: card.text,
  }
  ctx.s.lastCard = reveal
  ctx.events.push({ type: 'card', reveal })
  log(ctx, `${p.name} — ${deck === 'chance' ? 'Chance' : 'Community Chest'} (${diceTotal}): ${card.title}. ${card.text}`)

  const e = card.effect
  switch (e.type) {
    case 'collect':
      credit(ctx, p, e.amount, card.title)
      return
    case 'pay':
      charge(ctx, p.id, null, e.amount, card.title, `${p.name} paid ${m(e.amount)} (${card.title}).`)
      return
    case 'goToJail':
      sendToJail(ctx, p)
      return
    case 'nearestTransport': {
      const next =
        TRANSPORT_TILES.find((i) => i > p.position) ?? TRANSPORT_TILES[0]
      advanceTo(ctx, p, next, diceTotal, 2)
      return
    }
    case 'moveBack':
      p.position = (p.position - e.spaces + BOARD_SIZE) % BOARD_SIZE
      landOn(ctx, p, diceTotal, 1)
      return
    case 'repairs': {
      const { houses, hotels } = buildingCounts(ctx.s, p.id)
      const total = houses * e.perHouse + hotels * e.perHotel
      if (total === 0) log(ctx, `${p.name} has no buildings to repair.`)
      else charge(ctx, p.id, null, total, card.title, `${p.name} paid ${m(total)} for repairs.`)
      return
    }
    case 'moveTo':
      advanceTo(ctx, p, e.tile, diceTotal)
      return
    case 'jailPass':
      p.jailPasses += 1
      return
    case 'payEach':
      for (const o of othersOf(ctx, p)) charge(ctx, p.id, o.id, e.amount, card.title)
      return
    case 'collectEach':
      for (const o of othersOf(ctx, p)) charge(ctx, o.id, p.id, e.amount, card.title)
      return
  }
}

/** After movement resolves, decide what the current player does next. */
function settlePhase(ctx: Ctx) {
  const t = ctx.s.turn
  if (t.pendingTile !== null) t.phase = 'buy'
  else t.phase = t.extraRoll ? 'roll' : 'end'
}

/* ------------------------------------------------------------------ */
/* Auctions                                                            */
/* ------------------------------------------------------------------ */

function startAuction(ctx: Ctx, tile: number) {
  if (auctionEligible(ctx.s).length === 0) {
    log(ctx, `Nobody can bid on ${tileName(tile)}; it stays with the bank.`)
    return
  }
  ctx.s.auction = {
    tile,
    highBid: 0,
    highBidderId: null,
    endsAt: ctx.now + AUCTION_SECONDS * 1000,
    passed: [],
  }
  log(ctx, `${tileName(tile)} is up for auction.`)
}

function closeAuction(ctx: Ctx) {
  const a = ctx.s.auction
  if (!a) return
  ctx.s.auction = null
  if (a.highBidderId) {
    const winner = getPlayer(ctx, a.highBidderId)
    ctx.s.properties[a.tile].owner = winner.id
    charge(
      ctx,
      winner.id,
      null,
      a.highBid,
      `won ${tileName(a.tile)} at auction`,
      `${winner.name} won ${tileName(a.tile)} at auction for ${m(a.highBid)}.`,
    )
  } else {
    log(ctx, `No bids — ${tileName(a.tile)} stays with the bank.`)
  }
  startQueuedAuction(ctx)
}

function maybeFinishAuction(ctx: Ctx) {
  const a = ctx.s.auction
  if (!a) return
  const remaining = auctionBidders(ctx.s).filter((id) => id !== a.highBidderId)
  if (remaining.length === 0) closeAuction(ctx)
}

function startQueuedAuction(ctx: Ctx) {
  const s = ctx.s
  while (!s.auction && s.debts.length === 0 && s.auctionQueue.length > 0 && s.status === 'playing') {
    const tile = s.auctionQueue.shift() as number
    if (s.properties[tile].owner !== null) continue
    if (s.settings.auctions) startAuction(ctx, tile)
  }
}

/* ------------------------------------------------------------------ */
/* Turn flow, bankruptcy, game end                                     */
/* ------------------------------------------------------------------ */

function advanceTurn(ctx: Ctx) {
  const s = ctx.s
  const n = s.players.length
  let idx = s.players.findIndex((p) => p.id === s.turn.playerId)
  for (let guard = 0; guard < n * 2; guard++) {
    idx = (idx + 1) % n
    const next = s.players[idx]
    if (next.bankrupt) continue
    if (next.missNextTurn) {
      next.missNextTurn = false
      log(ctx, `${next.name} misses this turn.`)
      continue
    }
    s.turn = newTurn(next.id)
    log(ctx, `It's ${next.name}'s turn.`)
    return
  }
}

function finishGame(ctx: Ctx, winnerId: PlayerId | null, why: string) {
  const s = ctx.s
  s.status = 'finished'
  s.winnerId = winnerId
  s.auction = null
  s.auctionQueue = []
  s.debts = []
  s.trades = []
  ctx.events.push({ type: 'gameOver', winnerId })
  log(ctx, `${why} ${winnerId ? `${name(ctx, winnerId)} wins!` : 'The game is over.'}`)
}

function goBankrupt(ctx: Ctx, p: Player, creditorId: PlayerId | null) {
  const s = ctx.s
  // Sell every building back to the bank first.
  for (const i of ownedTiles(s, p.id)) {
    const t = ownableTile(i)
    const prop = s.properties[i]
    if (t.kind === 'city' && prop.level > 0) {
      p.cash += prop.level * sellBackValue(t)
      prop.level = 0
    }
  }
  const creditor = creditorId ? findPlayer(s, creditorId) : undefined
  if (creditor && !creditor.bankrupt) {
    if (p.cash > 0) credit(ctx, creditor, p.cash, `${p.name}'s bankruptcy`)
    for (const i of ownedTiles(s, p.id)) s.properties[i].owner = creditor.id
    creditor.jailPasses += p.jailPasses
    log(ctx, `${p.name} is bankrupt! Everything they own goes to ${creditor.name}.`)
  } else {
    for (const i of ownedTiles(s, p.id)) {
      s.properties[i] = { owner: null, level: 0, mortgaged: false }
      s.auctionQueue.push(i)
    }
    log(ctx, `${p.name} is bankrupt! Their properties return to the bank${s.settings.auctions ? ' for auction' : ''}.`)
  }
  if (p.cash > 0) ctx.events.push({ type: 'money', playerId: p.id, amount: -p.cash, reason: 'bankruptcy' })
  p.cash = 0
  p.jailPasses = 0
  p.bankrupt = true
  p.inJail = false
  p.missNextTurn = false
  ctx.events.push({ type: 'bankrupt', playerId: p.id })

  s.debts = s.debts.filter((d) => d.debtorId !== p.id && d.creditorId !== p.id)
  s.trades = s.trades.filter((t) => t.fromId !== p.id && t.toId !== p.id)

  const alive = activePlayers(s)
  if (alive.length <= 1) {
    finishGame(ctx, alive[0]?.id ?? null, 'Last player standing.')
    return
  }
  if (s.turn.playerId === p.id) advanceTurn(ctx)
  startQueuedAuction(ctx)
}

/* ------------------------------------------------------------------ */
/* Trades                                                              */
/* ------------------------------------------------------------------ */

function cleanBundle(b: TradeBundle): TradeBundle {
  const tiles = Array.isArray(b?.tiles) ? [...new Set(b.tiles)] : []
  const cash = Number.isInteger(b?.cash) ? b.cash : NaN
  const passes = Number.isInteger(b?.passes) ? b.passes : NaN
  return { tiles, cash, passes }
}

function validateBundle(ctx: Ctx, ownerId: PlayerId, b: TradeBundle): string | null {
  const p = findPlayer(ctx.s, ownerId)
  if (!p || p.bankrupt) return 'Player is no longer in the game'
  if (!(b.cash >= 0)) return 'Invalid cash amount'
  if (!(b.passes >= 0)) return 'Invalid pass count'
  if (b.cash > p.cash) return `${p.name} doesn't have ${m(b.cash)}`
  if (b.passes > p.jailPasses) return `${p.name} doesn't have enough jail passes`
  for (const i of b.tiles) {
    if (ctx.s.properties[i]?.owner !== ownerId) return `${p.name} doesn't own ${BOARD[i]?.name ?? 'that tile'}`
    if (groupHasBuildings(ctx.s, i)) return `Sell the buildings in ${tileName(i)}'s colour group before trading it`
  }
  return null
}

function validateTrade(ctx: Ctx, t: Trade): string | null {
  return validateBundle(ctx, t.fromId, t.give) ?? validateBundle(ctx, t.toId, t.get)
}

function createTrade(ctx: Ctx, fromId: PlayerId, toId: PlayerId, giveRaw: TradeBundle, getRaw: TradeBundle) {
  if (fromId === toId) fail("You can't trade with yourself")
  const to = findPlayer(ctx.s, toId)
  if (!to || to.bankrupt) fail('That player is not in the game')
  const give = cleanBundle(giveRaw)
  const get = cleanBundle(getRaw)
  const empty = (b: TradeBundle) => b.tiles.length === 0 && b.cash === 0 && b.passes === 0
  if (empty(give) && empty(get)) fail('A trade needs something in it')
  const trade: Trade = { id: ctx.s.nextTradeId++, fromId, toId, give, get }
  const err = validateTrade(ctx, trade)
  if (err) fail(err)
  ctx.s.trades.push(trade)
  return trade
}

function describeBundle(b: TradeBundle): string {
  const parts = b.tiles.map(tileName)
  if (b.cash > 0) parts.push(m(b.cash))
  if (b.passes > 0) parts.push(`${b.passes} jail pass${b.passes > 1 ? 'es' : ''}`)
  return parts.length ? parts.join(', ') : 'nothing'
}

function executeTrade(ctx: Ctx, t: Trade) {
  const from = getPlayer(ctx, t.fromId)
  const to = getPlayer(ctx, t.toId)
  for (const i of t.give.tiles) ctx.s.properties[i].owner = to.id
  for (const i of t.get.tiles) ctx.s.properties[i].owner = from.id
  if (t.give.cash > 0) transfer(ctx, from, to.id, t.give.cash, 'trade')
  if (t.get.cash > 0) transfer(ctx, to, from.id, t.get.cash, 'trade')
  from.jailPasses += t.get.passes - t.give.passes
  to.jailPasses += t.give.passes - t.get.passes
  log(ctx, `${from.name} traded ${describeBundle(t.give)} to ${to.name} for ${describeBundle(t.get)}.`)
}

function pruneTrades(ctx: Ctx) {
  ctx.s.trades = ctx.s.trades.filter((t) => validateTrade(ctx, t) === null)
}

function findTrade(ctx: Ctx, id: number): Trade {
  const t = ctx.s.trades.find((x) => x.id === id)
  if (!t) fail('That trade is no longer available')
  return t
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

function validDie(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 6
}

function handle(ctx: Ctx, action: Action, actorId: PlayerId) {
  const s = ctx.s
  const st = s.settings
  switch (action.type) {
    case 'roll': {
      const p = requireTurn(ctx, actorId)
      if (s.turn.phase !== 'roll') fail("You can't roll right now")
      const dice = action.dice
      if (!Array.isArray(dice) || dice.length !== 2 || !validDie(dice[0]) || !validDie(dice[1])) fail('Invalid dice')
      const [a, b] = dice
      const total = a + b
      const doubles = a === b
      s.turn.hasRolled = true
      s.lastRoll = { playerId: p.id, dice: [a, b], seq: s.seq }
      ctx.events.push({ type: 'dice', playerId: p.id, dice: [a, b] })
      log(ctx, `${p.name} rolled ${a} + ${b} = ${total}${doubles ? ' (doubles!)' : ''}.`)

      if (p.inJail) {
        s.turn.extraRoll = false
        if (doubles) {
          p.inJail = false
          p.jailAttempts = 0
          log(ctx, `${p.name} rolled doubles and walks out of Jail.`)
        } else {
          p.jailAttempts += 1
          if (p.jailAttempts < 3) {
            log(ctx, `${p.name} stays in Jail (attempt ${p.jailAttempts} of 3).`)
            s.turn.phase = 'end'
            return
          }
          p.inJail = false
          p.jailAttempts = 0
          charge(ctx, p.id, null, st.jailFine, 'Jail fine', `${p.name} paid the ${m(st.jailFine)} Jail fine after three tries.`)
        }
        moveForward(ctx, p, total, total)
        settlePhase(ctx)
        return
      }

      if (!p.started) {
        if (total !== 12) {
          log(ctx, `${p.name} needs a 12 to start moving.`)
          s.turn.phase = 'end'
          return
        }
        p.started = true
        log(ctx, `${p.name} rolled a 12 and is off!`)
      }

      if (doubles) {
        s.turn.doublesCount += 1
        if (s.turn.doublesCount >= 3) {
          log(ctx, `${p.name} rolled doubles three times in a row.`)
          sendToJail(ctx, p)
          s.turn.phase = 'end'
          return
        }
      }
      s.turn.extraRoll = doubles
      moveForward(ctx, p, total, total)
      settlePhase(ctx)
      return
    }

    case 'payJailFine': {
      const p = requireTurn(ctx, actorId)
      if (!p.inJail) fail("You're not in Jail")
      if (s.turn.phase !== 'roll') fail('You can only pay the fine before rolling')
      if (p.cash < st.jailFine) fail(`You need ${m(st.jailFine)} to pay the fine`)
      debit(ctx, p, st.jailFine, 'Jail fine')
      p.inJail = false
      p.jailAttempts = 0
      log(ctx, `${p.name} paid the ${m(st.jailFine)} fine and left Jail.`)
      return
    }

    case 'useJailPass': {
      const p = requireTurn(ctx, actorId)
      if (!p.inJail) fail("You're not in Jail")
      if (s.turn.phase !== 'roll') fail('You can only use a pass before rolling')
      if (p.jailPasses < 1) fail("You don't have a jail pass")
      p.jailPasses -= 1
      p.inJail = false
      p.jailAttempts = 0
      log(ctx, `${p.name} used a Get Out of Jail Free pass.`)
      return
    }

    case 'buy': {
      const p = requireTurn(ctx, actorId)
      const tile = s.turn.pendingTile
      if (s.turn.phase !== 'buy' || tile === null) fail('Nothing to buy')
      const t = ownableTile(tile)
      if (p.cash < t.price) fail(`You need ${m(t.price)} to buy ${t.name}`)
      debit(ctx, p, t.price, `bought ${t.name}`)
      s.properties[tile].owner = p.id
      log(ctx, `${p.name} bought ${t.name} for ${m(t.price)}.`)
      s.turn.pendingTile = null
      settlePhase(ctx)
      return
    }

    case 'decline': {
      const p = requireTurn(ctx, actorId)
      const tile = s.turn.pendingTile
      if (s.turn.phase !== 'buy' || tile === null) fail('Nothing to decline')
      log(ctx, `${p.name} decided not to buy ${tileName(tile)}.`)
      s.turn.pendingTile = null
      settlePhase(ctx)
      if (st.auctions) startAuction(ctx, tile)
      return
    }

    case 'bid': {
      const p = requireActive(ctx, actorId)
      const a = s.auction
      if (!a) fail('No auction is running')
      if (ctx.now > a.endsAt) fail('The auction has ended')
      if (!auctionEligible(s).includes(p.id)) fail("You can't bid until you've passed Start")
      if (a.passed.includes(p.id)) fail('You have already dropped out')
      if (a.highBidderId === p.id) fail("You're already the highest bidder")
      const amount = action.amount
      if (!Number.isInteger(amount) || amount % AUCTION_STEP !== 0) fail(`Bids go up in ${m(AUCTION_STEP)} steps`)
      if (amount < a.highBid + AUCTION_STEP) fail(`Bid at least ${m(a.highBid + AUCTION_STEP)}`)
      if (amount > p.cash) fail("You don't have that much cash")
      a.highBid = amount
      a.highBidderId = p.id
      a.endsAt = ctx.now + AUCTION_SECONDS * 1000
      log(ctx, `${p.name} bid ${m(amount)} for ${tileName(a.tile)}.`)
      maybeFinishAuction(ctx)
      return
    }

    case 'passAuction': {
      const p = requireActive(ctx, actorId)
      const a = s.auction
      if (!a) fail('No auction is running')
      if (!auctionEligible(s).includes(p.id)) fail("You're not in this auction")
      if (a.passed.includes(p.id)) fail('You have already dropped out')
      if (a.highBidderId === p.id) fail("You're the highest bidder")
      a.passed.push(p.id)
      log(ctx, `${p.name} dropped out of the auction.`)
      maybeFinishAuction(ctx)
      return
    }

    case 'closeAuction': {
      requireActive(ctx, actorId)
      const a = s.auction
      if (!a) fail('No auction is running')
      if (ctx.now < a.endsAt) fail('The auction is still running')
      closeAuction(ctx)
      return
    }

    case 'build': {
      const p = requireManage(ctx, actorId, 'spend')
      const prop = requireOwnedBy(ctx, action.tile, p.id)
      const t = ownableTile(action.tile)
      if (t.kind !== 'city') fail('You can only build on cities')
      if (!ownsWholeGroup(s, action.tile, p.id)) fail('You need the whole colour group to build')
      const group = groupTiles(t.group)
      if (group.some((i) => s.properties[i].mortgaged)) fail('Unmortgage the colour group before building')
      if (prop.level >= HOTEL_LEVEL) fail(`${t.name} already has a hotel`)
      const minLevel = Math.min(...group.map((i) => s.properties[i].level))
      if (prop.level > minLevel) fail('Build evenly across the colour group')
      if (p.cash < t.houseCost) fail(`You need ${m(t.houseCost)} to build`)
      debit(ctx, p, t.houseCost, `building on ${t.name}`)
      prop.level += 1
      log(ctx, `${p.name} built a ${prop.level === HOTEL_LEVEL ? 'hotel' : 'house'} on ${t.name} for ${m(t.houseCost)}.`)
      return
    }

    case 'sellBuilding': {
      const p = requireManage(ctx, actorId, 'raise')
      const prop = requireOwnedBy(ctx, action.tile, p.id)
      const t = ownableTile(action.tile)
      if (t.kind !== 'city' || prop.level === 0) fail('No buildings to sell there')
      const maxLevel = Math.max(...groupTiles(t.group).map((i) => s.properties[i].level))
      if (prop.level < maxLevel) fail('Sell evenly across the colour group')
      const wasHotel = prop.level === HOTEL_LEVEL
      prop.level -= 1
      const refund = sellBackValue(t)
      credit(ctx, p, refund, `sold a building on ${t.name}`)
      log(ctx, `${p.name} sold a ${wasHotel ? 'hotel' : 'house'} on ${t.name} for ${m(refund)}.`)
      return
    }

    case 'mortgage': {
      const p = requireManage(ctx, actorId, 'raise')
      const prop = requireOwnedBy(ctx, action.tile, p.id)
      const t = ownableTile(action.tile)
      if (prop.mortgaged) fail(`${t.name} is already mortgaged`)
      if (groupHasBuildings(s, action.tile)) fail('Sell the buildings in this colour group first')
      prop.mortgaged = true
      credit(ctx, p, t.mortgage, `mortgaged ${t.name}`)
      log(ctx, `${p.name} mortgaged ${t.name} for ${m(t.mortgage)}.`)
      return
    }

    case 'unmortgage': {
      const p = requireManage(ctx, actorId, 'spend')
      const prop = requireOwnedBy(ctx, action.tile, p.id)
      const t = ownableTile(action.tile)
      if (!prop.mortgaged) fail(`${t.name} isn't mortgaged`)
      const cost = unmortgageCost(action.tile)
      if (p.cash < cost) fail(`You need ${m(cost)} to unmortgage`)
      debit(ctx, p, cost, `unmortgaged ${t.name}`)
      prop.mortgaged = false
      log(ctx, `${p.name} paid ${m(cost)} to unmortgage ${t.name}.`)
      return
    }

    case 'proposeTrade': {
      const p = requireActive(ctx, actorId)
      if (s.auction) fail('Wait for the auction to finish')
      const t = createTrade(ctx, p.id, action.toId, action.give, action.get)
      log(ctx, `${p.name} offered ${name(ctx, t.toId)} a trade: ${describeBundle(t.give)} for ${describeBundle(t.get)}.`)
      return
    }

    case 'respondTrade': {
      const p = requireActive(ctx, actorId)
      const t = findTrade(ctx, action.tradeId)
      if (t.toId !== p.id) fail('That trade was not offered to you')
      if (!action.accept) {
        s.trades = s.trades.filter((x) => x.id !== t.id)
        log(ctx, `${p.name} turned down ${name(ctx, t.fromId)}'s trade.`)
        return
      }
      if (s.auction) fail('Wait for the auction to finish')
      const err = validateTrade(ctx, t)
      if (err) fail(err)
      s.trades = s.trades.filter((x) => x.id !== t.id)
      executeTrade(ctx, t)
      pruneTrades(ctx)
      return
    }

    case 'counterTrade': {
      const p = requireActive(ctx, actorId)
      if (s.auction) fail('Wait for the auction to finish')
      const t = findTrade(ctx, action.tradeId)
      if (t.toId !== p.id) fail('That trade was not offered to you')
      s.trades = s.trades.filter((x) => x.id !== t.id)
      const counter = createTrade(ctx, p.id, t.fromId, action.give, action.get)
      log(ctx, `${p.name} countered: ${describeBundle(counter.give)} for ${describeBundle(counter.get)}.`)
      return
    }

    case 'cancelTrade': {
      const p = requireActive(ctx, actorId)
      const t = findTrade(ctx, action.tradeId)
      if (t.fromId !== p.id) fail('Only the proposer can withdraw a trade')
      s.trades = s.trades.filter((x) => x.id !== t.id)
      log(ctx, `${p.name} withdrew their trade offer.`)
      return
    }

    case 'payDebt': {
      const p = requireActive(ctx, actorId)
      const d = s.debts[0]
      if (!d || d.debtorId !== p.id) fail("You don't have a debt to settle right now")
      if (p.cash < d.amount) fail(`You need ${m(d.amount - p.cash)} more`)
      s.debts.shift()
      transfer(ctx, p, d.creditorId, d.amount, d.reason)
      log(ctx, `${p.name} paid ${m(d.amount)} to ${name(ctx, d.creditorId)} (${d.reason}).`)
      startQueuedAuction(ctx)
      return
    }

    case 'declareBankruptcy': {
      const p = requireActive(ctx, actorId)
      const d = s.debts[0]
      if (!d || d.debtorId !== p.id) fail('You can only declare bankruptcy while settling a debt')
      const reachable = p.cash + liquidationValue(s, p.id)
      if (reachable >= d.amount) fail(`You can still raise ${m(reachable)} by selling buildings and mortgaging`)
      goBankrupt(ctx, p, d.creditorId)
      return
    }

    case 'endTurn': {
      requireTurn(ctx, actorId)
      if (s.turn.phase !== 'end') fail(s.turn.phase === 'roll' ? 'Roll first' : 'Decide whether to buy first')
      advanceTurn(ctx)
      return
    }

    case 'endByTime': {
      requireActive(ctx, actorId)
      if (s.endsAt === 0) fail('This game has no time limit')
      if (ctx.now < s.endsAt) fail("Time isn't up yet")
      const top = ranking(s)[0]
      finishGame(ctx, top?.player.id ?? null, "Time's up! Highest net worth wins.")
      return
    }

    default:
      fail('Unknown action')
  }
}

/**
 * Apply an action. Pure: the input state is never mutated.
 * Returns the next state and the events it produced, or an error message.
 */
export function applyAction(state: GameState, action: Action, actorId: PlayerId): ApplyResult {
  if (state.status !== 'playing') return { error: 'The game is over' }
  const s: GameState = structuredClone(state)
  s.seq += 1
  const ctx: Ctx = { s, events: [], now: typeof action.now === 'number' ? action.now : 0 }
  try {
    handle(ctx, action, actorId)
  } catch (e) {
    if (e instanceof RuleError) return { error: e.message }
    throw e
  }
  s.lastEvents = ctx.events
  return { state: s, events: ctx.events }
}

/** True if the action would be accepted right now (used by the UI to show only legal buttons). */
export function isLegal(state: GameState, action: Action, actorId: PlayerId): boolean {
  return !('error' in applyAction(state, action, actorId))
}
