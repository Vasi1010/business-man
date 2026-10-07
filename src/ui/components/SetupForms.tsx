import { DEFAULT_SETTINGS, formatMoney, type Settings, type TokenId } from '../../engine'
import { PLAYER_COLORS, TOKENS } from '../tokens'
import { TokenBadge } from './Art'
import { Toggle } from './ui'

function NumberField({
  label,
  value,
  onChange,
  step = 100,
  min = 0,
  max = 1_000_000,
  disabled,
  suffix,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  step?: number
  min?: number
  max?: number
  disabled?: boolean
  suffix?: string
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => {
            const n = Math.floor(Number(e.target.value))
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
          }}
          className="w-28 rounded-lg border border-line bg-paper px-2 py-1 text-right tabular-nums disabled:opacity-60"
        />
        {suffix && <span className="text-sm text-muted">{suffix}</span>}
      </span>
    </label>
  )
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div className="py-1.5">
      <div className="mb-1 font-medium">{label}</div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-paper-2 p-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`rounded-lg px-2 py-1.5 text-sm font-semibold transition ${value === o.value ? 'bg-card shadow-sm' : 'text-muted'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SettingsEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: Settings
  onChange: (s: Settings) => void
  disabled?: boolean
}) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="divide-y divide-line/70">
      <div className="pb-2">
        <Toggle label="First-lap rule" hint="No buying until you've passed Start once" checked={value.firstLapRule} onChange={(v) => set('firstLapRule', v)} disabled={disabled} />
        <Toggle label="Auctions" hint="Declined properties go to a live auction" checked={value.auctions} onChange={(v) => set('auctions', v)} disabled={disabled} />
        <Toggle label="Half rent while owner is in Jail" checked={value.jailHalfRent} onChange={(v) => set('jailHalfRent', v)} disabled={disabled} />
        <Toggle label="Roll a 12 to start moving" checked={value.rollTwelveToStart} onChange={(v) => set('rollTwelveToStart', v)} disabled={disabled} />
      </div>
      <div className="py-2">
        <Choice
          label="Rest House"
          value={value.restHouseMode}
          onChange={(v) => set('restHouseMode', v)}
          disabled={disabled}
          options={[
            { value: 'collect', label: `Collect ${formatMoney(value.restHouseAmount)} each` },
            { value: 'skipTurn', label: 'Miss a turn' },
          ]}
        />
        <Choice
          label="Wealth Tax"
          value={value.wealthTaxMode}
          onChange={(v) => set('wealthTaxMode', v)}
          disabled={disabled}
          options={[
            { value: 'perBuilding', label: 'Per building' },
            { value: 'percent', label: `${value.wealthTaxPercent}% of property` },
          ]}
        />
      </div>
      <div className="pt-2">
        <NumberField label="Starting cash (₹)" value={value.startingCash} onChange={(n) => set('startingCash', n)} step={500} min={1000} disabled={disabled} />
        <NumberField label="Start salary (₹)" value={value.startSalary} onChange={(n) => set('startSalary', n)} disabled={disabled} />
        <NumberField label="Time limit" value={value.timeLimitMinutes} onChange={(n) => set('timeLimitMinutes', n)} step={5} max={600} suffix="min (0 = none)" disabled={disabled} />
        <details className="py-1.5">
          <summary className="cursor-pointer font-medium text-brand">Special tile amounts</summary>
          <NumberField label="Income Tax (₹)" value={value.incomeTax} onChange={(n) => set('incomeTax', n)} disabled={disabled} />
          <NumberField label="Wealth Tax per house (₹)" value={value.wealthTaxPerHouse} onChange={(n) => set('wealthTaxPerHouse', n)} disabled={disabled} />
          <NumberField label="Wealth Tax per hotel (₹)" value={value.wealthTaxPerHotel} onChange={(n) => set('wealthTaxPerHotel', n)} disabled={disabled} />
          <NumberField label="Wealth Tax percent" value={value.wealthTaxPercent} onChange={(n) => set('wealthTaxPercent', n)} step={1} max={100} suffix="%" disabled={disabled} />
          <NumberField label="Club, pay each (₹)" value={value.clubAmount} onChange={(n) => set('clubAmount', n)} step={50} disabled={disabled} />
          <NumberField label="Rest House, collect each (₹)" value={value.restHouseAmount} onChange={(n) => set('restHouseAmount', n)} step={50} disabled={disabled} />
          <NumberField label="Jail fine (₹)" value={value.jailFine} onChange={(n) => set('jailFine', n)} disabled={disabled} />
          {!disabled && (
            <button type="button" className="mt-1 text-sm text-muted underline" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
              Reset all to defaults
            </button>
          )}
        </details>
      </div>
    </div>
  )
}

export function TokenPicker({
  token,
  color,
  onChange,
  takenTokens = [],
  takenColors = [],
}: {
  token: TokenId
  color: string
  onChange: (v: { token: TokenId; color: string }) => void
  takenTokens?: TokenId[]
  takenColors?: string[]
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Token">
        {TOKENS.map((t) => {
          const taken = takenTokens.includes(t.id) && t.id !== token
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={token === t.id}
              aria-label={t.label + (taken ? ' (taken)' : '')}
              title={t.label}
              disabled={taken}
              onClick={() => onChange({ token: t.id, color })}
              className={`rounded-full p-0.5 transition disabled:opacity-25 ${token === t.id ? 'ring-3 ring-brand' : ''}`}
            >
              <TokenBadge token={t.id} color={color} size={38} />
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colour">
        {PLAYER_COLORS.map((c) => {
          const taken = takenColors.includes(c.hex) && c.hex !== color
          return (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={color === c.hex}
              aria-label={c.label + (taken ? ' (taken)' : '')}
              title={c.label}
              disabled={taken}
              onClick={() => onChange({ token, color: c.hex })}
              className={`h-8 w-8 rounded-full border-2 border-card transition disabled:opacity-20 ${color === c.hex ? 'ring-3 ring-brand' : ''}`}
              style={{ background: c.hex }}
            />
          )
        })}
      </div>
    </div>
  )
}
