import { useState } from 'react'
import {
  AUCTION_SECONDS,
  AUCTION_STEP,
  BOARD,
  formatMoney,
  isLegal,
  liquidationValue,
  ownableTile,
  ownedTiles,
  rentFor,
  type Action,
  type GameState,
  type Player,
  type PlayerId,
} from '../../engine'
import { canAct, useController, type GameController } from '../controller'
import { rollDice } from '../dice'
import { useNow } from '../hooks/useNow'
import { TokenBadge } from './Art'
import { Button, Panel } from './ui'


function playerOf(s: GameState, id: PlayerId | null): Player | undefined {
  return id ? s.players.find((p) => p.id === id) : undefined
}

/** Render-time legality check. Time-sensitive actions pass their own `now`. */
function legal(s: GameState, action: Action, actor: PlayerId) {
  return isLegal(s, action, actor)
}

function Waiting({ player, what }: { player: Player | undefined; what: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      {player && <TokenBadge token={player.token} color={player.color} size={34} />}
      <p className="text-muted">
        Waiting for <strong className="text-ink">{player?.name ?? 'someone'}</strong> {what}…
      </p>
    </div>
  )
}

function useSubmit() {
  const c = useController()
  const [busy, setBusy] = useState(false)
  const submit = async (action: Action, actor: PlayerId) => {
    setBusy(true)
    try {
      await c.dispatch(action, actor)
    } finally {
      setBusy(false)
    }
  }
  return { busy, submit }
}

/** One-tap ways to raise cash while settling a debt. */
function RaiseFunds({
  playerId,
  busy,
  submit,
}: {
  playerId: PlayerId
  busy: boolean
  submit: (a: Action, actor: PlayerId) => Promise<void>
}) {
  const { state: s } = useController()
  const rows = ownedTiles(s, playerId).flatMap((tile) => {
    const t = ownableTile(tile)
    const options: { label: string; action: Action }[] = []
    if (t.kind === 'city' && legal(s, { type: 'sellBuilding', tile }, playerId))
      options.push({ label: `Sell building +${formatMoney(Math.floor(t.houseCost / 2))}`, action: { type: 'sellBuilding', tile } })
    if (legal(s, { type: 'mortgage', tile }, playerId))
      options.push({ label: `Mortgage +${formatMoney(t.mortgage)}`, action: { type: 'mortgage', tile } })
    return options.length ? [{ tile, name: t.name, options }] : []
  })
  if (rows.length === 0) return null
  return (
    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-2 text-sm">
      {rows.map((r) => (
        <li key={r.tile} className="flex flex-wrap items-center gap-1.5">
          <span className="min-w-24 flex-1 font-semibold">{r.name}</span>
          {r.options.map((o) => (
            <Button key={o.action.type} size="sm" disabled={busy} onClick={() => void submit(o.action, playerId)}>
              {o.label}
            </Button>
          ))}
        </li>
      ))}
    </ul>
  )
}

