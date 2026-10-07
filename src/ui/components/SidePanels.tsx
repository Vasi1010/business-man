import { useEffect, useRef, useState } from 'react'
import {
  BOARD,
  GROUP_COLORS,
  HOTEL_LEVEL,
  formatMoney,
  netWorth,
  ownedTiles,
  waitingOn,
  type GameState,
  type PlayerId,
} from '../../engine'
import { useController } from '../controller'
import { TokenBadge } from './Art'
import { Button } from './ui'

function TileChip({ s, tile, onClick }: { s: GameState; tile: number; onClick: (i: number) => void }) {
  const t = BOARD[tile]
  const prop = s.properties[tile]
  const color = t.kind === 'city' ? GROUP_COLORS[t.group].hex : 'var(--muted)'
  return (
    <button
      type="button"
      onClick={() => onClick(tile)}
      className={`flex items-center gap-1.5 rounded-lg border border-line bg-paper px-2 py-1 text-xs font-semibold hover:bg-paper-2 ${prop.mortgaged ? 'mortgaged' : ''}`}
      aria-label={`${t.name}${prop.mortgaged ? ', mortgaged' : ''}${prop.level ? `, ${prop.level === HOTEL_LEVEL ? 'hotel' : `${prop.level} houses`}` : ''}`}
    >
      <span className="h-3 w-3 rounded-sm" style={{ background: color }} aria-hidden />
      {t.name}
      {prop.level > 0 && <span className="text-brand">{prop.level === HOTEL_LEVEL ? 'H' : '⌂'.repeat(prop.level)}</span>}
    </button>
  )
}

export function PlayersPanel({ onTile }: { onTile: (i: number) => void }) {
  const c = useController()
  const s = c.state
  const waiting = new Set(waitingOn(s))
  const [open, setOpen] = useState<PlayerId | null>(null)
  return (
    <ul className="space-y-1.5" aria-label="Players">
      {s.players.map((p) => {
        const online = c.onlineIds ? c.onlineIds.has(p.id) : null
        const tiles = ownedTiles(s, p.id)
        const isTurn = s.turn.playerId === p.id && s.status === 'playing'
        return (
          <li key={p.id} className={`rounded-xl border ${isTurn ? 'border-accent bg-paper-2' : 'border-line'} ${p.bankrupt ? 'opacity-50' : ''}`}>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 p-2 text-left"
              aria-expanded={open === p.id}
              onClick={() => setOpen(open === p.id ? null : p.id)}
            >
              <span className={`relative rounded-full ${waiting.has(p.id) ? 'turn-pulse' : ''}`}>
                <TokenBadge token={p.token} color={p.color} size={32} />
                {online !== null && (
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${online ? 'bg-good' : 'bg-line'}`}
                    title={online ? 'Online' : 'Offline'}
                    aria-label={online ? 'online' : 'offline'}
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-semibold ${p.bankrupt ? 'line-through' : ''}`}>
                  {p.name}
                  {c.meId === p.id && <span className="ml-1 text-xs font-normal text-muted">(you)</span>}
                </span>
                <span className="block text-xs text-muted">
                  {p.bankrupt
                    ? 'Bankrupt'
                    : `${tiles.length} propert${tiles.length === 1 ? 'y' : 'ies'} · worth ${formatMoney(netWorth(s, p.id))}`}
                  {p.inJail && ' · in Jail'}
                  {p.jailPasses > 0 && ` · ${p.jailPasses} pass${p.jailPasses > 1 ? 'es' : ''}`}
                  {p.missNextTurn && ' · resting'}
                </span>
              </span>
              <span className="text-right font-semibold tabular-nums">{formatMoney(p.cash)}</span>
            </button>
            {open === p.id && tiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                {tiles.map((i) => (
                  <TileChip key={i} s={s} tile={i} onClick={onTile} />
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function AssetsPanel({ playerId, onTile, onTrade }: { playerId: PlayerId; onTile: (i: number) => void; onTrade: () => void }) {
  const { state: s } = useController()
  const p = s.players.find((x) => x.id === playerId)
  if (!p) return null
  const tiles = ownedTiles(s, p.id)
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TokenBadge token={p.token} color={p.color} size={28} />
          <div>
            <div className="font-semibold leading-tight">{p.name}</div>
            <div className="text-xs text-muted">
              Cash <strong className="text-ink">{formatMoney(p.cash)}</strong> · worth {formatMoney(netWorth(s, p.id))}
              {p.jailPasses > 0 && ` · ${p.jailPasses} jail pass${p.jailPasses > 1 ? 'es' : ''}`}
            </div>
          </div>
        </div>
        {!p.bankrupt && s.status === 'playing' && (
          <Button size="sm" onClick={onTrade} disabled={!!s.auction}>
            Trade
          </Button>
        )}
      </div>
      {tiles.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No properties yet. Pass Start, then buy what you land on.</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tiles.map((i) => (
              <TileChip key={i} s={s} tile={i} onClick={onTile} />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Tap a property to build, sell, mortgage or unmortgage.</p>
        </>
      )}
    </div>
  )
}

export function EventLog() {
  const { state } = useController()
  const ref = useRef<HTMLOListElement>(null)
  const last = state.log.at(-1)?.seq
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' })
  }, [last, state.log.length])
  return (
    <ol ref={ref} className="max-h-72 space-y-1 overflow-y-auto pr-1 text-sm lg:max-h-[38vh]" aria-label="Event log" aria-live="polite" aria-relevant="additions">
      {state.log.slice(-80).map((e, i) => (
        <li key={`${e.seq}-${i}`} className="border-l-2 border-line pl-2 leading-snug">
          {e.text}
        </li>
      ))}
    </ol>
  )
}
