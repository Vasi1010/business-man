import { memo } from 'react'
import {
  BOARD,
  GROUP_COLORS,
  HOTEL_LEVEL,
  formatMoney,
  groupIndian,
  waitingOn,
  type GameState,
  type Player,
  type PropertyState,
  type Tile as TileData,
} from '../../engine'
import { GRID_TEMPLATE, placement, tileCenter, type Side } from '../boardLayout'
import { useController } from '../controller'
import { useAnimatedPositions } from '../hooks/useAnimatedPositions'
import { LogoMark, TileIcon, TokenBadge } from './Art'
import { Dice } from './Dice'

/** Soft hyphens so long names break cleanly on small tiles. */
const SOFT_NAMES: Record<string, string> = {
  Chandigarh: 'Chandi­garh',
  Darjeeling: 'Darjee­ling',
  Hyderabad: 'Hydera­bad',
  Ahmedabad: 'Ahmeda­bad',
  Bengaluru: 'Benga­luru',
  Amritsar: 'Amrit­sar',
  Srinagar: 'Srina­gar',
  Lucknow: 'Luck­now',
  Railways: 'Rail­ways',
}

const bandLayout: Record<Exclude<Side, 'corner'>, { flex: string; band: string }> = {
  bottom: { flex: 'flex-col', band: 'h-[24%] w-full' },
  top: { flex: 'flex-col-reverse', band: 'h-[24%] w-full' },
  left: { flex: 'flex-row-reverse', band: 'w-[24%] h-full' },
  right: { flex: 'flex-row', band: 'w-[24%] h-full' },
}

function Buildings({ level, vertical }: { level: number; vertical: boolean }) {
  if (level === 0) return null
  if (level === HOTEL_LEVEL) {
    return (
      <span className="rounded-[0.4cqw] bg-[#fff8ee] px-[0.5cqw] text-[1.25cqw] font-bold leading-none text-[#9b2d1f] shadow">H</span>
    )
  }
  return (
    <span className={`flex gap-[0.35cqw] ${vertical ? 'flex-col' : ''}`}>
      {Array.from({ length: level }, (_, i) => (
        <span key={i} className="h-[1.1cqw] w-[1.1cqw] rounded-[0.2cqw] bg-[#fff8ee] shadow" />
      ))}
    </span>
  )
}

function tileLabel(tile: TileData, prop: PropertyState | undefined, owner: Player | undefined): string {
  const parts = [tile.name]
  if (tile.kind === 'city' || tile.kind === 'service') {
    parts.push(formatMoney(tile.price))
    parts.push(owner ? `owned by ${owner.name}` : 'unowned')
    if (prop?.mortgaged) parts.push('mortgaged')
    if (prop && prop.level > 0) parts.push(prop.level === HOTEL_LEVEL ? 'hotel' : `${prop.level} house${prop.level > 1 ? 's' : ''}`)
  }
  return parts.join(', ')
}

interface TileProps {
  index: number
  prop: PropertyState | undefined
  owner: Player | undefined
  highlight: boolean
  salary: number
  onClick: (i: number) => void
}