function DebtPanel({ c }: { c: GameController }) {
  const s = c.state
  const d = s.debts[0]
  const debtor = playerOf(s, d.debtorId)
  const { busy, submit } = useSubmit()
  if (!debtor) return null
  if (!canAct(c, d.debtorId)) return <Waiting player={debtor} what={`to settle a ${formatMoney(d.amount)} debt`} />
  const creditor = d.creditorId ? playerOf(s, d.creditorId)?.name : 'the bank'
  const short = d.amount - debtor.cash
  const canBankrupt = legal(s, { type: 'declareBankruptcy', now: 0 }, d.debtorId)
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wider text-bad">{c.meId ? 'You owe money' : `${debtor.name} owes money`}</p>
      <p className="mt-1 text-lg">
        <strong>{formatMoney(d.amount)}</strong> to <strong>{creditor}</strong> <span className="text-muted">({d.reason})</span>
      </p>
      {short > 0 ? (
        <p className="mt-1 text-sm text-muted">
          Cash {formatMoney(debtor.cash)} — raise <strong className="text-ink">{formatMoney(short)}</strong> more by selling buildings,
          mortgaging (tap your properties) or trading. You could raise up to {formatMoney(liquidationValue(s, debtor.id))}.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">You have enough cash to pay.</p>
      )}
      {short > 0 && <RaiseFunds playerId={debtor.id} busy={busy} submit={submit} />}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" size="lg" disabled={busy || short > 0} onClick={() => submit({ type: 'payDebt' }, d.debtorId)}>
          Pay {formatMoney(d.amount)}
        </Button>
        {canBankrupt && (
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Declare bankruptcy? Everything ${debtor.name} owns goes to ${creditor}.`))
                void submit({ type: 'declareBankruptcy', now: Date.now() }, d.debtorId)
            }}
          >
            Declare bankruptcy
          </Button>
        )}
      </div>
    </div>
  )
}

function AuctionPanel({ c }: { c: GameController }) {
  const s = c.state
  const a = s.auction!
  const now = useNow(true, 200)
  const { busy, submit } = useSubmit()
  const tile = ownableTile(a.tile)
  const remaining = Math.max(0, a.endsAt - now)
  const leader = playerOf(s, a.highBidderId)
  const bidders = s.players.filter((p) => !p.bankrupt && (c.meId === null || p.id === c.meId))

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">Auction</p>
        <span className="tabular-nums text-sm text-muted" aria-live="off">
          {(remaining / 1000).toFixed(1)}s
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full bg-accent transition-[width] duration-200 ease-linear" style={{ width: `${(remaining / (AUCTION_SECONDS * 1000)) * 100}%` }} />
      </div>
      <p className="mt-2 text-lg">
        <strong className="font-display">{tile.name}</strong> <span className="text-sm text-muted">list price {formatMoney(tile.price)}</span>
      </p>
      <p className="text-sm" aria-live="polite">
        {leader ? (
          <>
            Highest bid <strong>{formatMoney(a.highBid)}</strong> by <strong>{leader.name}</strong>
          </>
        ) : (
          'No bids yet — opening bid ₹100'
        )}
      </p>
      <div className="mt-2 space-y-2">
        {bidders.map((p) => {
          const steps = [AUCTION_STEP, 500, 1000].map((inc) => a.highBid + inc)
          const canBidAny = steps.some((amt) => legal(s, { type: 'bid', amount: amt, now }, p.id))
          const canPass = legal(s, { type: 'passAuction' }, p.id)
          if (!canBidAny && !canPass) {
            const why = a.highBidderId === p.id ? 'is the highest bidder' : a.passed.includes(p.id) ? 'dropped out' : "can't bid"
            return (
              <div key={p.id} className="flex items-center gap-2 text-sm text-muted">
                <TokenBadge token={p.token} color={p.color} size={22} /> {c.meId ? `You ${why.replace('is', 'are')}` : `${p.name} ${why}`}
              </div>
            )
          }
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-2">
              {c.meId === null && (
                <span className="flex w-24 items-center gap-1.5 truncate text-sm font-semibold">
                  <TokenBadge token={p.token} color={p.color} size={22} />
                  {p.name}
                </span>
              )}
              {steps.map((amt) => (
                <Button
                  key={amt}
                  size="sm"
                  variant="primary"
                  disabled={busy || !legal(s, { type: 'bid', amount: amt, now }, p.id)}
                  onClick={() => submit({ type: 'bid', amount: amt, now: Date.now() }, p.id)}
                >
                  {formatMoney(amt)}
                </Button>
              ))}
              <Button size="sm" variant="ghost" disabled={busy || !canPass} onClick={() => submit({ type: 'passAuction' }, p.id)}>
                Drop out
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TurnPanel({ c }: { c: GameController }) {
  const s = c.state
  const t = s.turn
  const p = playerOf(s, t.playerId)!
  const { busy, submit } = useSubmit()
  if (!canAct(c, p.id)) {
    const what = t.phase === 'buy' ? 'to decide on a property' : t.phase === 'roll' ? 'to roll' : 'to finish their turn'
    return <Waiting player={p} what={what} />
  }
  const you = c.meId ? 'You' : p.name

  if (t.phase === 'roll') {
    return (
      <div>
        <div className="mb-2 flex items-center gap-2">
          <TokenBadge token={p.token} color={p.color} size={30} />
          <p className="text-lg font-semibold">
            {c.meId ? 'Your turn' : `${p.name}'s turn`}
            {t.extraRoll && <span className="ml-2 text-sm font-normal text-accent">Doubles — roll again!</span>}
          </p>
        </div>
        {p.inJail && (
          <p className="mb-2 text-sm text-muted">
            {you} {c.meId ? 'are' : 'is'} in Jail. Pay the fine, use a pass, or roll for doubles (try {p.jailAttempts + 1} of 3).
          </p>
        )}
        {!p.started && <p className="mb-2 text-sm text-muted">Roll a 12 to start moving.</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="lg" disabled={busy} onClick={() => submit({ type: 'roll', dice: rollDice() }, p.id)}>
            {p.inJail ? 'Roll for doubles' : 'Roll dice'}
          </Button>
          {p.inJail && legal(s, { type: 'payJailFine' }, p.id) && (
            <Button disabled={busy} onClick={() => submit({ type: 'payJailFine' }, p.id)}>
              Pay {formatMoney(s.settings.jailFine)}
            </Button>
          )}
          {p.inJail && p.jailPasses > 0 && (
            <Button disabled={busy} onClick={() => submit({ type: 'useJailPass' }, p.id)}>
              Use jail pass
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (t.phase === 'buy' && t.pendingTile !== null) {
    const tile = ownableTile(t.pendingTile)
    const canBuy = legal(s, { type: 'buy' }, p.id)
    const info = tile.kind === 'city' ? `Rent ${formatMoney(tile.rents[0])}` : `Rent ${formatMoney(tile.rent)} (${formatMoney(tile.pairRent)} with ${BOARD[tile.pair].name})`
    return (
      <div>
        <p className="text-sm text-muted">{you} landed on</p>
        <p className="font-display text-2xl leading-tight">{tile.name}</p>
        <p className="text-sm text-muted">
          {formatMoney(tile.price)} · {info}
        </p>
        {!canBuy && <p className="mt-1 text-sm text-bad">Not enough cash ({formatMoney(p.cash)}).</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" size="lg" disabled={busy || !canBuy} onClick={() => submit({ type: 'buy' }, p.id)}>
            Buy for {formatMoney(tile.price)}
          </Button>
          <Button disabled={busy} onClick={() => submit({ type: 'decline', now: Date.now() }, p.id)}>
            {s.settings.auctions ? 'Auction it' : "Don't buy"}
          </Button>
        </div>
      </div>
    )
  }

  const here = BOARD[p.position]
  const rentHere = s.properties[p.position] ? rentFor(s, p.position) : 0
  const blockedByFirstLap = s.properties[p.position]?.owner === null && s.settings.firstLapRule && !p.lapped
  return (
    <div>
      <p className="text-sm text-muted">
        {you} {c.meId ? 'are' : 'is'} on <strong className="text-ink">{here.name}</strong>
        {rentHere > 0 && s.properties[p.position]?.owner === p.id ? ` (your rent: ${formatMoney(rentHere)})` : ''}. Build, mortgage or trade,
        then end {c.meId ? 'your' : 'the'} turn.
      </p>
      {blockedByFirstLap && (
        <p className="mt-2 rounded-xl border border-accent bg-accent/10 p-2 text-sm">
          <strong>{here.name} is for sale, but {c.meId ? "you can't" : `${p.name} can't`} buy yet.</strong> First-lap rule: nobody can
          buy property until they've passed Start once. (The host can switch this off in the lobby's house rules.)
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" size="lg" disabled={busy} onClick={() => submit({ type: 'endTurn' }, p.id)}>
          End turn
        </Button>
      </div>
    </div>
  )
}

export function ActionPanel() {
  const c = useController()
  const s = c.state
  if (s.status !== 'playing') return null
  return (
    <Panel className="min-h-[7.5rem]">
      {s.debts.length > 0 ? <DebtPanel c={c} /> : s.auction ? <AuctionPanel c={c} /> : <TurnPanel c={c} />}
    </Panel>
  )
}
