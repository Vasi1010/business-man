import { useEffect, useState } from 'react'

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
}

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={`h-full w-auto drop-shadow-md ${rolling ? 'dice-rolling' : ''}`} aria-hidden="true">
      <rect x="4" y="4" width="92" height="92" rx="20" fill="#fffaf0" stroke="#2a1c12" strokeWidth="4" />
      {PIPS[value]?.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill={value === 1 ? '#9b2d1f' : '#2a1c12'} />
      ))}
    </svg>
  )
}

/** Two dice that tumble whenever `rollKey` changes. */
export function Dice({ dice, rollKey }: { dice: [number, number] | null; rollKey: number | null }) {
  const [rolling, setRolling] = useState(false)
  const [faces, setFaces] = useState<[number, number]>(dice ?? [5, 3])
  const [seenKey, setSeenKey] = useState(rollKey)

  if (rollKey !== seenKey) {
    setSeenKey(rollKey)
    if (dice) setRolling(true)
  }

  useEffect(() => {
    if (!rolling || !dice) return
    const shuffle = setInterval(() => {
      setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)])
    }, 70)
    const stop = setTimeout(() => {
      clearInterval(shuffle)
      setFaces(dice)
      setRolling(false)
    }, 600)
    return () => {
      clearInterval(shuffle)
      clearTimeout(stop)
    }
  }, [rolling, dice])

  const shown = rolling ? faces : (dice ?? faces)
  return (
    <div className="flex h-full items-center gap-[1.5cqw]" aria-live="polite" aria-label={dice ? `Rolled ${dice[0]} and ${dice[1]}` : 'Dice'}>
      <Die value={shown[0]} rolling={rolling} />
      <Die value={shown[1]} rolling={rolling} />
    </div>
  )
}
