import { useState } from 'react'
import {
  BOARD,
  GROUP_COLORS,
  formatMoney,
  groupHasBuildings,
  isLegal,
  ownedTiles,
  type Action,
  type GameState,
  type PlayerId,
  type Trade,
  type TradeBundle,
} from '../../engine'
import { canAct, useController } from '../controller'
import { TokenBadge } from './Art'
import { Button, Modal } from './ui'

const emptyBundle = (): TradeBundle => ({ tiles: [], cash: 0, passes: 0 })

export interface TradeDraft {
  fromId: PlayerId
  toId: PlayerId | null
  give: TradeBundle
  get: TradeBundle
  /** When set, this draft counters that trade. */
  counterOf?: number
}

function Swatch({ tile }: { tile: number }) {
  const t = BOARD[tile]
  const color = t.kind === 'city' ? GROUP_COLORS[t.group].hex : 'var(--muted)'
  return <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: color }} aria-hidden />
}

function BundleEditor({
  s,
  ownerId,
  bundle,
  onChange,
  title,
}: {
  s: GameState
  ownerId: PlayerId
  bundle: TradeBundle
  onChange: (b: TradeBundle) => void
  title: string
}) {
  const owner = s.players.find((p) => p.id === ownerId)!
  const tiles = ownedTiles(s, ownerId)
  return (
    <fieldset className="min-w-0 flex-1 rounded-2xl border border-line p-3">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {tiles.length === 0 && <p className="text-sm text-muted">No properties.</p>}
      <ul className="max-h-48 space-y-1 overflow-y-auto">
        {tiles.map((i) => {
          const blocked = groupHasBuildings(s, i)
          const checked = bundle.tiles.includes(i)
          return (
            <li key={i}>
              <label className={`flex items-center gap-2 text-sm ${blocked ? 'opacity-50' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  disabled={blocked}
                  checked={checked}
                  onChange={() =>
                    onChange({ ...bundle, tiles: checked ? bundle.tiles.filter((x) => x !== i) : [...bundle.tiles, i] })
                  }
                  className="h-4 w-4 accent-[var(--brand)]"
                />
                <Swatch tile={i} />
                <span className="truncate">{BOARD[i].name}</span>
                {s.properties[i].mortgaged && <span className="text-xs text-bad">mortgaged</span>}
                {blocked && <span className="text-xs text-muted">has buildings</span>}
              </label>
            </li>
          )
        })}
      </ul>
      <label className="mt-2 block text-sm">
        <span className="text-muted">Cash (max {formatMoney(owner.cash)})</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={owner.cash}
          step={100}
          value={bundle.cash || ''}
          placeholder="0"
          onChange={(e) => onChange({ ...bundle, cash: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
          className="mt-1 w-full rounded-lg border border-line bg-paper px-2 py-1.5"
        />
      </label>
      {owner.jailPasses > 0 && (
        <label className="mt-2 block text-sm">
          <span className="text-muted">Jail passes (has {owner.jailPasses})</span>
          <input
            type="number"
            min={0}
            max={owner.jailPasses}
            value={bundle.passes}
            onChange={(e) => onChange({ ...bundle, passes: Math.max(0, Math.min(owner.jailPasses, Math.floor(Number(e.target.value) || 0))) })}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-2 py-1.5"
          />
        </label>
      )}
    </fieldset>
  )
}

export function TradeDialog({ draft, onClose }: { draft: TradeDraft | null; onClose: () => void }) {
  const c = useController()
  const s = c.state
  const [toId, setToId] = useState<PlayerId | null>(draft?.toId ?? null)
  const [give, setGive] = useState<TradeBundle>(draft?.give ?? emptyBundle())
  const [get, setGet] = useState<TradeBundle>(draft?.get ?? emptyBundle())
  const [error, setError] = useState<string | null>(null)
  if (!draft) return null
  const from = s.players.find((p) => p.id === draft.fromId)!
  const partners = s.players.filter((p) => !p.bankrupt && p.id !== draft.fromId)

  const action: Action | null = toId
    ? draft.counterOf !== undefined
      ? { type: 'counterTrade', tradeId: draft.counterOf, give, get }
      : { type: 'proposeTrade', toId, give, get }
    : null
  const valid = action !== null && isLegal(s, action, draft.fromId)

  const send = async () => {
    if (!action) return
    const err = await c.dispatch(action, draft.fromId)
    if (err) setError(err)
    else onClose()
  }

  return (
    <Modal open onClose={onClose} label="Propose a trade" wide>
      <h2 className="font-display text-2xl">{draft.counterOf !== undefined ? 'Counter-offer' : 'Propose a trade'}</h2>
      <p className="text-sm text-muted">{c.meId ? 'You are' : `${from.name} is`} offering.</p>
      {draft.counterOf === undefined && (
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Trade with">
          {partners.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={toId === p.id}
              onClick={() => {
                setToId(p.id)
                setGet(emptyBundle())
              }}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${toId === p.id ? 'border-brand bg-brand text-brand-ink' : 'border-line'}`}
            >
              <TokenBadge token={p.token} color={p.color} size={20} />
              {p.name}
            </button>
          ))}
        </div>
      )}
      {toId && (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <BundleEditor s={s} ownerId={draft.fromId} bundle={give} onChange={setGive} title={c.meId ? 'You give' : `${from.name} gives`} />
          <BundleEditor
            s={s}
            ownerId={toId}
            bundle={get}
            onChange={setGet}
            title={`${s.players.find((p) => p.id === toId)?.name} gives`}
          />
        </div>
      )}
      {error && <p className="mt-2 text-sm text-bad" role="alert">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!valid} onClick={() => void send()}>
          Send offer
        </Button>
      </div>
    </Modal>
  )
}