const Tile = memo(function Tile({ index, prop, owner, highlight, salary, onClick }: TileProps) {
  const tile = BOARD[index]
  const { row, col, side } = placement(index)
  const style = { gridRow: row, gridColumn: col, boxShadow: owner ? `inset 0 0 0 0.45cqw ${owner.color}` : undefined }
  const base = `relative overflow-hidden border-[0.12cqw] border-ink/45 text-ink transition hover:brightness-95 focus-visible:z-10 ${highlight ? 'turn-pulse z-[5]' : ''}`

  if (side === 'corner') {
    const corner: Record<string, { label: string; sub: string; bg: string }> = {
      start: { label: 'Start', sub: `Collect ${formatMoney(salary)}`, bg: 'bg-[#f7d79a] dark:bg-[#5a3f12]' },
      jail: { label: 'Jail', sub: 'Just visiting', bg: 'bg-[#e8cfc4] dark:bg-[#4a2a22]' },
      club: { label: 'Club', sub: 'Pay everyone', bg: 'bg-[#d6e5c9] dark:bg-[#2c3f23]' },
      restHouse: { label: 'Rest House', sub: 'Put your feet up', bg: 'bg-[#cfe1ea] dark:bg-[#1f3640]' },
    }
    const c = corner[tile.kind]
    return (
      <button type="button" style={style} className={`${base} ${c.bg} flex flex-col items-center justify-center gap-[0.4cqw] p-[0.5cqw]`} onClick={() => onClick(index)} aria-label={tile.name}>
        <TileIcon kind={tile.kind as 'start'} className="h-[4.2cqw] w-[4.2cqw] text-brand" />
        <span className="font-display text-[1.9cqw] leading-none">{c.label}</span>
        <span className="text-center text-[1.15cqw] leading-tight text-muted">{c.sub}</span>
      </button>
    )
  }

  const layout = bandLayout[side]
  const vertical = side === 'left' || side === 'right'
  const isCity = tile.kind === 'city'
  const isService = tile.kind === 'service'

  return (
    <button
      type="button"
      style={style}
      onClick={() => onClick(index)}
      aria-label={tileLabel(tile, prop, owner)}
      className={`${base} flex ${layout.flex} bg-board ${prop?.mortgaged ? 'mortgaged opacity-75' : ''}`}
    >
      {isCity && (
        <span
          className={`${layout.band} flex shrink-0 items-center justify-center border-ink/40 ${side === 'bottom' ? 'border-b-[0.12cqw]' : side === 'top' ? 'border-t-[0.12cqw]' : side === 'left' ? 'border-l-[0.12cqw]' : 'border-r-[0.12cqw]'}`}
          style={{ background: GROUP_COLORS[tile.group].hex }}
        >
          <Buildings level={prop?.level ?? 0} vertical={vertical} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[0.3cqw] p-[0.35cqw] text-center">
        {!isCity && (
          <TileIcon
            kind={isService ? tile.icon : (tile.kind as 'chance')}
            className={`h-[3cqw] w-[3cqw] ${tile.kind === 'chance' ? 'text-[#c2417a]' : tile.kind === 'chest' ? 'text-[#0b7a75]' : 'text-brand'}`}
          />
        )}
        <span className={`w-full break-words font-display leading-[1.05] [hyphens:manual] ${isCity ? 'text-[1.5cqw]' : 'text-[1.25cqw]'}`} lang="en">
          {tile.kind === 'chest' ? 'Comm. Chest' : (SOFT_NAMES[tile.name] ?? tile.name)}
        </span>
        {(isCity || isService) && <span className="text-[1.2cqw] font-semibold leading-none text-muted">₹{groupIndian(tile.price)}</span>}
      </span>
    </button>
  )
})

function BoardCenter({ state }: { state: GameState }) {
  const current = state.players.find((p) => p.id === state.turn.playerId)
  const waiting = waitingOn(state)
  let status: string
  if (state.status === 'finished') status = 'Game over'
  else if (state.debts.length > 0) status = `${state.players.find((p) => p.id === state.debts[0].debtorId)?.name} is settling a debt`
  else if (state.auction) status = `Auction: ${BOARD[state.auction.tile].name}`
  else status = `${current?.name}'s turn`

  return (
    <div className="pointer-events-none flex h-full flex-col items-center justify-center gap-[2cqw] bg-board-center p-[3cqw]">
      <div className="flex items-center gap-[1.5cqw] opacity-90">
        <span className="h-[8cqw] w-[8cqw] [&>svg]:h-full [&>svg]:w-full">
          <LogoMark />
        </span>
        <span className="font-display text-[5.6cqw] leading-none text-brand drop-shadow-sm">Business-Man</span>
      </div>
      <div className="flex items-center gap-[1.5cqw] rounded-full bg-card/80 px-[2.5cqw] py-[1cqw] shadow-sm">
        {current && state.status === 'playing' && !state.auction && state.debts.length === 0 && (
          <TokenBadge token={current.token} color={current.color} size={22} />
        )}
        <span className="text-[2.6cqw] font-semibold" aria-live="polite">
          {status}
        </span>
      </div>
      <div className="h-[11cqw]">
        <Dice dice={state.lastRoll?.dice ?? null} rollKey={state.lastRoll?.seq ?? null} />
      </div>
      {waiting.length > 1 && <span className="text-[2cqw] text-muted">Waiting for bids…</span>}
    </div>
  )
}

const TOKEN_OFFSETS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
  [0, -2],
  [0, 2],
]

function TokenLayer({ players, positions }: { players: Player[]; positions: Record<string, number> }) {
  const byTile = new Map<number, Player[]>()
  for (const p of players) {
    if (p.bankrupt) continue
    const pos = positions[p.id] ?? p.position
    byTile.set(pos, [...(byTile.get(pos) ?? []), p])
  }
  return (
    <div className="pointer-events-none absolute inset-0">
      {[...byTile.entries()].flatMap(([tile, group]) =>
        group.map((p, i) => {
          const c = tileCenter(tile)
          const [ox, oy] = group.length === 1 ? [0, 0] : TOKEN_OFFSETS[i % TOKEN_OFFSETS.length]
          return (
            <div
              key={p.id}
              className="absolute h-[4.6cqw] w-[4.6cqw] transition-[left,top] duration-150 ease-out"
              style={{
                left: `calc(${c.x}% + ${ox * 1.5}cqw)`,
                top: `calc(${c.y}% + ${oy * 1.5}cqw)`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full">
                <TokenBadge token={p.token} color={p.color} ring title={p.name} />
              </div>
              {p.inJail && <span className="absolute -right-[0.6cqw] -top-[0.6cqw] h-[1.8cqw] w-[1.8cqw] rounded-full border border-white bg-ink" aria-hidden />}
            </div>
          )
        }),
      )}
    </div>
  )
}

export function Board({ onTileClick }: { onTileClick: (i: number) => void }) {
  const { state } = useController()
  const positions = useAnimatedPositions(state.players)
  const highlightTile = state.auction?.tile ?? state.turn.pendingTile

  return (
    <div className="@container w-full">
      <div
        className="relative grid aspect-square w-full overflow-hidden rounded-[1.5cqw] border-[0.5cqw] border-ink/80 bg-board shadow-xl"
        style={{ gridTemplateColumns: GRID_TEMPLATE, gridTemplateRows: GRID_TEMPLATE }}
      >
        {BOARD.map((_, i) => {
          const prop = state.properties[i]
          const owner = prop?.owner ? state.players.find((p) => p.id === prop.owner) : undefined
          return (
            <Tile
              key={i}
              index={i}
              prop={prop}
              owner={owner}
              highlight={highlightTile === i}
              salary={state.settings.startSalary}
              onClick={onTileClick}
            />
          )
        })}
        <div style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }} className="border-[0.12cqw] border-ink/45">
          <BoardCenter state={state} />
        </div>
        <TokenLayer players={state.players} positions={positions} />
      </div>
    </div>
  )
}
