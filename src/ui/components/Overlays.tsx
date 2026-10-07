import { useEffect, useState } from 'react'
import { formatMoney, ranking, type CardReveal as Reveal } from '../../engine'
import { useToasts } from '../../store/toasts'
import { useController } from '../controller'
import { TileIcon, TokenBadge } from './Art'
import { Button } from './ui'

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  const tone = {
    gain: 'border-good text-good',
    loss: 'border-bad text-bad',
    info: 'border-line text-ink',
    error: 'border-bad bg-bad text-white dark:text-black',
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-50 flex flex-col items-center gap-1.5 px-3" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`toast-in pointer-events-auto max-w-sm rounded-full border-2 bg-card px-4 py-1.5 text-sm font-semibold shadow-lg ${tone[t.tone]}`}
        >
          {t.text}
        </button>
      ))}
    </div>
  )
}

/** Big reveal card for Chance / Community Chest results. */
export function CardReveal() {
  const { state } = useController()
  const card = state.lastCard
  const [initialSeq] = useState(card?.seq ?? -1)
  const [shown, setShown] = useState<Reveal | null>(null)
  const [lastSeq, setLastSeq] = useState(card?.seq ?? -1)

  if (card && card.seq !== lastSeq) {
    setLastSeq(card.seq)
    if (card.seq > initialSeq) setShown(card)
  }

  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setShown(null), 4200)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShown(null)
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
    }
  }, [shown])

  if (!shown) return null
  const who = state.players.find((p) => p.id === shown.playerId)
  const chance = shown.deck === 'chance'
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6" onClick={() => setShown(null)} role="dialog" aria-label={`${chance ? 'Chance' : 'Community Chest'}: ${shown.title}`}>
      <div
        className="card-in w-full max-w-xs overflow-hidden rounded-3xl border-4 bg-card text-center shadow-2xl"
        style={{ borderColor: chance ? '#c2417a' : '#0b7a75' }}
      >
        <div className="flex items-center justify-between px-5 py-3 text-white" style={{ background: chance ? '#c2417a' : '#0b7a75' }}>
          <span className="flex items-center gap-2 font-display text-xl">
            <TileIcon kind={shown.deck} className="h-6 w-6" />
            {chance ? 'Chance' : 'Community Chest'}
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 font-bold" style={{ color: chance ? '#c2417a' : '#0b7a75' }} aria-label={`Dice total ${shown.roll}`}>
            {shown.roll}
          </span>
        </div>
        <div className="px-6 py-6">
          <h2 className="font-display text-3xl leading-tight">{shown.title}</h2>
          <p className="mt-3 text-lg">{shown.text}</p>
          {who && (
            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
              <TokenBadge token={who.token} color={who.color} size={20} /> {who.name}
            </p>
          )}
          <p className="mt-4 text-xs text-muted">Tap to continue</p>
        </div>
      </div>
    </div>
  )
}

export function EndScreen() {
  const c = useController()
  const s = c.state
  if (s.status !== 'finished') return null
  const winner = s.players.find((p) => p.id === s.winnerId)
  const rows = ranking(s)
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="Game over">
      <div className="card-in w-full max-w-md rounded-3xl border border-line bg-card p-6 text-center shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Game over</p>
        {winner && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <TokenBadge token={winner.token} color={winner.color} size={72} ring />
            <h2 className="font-display text-4xl text-brand">{winner.name} wins!</h2>
            <p className="text-muted">The new Lakhpati of the table.</p>
          </div>
        )}
        <ol className="mt-5 space-y-1.5 text-left">
          {rows.map((r, i) => (
            <li key={r.player.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
              <span className="w-5 text-right font-bold text-muted">{i + 1}</span>
              <TokenBadge token={r.player.token} color={r.player.color} size={26} />
              <span className="flex-1 font-semibold">{r.player.name}</span>
              <span className="tabular-nums">{r.player.bankrupt ? 'Bankrupt' : formatMoney(r.worth)}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {(c.mode === 'local' || c.isHost) && (
            <Button variant="primary" size="lg" onClick={c.playAgain}>
              Play again
            </Button>
          )}
          {c.mode === 'online' && !c.isHost && <p className="w-full text-sm text-muted">Waiting for the host to start another game…</p>}
          <Button onClick={c.leave}>Home</Button>
        </div>
      </div>
    </div>
  )
}