function describe(b: TradeBundle): string {
  const parts = b.tiles.map((i) => BOARD[i].name)
  if (b.cash) parts.push(formatMoney(b.cash))
  if (b.passes) parts.push(`${b.passes} jail pass${b.passes > 1 ? 'es' : ''}`)
  return parts.join(', ') || 'nothing'
}

export function TradesInbox({ onCounter }: { onCounter: (t: Trade) => void }) {
  const c = useController()
  const s = c.state
  const visible = s.trades.filter((t) => c.meId === null || t.toId === c.meId || t.fromId === c.meId)
  if (visible.length === 0) return null
  const name = (id: PlayerId) => s.players.find((p) => p.id === id)?.name ?? '?'
  return (
    <section className="space-y-2" aria-label="Trade offers">
      {visible.map((t) => {
        const incoming = canAct(c, t.toId)
        const outgoing = c.meId !== null && t.fromId === c.meId
        const acceptOk = isLegal(s, { type: 'respondTrade', tradeId: t.id, accept: true }, t.toId)
        return (
          <div key={t.id} className="rounded-2xl border-2 border-accent bg-card p-3 text-sm shadow-sm">
            <p>
              <strong>{outgoing ? 'You' : name(t.fromId)}</strong> offer{outgoing ? '' : 's'} <strong>{outgoing ? name(t.toId) : c.meId ? 'you' : name(t.toId)}</strong>:
            </p>
            <p className="mt-1">
              <span className="text-muted">Gives:</span> {describe(t.give)}
              <br />
              <span className="text-muted">Wants:</span> {describe(t.get)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {incoming && !outgoing && (
                <>
                  <Button size="sm" variant="good" disabled={!acceptOk} onClick={() => void c.dispatch({ type: 'respondTrade', tradeId: t.id, accept: true }, t.toId)}>
                    Accept
                  </Button>
                  <Button size="sm" onClick={() => onCounter(t)}>
                    Counter
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void c.dispatch({ type: 'respondTrade', tradeId: t.id, accept: false }, t.toId)}>
                    Reject
                  </Button>
                </>
              )}
              {(outgoing || c.meId === null) && (
                <Button size="sm" variant="ghost" onClick={() => void c.dispatch({ type: 'cancelTrade', tradeId: t.id }, t.fromId)}>
                  Withdraw
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}
