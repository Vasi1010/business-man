import { useEffect, useState, type CSSProperties } from 'react'
import { groupIndian } from '../../engine'
import { useMoneyFx, type MoneyBurst } from '../../store/moneyFx'
import { PawnPiece } from './Art'

/** Counts up from zero so the amount lands with a little drama. */
function useCountUp(target: number, ms = 650) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      setValue(Math.round(target * (1 - (1 - t) ** 3)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return value
}

const COINS = Array.from({ length: 9 }, (_, i) => i)

function Burst({ b }: { b: MoneyBurst }) {
  const gain = b.amount > 0
  const shown = useCountUp(Math.abs(b.amount))
  // Gains spray coins upwards; losses drop them.
  const [coins] = useState(() =>
    COINS.map((i) => {
      const angle = (i / COINS.length) * Math.PI - Math.PI / 2 + (Math.random() - 0.5) * 0.4
      const dist = 120 + Math.random() * 90
      return {
        '--dx': `${Math.sin(angle) * dist}px`,
        '--dy': gain ? `${-Math.abs(Math.cos(angle)) * dist * 0.8 - 50}px` : `${110 + Math.random() * 90}px`,
        '--rot': `${(Math.random() - 0.5) * 720}deg`,
        animationDelay: `${gain ? 120 + i * 35 : 380 + i * 45}ms`,
      } as CSSProperties
    }),
  )
  return (
    <div className={`money-burst relative ${gain ? 'money-gain' : 'money-loss'}`} role="status">
      {coins.map((style, i) => (
        <span key={i} className="money-coin" style={style} aria-hidden>
          ₹
        </span>
      ))}
      <div
        className={`relative flex items-center gap-3 rounded-2xl border-2 px-5 py-3 text-white shadow-2xl ${
          gain ? 'border-[#b7f5c4] bg-gradient-to-b from-[#34b45a] to-[#13692b]' : 'border-[#ffc2bb] bg-gradient-to-b from-[#e8392e] to-[#8f0f0a]'
        }`}
      >
        <PawnPiece color={b.color} className="h-10 w-7 shrink-0" />
        <div className="min-w-0">
          <div className="font-display text-4xl leading-none tabular-nums drop-shadow sm:text-5xl">
            {gain ? '+' : '−'}₹{groupIndian(shown)}
          </div>
          <div className="mt-1 max-w-[16rem] truncate text-sm font-semibold text-white/90">
            {b.who} · {b.reason}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Full-screen layer for the red (loss) and green (gain) money animations. */
export function MoneyFx() {
  const bursts = useMoneyFx((s) => s.bursts)
  const last = bursts[bursts.length - 1]
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 px-4" aria-live="polite">
      {last && <div key={last.id} className={`money-flash ${last.amount > 0 ? 'money-flash-gain' : 'money-flash-loss'}`} aria-hidden />}
      {bursts.map((b) => (
        <Burst key={b.id} b={b} />
      ))}
    </div>
  )
}
