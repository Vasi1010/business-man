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
import { useAnimatedPositions, type TokenMotion } from '../hooks/useAnimatedPositions'
import { LogoMark, TileIcon, TokenBadge } from './Art'
import { Dice } from './Dice'
import { Dice3D } from './Dice3D'

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

function BoardCenter({ state, showDice = true, onDiceClick }: { state: GameState; showDice?: boolean; onDiceClick?: () => void }) {
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
      {showDice ? (
        onDiceClick ? (
          <button
            type="button"
            onClick={onDiceClick}
            aria-label="Roll dice"
            title="Tap to roll"
            className="pointer-events-auto h-[11cqw] rounded-[2cqw] transition hover:scale-105 active:scale-95"
          >
            <Dice dice={state.lastRoll?.dice ?? null} rollKey={state.lastRoll?.seq ?? null} />
          </button>
        ) : (
          <div className="h-[11cqw]">
            <Dice dice={state.lastRoll?.dice ?? null} rollKey={state.lastRoll?.seq ?? null} />
          </div>
        )
      ) : (
        <div className="h-[13cqw]" />
      )}
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

function TokenLayer({ players, motion }: { players: Player[]; motion: TokenMotion }) {
  const { positions, hops, stepMs } = motion
  const byTile = new Map<number, Player[]>()
  for (const p of players) {
    if (p.bankrupt) continue
    const pos = positions[p.id] ?? p.position
    byTile.set(pos, [...(byTile.get(pos) ?? []), p])
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {[...byTile.entries()].flatMap(([tile, group]) =>
        group.map((p, i) => {
          const c = tileCenter(tile)
          const [ox, oy] = group.length === 1 ? [0, 0] : TOKEN_OFFSETS[i % TOKEN_OFFSETS.length]
          return (
            <div
              key={p.id}
              className="absolute h-[4.6cqw] w-[4.6cqw] ease-in-out"
              style={{
                left: `calc(${c.x}% + ${ox * 1.5}cqw)`,
                top: `calc(${c.y}% + ${oy * 1.5}cqw)`,
                transform: 'translate(-50%, -50%)',
                transitionProperty: 'left, top',
                transitionDuration: `${Math.round((stepMs[p.id] ?? 200) * 0.85)}ms`,
              }}
            >
              <div
                key={hops[p.id] ?? 0}
                className={`h-full w-full [&>svg]:h-full [&>svg]:w-full ${hops[p.id] ? 'token-hop' : ''}`}
                style={{ animationDuration: `${Math.round(stepMs[p.id] ?? 200)}ms` }}
              >
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

export type BoardVariant = 'flat' | 'tilt'

/** Board tilt for the 3D table view (degrees). */
const TILT = 40

/** Upright "standee" game pieces for the tilted view. */
function TokenLayer3D({
  players,
  motion,
  dice,
  rollKey,
  onDiceClick,
}: {
  players: Player[]
  motion: TokenMotion
  dice: [number, number] | null
  rollKey: number | null
  onDiceClick?: () => void
}) {
  const { positions, hops, stepMs } = motion
  const byTile = new Map<number, Player[]>()
  for (const p of players) {
    if (p.bankrupt) continue
    const pos = positions[p.id] ?? p.position
    byTile.set(pos, [...(byTile.get(pos) ?? []), p])
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-20 [transform-style:preserve-3d]" style={{ transform: 'translateZ(0.2cqw)' }}>
      <div
        className={`absolute [transform-style:preserve-3d] ${onDiceClick ? 'pointer-events-auto cursor-pointer' : ''}`}
        style={{ left: '50%', top: '62%' }}
        onClick={onDiceClick}
        role={onDiceClick ? 'button' : undefined}
        tabIndex={onDiceClick ? 0 : undefined}
        aria-label={onDiceClick ? 'Roll dice' : undefined}
        onKeyDown={(e) => onDiceClick && (e.key === 'Enter' || e.key === ' ') && onDiceClick()}
      >
        <Dice3D dice={dice} rollKey={rollKey} />
      </div>
      {[...byTile.entries()].flatMap(([tile, group]) =>
        group.map((p, i) => {
          const c = tileCenter(tile)
          const [ox, oy] = group.length === 1 ? [0, 0] : TOKEN_OFFSETS[i % TOKEN_OFFSETS.length]
          const ms = stepMs[p.id] ?? 200
          return (
            <div
              key={p.id}
              className="absolute h-0 w-0 ease-in-out [transform-style:preserve-3d]"
              style={{
                left: `calc(${c.x}% + ${ox * 1.6}cqw)`,
                top: `calc(${c.y}% + ${oy * 1.6}cqw)`,
                transitionProperty: 'left, top',
                transitionDuration: `${Math.round(ms * 0.85)}ms`,
              }}
            >
              {/* Contact shadow on the board */}
              <span
                className="absolute h-[4.2cqw] w-[4.2cqw] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: 'radial-gradient(closest-side, rgba(0,0,0,.45), rgba(0,0,0,0))' }}
              />
              {/* The piece stands up, facing the camera */}
              <div
                className="absolute left-0 top-0 [transform-style:preserve-3d]"
                style={{ transform: `translate(-50%, -100%) rotateX(${-TILT}deg)`, transformOrigin: '50% 100%' }}
              >
                <div
                  key={hops[p.id] ?? 0}
                  className={`flex w-[5cqw] flex-col items-center ${hops[p.id] ? 'token-hop' : ''}`}
                  style={{ animationDuration: `${Math.round(ms)}ms` }}
                >
                  <div className="h-[5cqw] w-[5cqw] [&>svg]:h-full [&>svg]:w-full [&>svg]:drop-shadow-md">
                    <TokenBadge token={p.token} color={p.color} ring title={p.name} />
                  </div>
                  <span
                    className="-mt-[0.4cqw] h-[1.6cqw] w-[1.4cqw]"
                    style={{ background: `linear-gradient(90deg, ${p.color}, color-mix(in srgb, ${p.color} 55%, black))` }}
                  />
                  <span
                    className="h-[1cqw] w-[3.6cqw] rounded-[50%]"
                    style={{ background: `radial-gradient(ellipse at 40% 30%, color-mix(in srgb, ${p.color} 80%, white), color-mix(in srgb, ${p.color} 50%, black))` }}
                  />
                  {p.inJail && <span className="absolute right-0 top-0 h-[1.6cqw] w-[1.6cqw] rounded-full border border-white bg-ink" aria-hidden />}
                </div>
              </div>
            </div>
          )
        }),
      )}
    </div>
  )
}

export function Board({
  onTileClick,
  variant = 'flat',
  onDiceClick,
}: {
  onTileClick: (i: number) => void
  variant?: BoardVariant
  /** When set, tapping the dice rolls them. */
  onDiceClick?: () => void
}) {
  const { state } = useController()
  const motion = useAnimatedPositions(state.players)
  const highlightTile = state.auction?.tile ?? state.turn.pendingTile
  const tilt = variant === 'tilt'

  const tiles = BOARD.map((_, i) => {
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
  })

  if (tilt) {
    const edge = 'absolute bg-[#6b3f1f] dark:bg-[#3d2412]'
    return (
      <div className="@container w-full">
        <div className="-mb-[9cqw] -mt-[4cqw] px-[2cqw]" style={{ perspective: '190cqw', perspectiveOrigin: '50% 20%' }}>
          <div className="relative [transform-style:preserve-3d]" style={{ transform: `rotateX(${TILT}deg) scale(0.94)`, transformOrigin: '50% 60%' }}>
            {/* Table shadow and board thickness */}
            <div className="absolute inset-0 rounded-[1.5cqw] bg-black/45 blur-[2.5cqw]" style={{ transform: 'translateZ(-3cqw) scale(1.03)' }} />
            <div className={`${edge} bottom-0 left-0 right-0 h-[2.4cqw] origin-bottom bg-gradient-to-b from-[#7a4a25] to-[#4a2a12]`} style={{ transform: 'rotateX(-90deg)' }} />
            <div className={`${edge} bottom-0 left-0 top-0 w-[2.4cqw] origin-left`} style={{ transform: 'rotateY(90deg)' }} />
            <div className={`${edge} bottom-0 right-0 top-0 w-[2.4cqw] origin-right`} style={{ transform: 'rotateY(-90deg)' }} />
            <div
              className="relative grid aspect-square w-full overflow-hidden rounded-[1.2cqw] border-[0.6cqw] border-[#5a3418] bg-board"
              style={{ gridTemplateColumns: GRID_TEMPLATE, gridTemplateRows: GRID_TEMPLATE }}
            >
              {tiles}
              <div style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }} className="border-[0.12cqw] border-ink/45">
                <BoardCenter state={state} showDice={false} />
              </div>
            </div>
            <TokenLayer3D players={state.players} motion={motion} dice={state.lastRoll?.dice ?? null} rollKey={state.lastRoll?.seq ?? null} onDiceClick={onDiceClick} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="@container w-full">
      <div
        className="relative grid aspect-square w-full overflow-hidden rounded-[1.5cqw] border-[0.5cqw] border-ink/80 bg-board shadow-xl"
        style={{ gridTemplateColumns: GRID_TEMPLATE, gridTemplateRows: GRID_TEMPLATE }}
      >
        {tiles}
        <div style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }} className="border-[0.12cqw] border-ink/45">
          <BoardCenter state={state} onDiceClick={onDiceClick} />
        </div>
        <TokenLayer players={state.players} motion={motion} />
      </div>
    </div>
  )
}
