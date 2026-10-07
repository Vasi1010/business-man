import {
  BOARD,
  CHANCE,
  CHEST,
  GROUP_COLORS,
  HOTEL_LEVEL,
  formatMoney,
  isLegal,
  rentFor,
  unmortgageCost,
  type Action,
  type Settings,
} from '../../engine'
import { perspectiveId, useController } from '../controller'
import { TileIcon, TokenBadge } from './Art'
import { Button, Modal } from './ui'

const levelName = (level: number) =>
  level === 0 ? 'No buildings' : level === HOTEL_LEVEL ? 'Hotel' : `${level} house${level > 1 ? 's' : ''}`

export function PropertyCard({ tile, onClose }: { tile: number | null; onClose: () => void }) {
  const c = useController()
  const s = c.state
  if (tile === null) return null
  const t = BOARD[tile]
  const prop = s.properties[tile]
  const owner = prop?.owner ? s.players.find((p) => p.id === prop.owner) : undefined
  const actor = perspectiveId(s, c.meId)

  const manage: { label: string; action: Action; variant?: 'primary' | 'secondary' | 'danger' }[] = [
    { label: 'Build', action: { type: 'build', tile }, variant: 'primary' },
    { label: 'Sell building', action: { type: 'sellBuilding', tile } },
    { label: 'Mortgage', action: { type: 'mortgage', tile } },
    { label: `Unmortgage (${formatMoney(prop ? unmortgageCost(tile) : 0)})`, action: { type: 'unmortgage', tile } },
  ]
  const legal = owner && owner.id === actor ? manage.filter((m) => isLegal(s, m.action, actor)) : []

  const header =
    t.kind === 'city' ? (
      <div className="-mx-4 -mt-4 mb-3 rounded-t-3xl px-4 pb-3 pt-4 text-white" style={{ background: GROUP_COLORS[t.group].hex }}>
        <div className="text-xs font-semibold uppercase tracking-wider opacity-90">{GROUP_COLORS[t.group].name} group</div>
        <h2 className="font-display text-3xl leading-tight drop-shadow">{t.name}</h2>
      </div>
    ) : (
      <div className="mb-3 flex items-center gap-3">
        <TileIcon kind={t.kind === 'service' ? t.icon : t.kind} className="h-10 w-10 text-brand" />
        <h2 className="font-display text-3xl leading-tight">{t.name}</h2>
      </div>
    )

  return (
    <Modal open onClose={onClose} label={t.name}>
      {header}
      {(t.kind === 'city' || t.kind === 'service') && prop && (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Price</dt>
            <dd className="text-right font-semibold">{formatMoney(t.price)}</dd>
            <dt className="text-muted">Mortgage value</dt>
            <dd className="text-right">{formatMoney(t.mortgage)}</dd>
            {t.kind === 'city' && (
              <>
                <dt className="text-muted">House / hotel cost</dt>
                <dd className="text-right">{formatMoney(t.houseCost)}</dd>
              </>
            )}
          </dl>
          <table className="mt-3 w-full text-sm">
            <caption className="mb-1 text-left text-xs font-semibold uppercase tracking-wider text-muted">Rent</caption>
            <tbody className="[&_td]:py-0.5 [&_td:last-child]:text-right [&_tr]:border-b [&_tr]:border-line/60">
              {t.kind === 'city' ? (
                <>
                  <Row label="Site" value={t.rents[0]} active={prop.owner !== null && prop.level === 0} />
                  <Row label="Site, whole group owned" value={t.rents[0] * 2} />
                  <Row label="1 house" value={t.rents[1]} active={prop.level === 1} />
                  <Row label="2 houses" value={t.rents[2]} active={prop.level === 2} />
                  <Row label="3 houses" value={t.rents[3]} active={prop.level === 3} />
                  <Row label="Hotel" value={t.rents[4]} active={prop.level === 4} />
                </>
              ) : (
                <>
                  <Row label="Rent" value={t.rent} />
                  <Row label={`If the owner also has ${BOARD[t.pair].name}`} value={t.pairRent} />
                </>
              )}
            </tbody>
          </table>
          <div className="mt-3 rounded-xl bg-paper-2 p-3 text-sm">
            {owner ? (
              <div className="flex items-center gap-2">
                <TokenBadge token={owner.token} color={owner.color} size={24} />
                <span>
                  Owned by <strong>{owner.name}</strong>
                  {t.kind === 'city' && <> · {levelName(prop.level)}</>}
                  {prop.mortgaged && <strong className="text-bad"> · Mortgaged</strong>}
                </span>
              </div>
            ) : (
              <span>Unowned — available from the bank.</span>
            )}
            {owner && !prop.mortgaged && (
              <div className="mt-1 text-muted">
                Rent right now: <strong className="text-ink">{formatMoney(rentFor(s, tile))}</strong>
              </div>
            )}
          </div>
          {legal.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {legal.map((m) => (
                <Button
                  key={m.action.type}
                  variant={m.variant ?? 'secondary'}
                  onClick={() => void c.dispatch(m.action, actor)}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          )}
        </>
      )}
      {t.kind === 'chance' || t.kind === 'chest' ? (
        <div className="text-sm">
          <p className="mb-2 text-muted">The dice total that brought you here decides what happens:</p>
          <ul className="space-y-1">
            {Object.entries(t.kind === 'chance' ? CHANCE : CHEST).map(([roll, card]) => (
              <li key={roll} className="flex gap-2">
                <span className="w-6 shrink-0 text-right font-bold text-brand">{roll}</span>
                <span>
                  <strong>{card.title}</strong> — {card.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {t.kind !== 'city' && t.kind !== 'service' && t.kind !== 'chance' && t.kind !== 'chest' && (
        <p className="text-sm">{specialText(t.kind, s.settings)}</p>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  )
}

function Row({ label, value, active = false }: { label: string; value: number; active?: boolean }) {
  return (
    <tr className={active ? 'font-bold text-brand' : ''}>
      <td>{label}</td>
      <td>{formatMoney(value)}</td>
    </tr>
  )
}

function specialText(kind: string, st: Settings): string {
  switch (kind) {
    case 'start':
      return `Collect ${formatMoney(st.startSalary)} every time you pass or land on Start.`
    case 'jail':
      return `Only reached by rolling three doubles in a row or a Chance/Community Chest result. To get out, pay ${formatMoney(st.jailFine)}, use a pass, or roll doubles (up to 3 tries). Otherwise you're just visiting.`
    case 'incomeTax':
      return `Pay ${formatMoney(st.incomeTax)} to the bank.`
    case 'wealthTax':
      return st.wealthTaxMode === 'percent'
        ? `Pay ${st.wealthTaxPercent}% of the total price of all your properties.`
        : `Pay ${formatMoney(st.wealthTaxPerHouse)} per house and ${formatMoney(st.wealthTaxPerHotel)} per hotel you own.`
    case 'club':
      return `Pay ${formatMoney(st.clubAmount)} to every other player.`
    case 'restHouse':
      return st.restHouseMode === 'skipTurn'
        ? 'Take a rest: you miss your next turn.'
        : `Collect ${formatMoney(st.restHouseAmount)} from every other player.`
    default:
      return ''
  }
}
