import { useState } from 'react'

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
}

/** Where each face sits on the cube (face 1 on top, facing +Z off the board). */
const FACE: Record<number, string> = {
  1: '',
  2: 'rotateX(90deg)',
  3: 'rotateY(90deg)',
  4: 'rotateY(-90deg)',
  5: 'rotateX(-90deg)',
  6: 'rotateX(180deg)',
}
/** Cube rotation that brings each face to the top. */
const SHOW: Record<number, [number, number]> = {
  1: [0, 0],
  2: [-90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [90, 0],
  6: [180, 0],
}

const SIZE = 7 // cqw

function Face({ value }: { value: number }) {
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" style={{ transform: `${FACE[value]} translateZ(${SIZE / 2}cqw)`, backfaceVisibility: 'hidden' }}>
      <rect x="1" y="1" width="98" height="98" rx="18" fill="#fffaf0" stroke="#c9b48f" strokeWidth="2" />
      {PIPS[value].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill={value === 1 ? '#9b2d1f' : '#2a1c12'} />
      ))}
    </svg>
  )
}

function Cube({ value, spins, offset }: { value: number; spins: number; offset: number }) {
  const [rx, ry] = SHOW[value]
  // Extra full turns each roll make the cube tumble; they don't change which face ends on top.
  const turnX = rx + spins * 720 * (offset > 0 ? 1 : -1)
  const turnY = ry + spins * 360
  return (
    <div
      className="absolute [transform-style:preserve-3d]"
      style={{
        width: `${SIZE}cqw`,
        height: `${SIZE}cqw`,
        left: `${(1.5 + offset * 0.75 - 0.5) * SIZE}cqw`,
        top: 0,
        transform: `translateZ(${SIZE / 2}cqw) rotateX(${turnX}deg) rotateY(${turnY}deg)`,
        transition: 'transform 0.65s cubic-bezier(0.2, 0.7, 0.3, 1)',
      }}
    >
      {[1, 2, 3, 4, 5, 6].map((v) => (
        <Face key={v} value={v} />
      ))}
    </div>
  )
}

/** Two real 3D dice lying on the board; they tumble whenever `rollKey` changes. */
export function Dice3D({ dice, rollKey }: { dice: [number, number] | null; rollKey: number | null }) {
  const [spins, setSpins] = useState(0)
  const [seen, setSeen] = useState(rollKey)
  if (rollKey !== seen) {
    setSeen(rollKey)
    setSpins(spins + 1)
  }
  const [a, b] = dice ?? [5, 3]
  return (
    <div
      className="relative [transform-style:preserve-3d]"
      style={{ width: `${SIZE * 3}cqw`, height: `${SIZE}cqw`, transform: 'translate(-50%, -50%)' }}
      aria-label={dice ? `Rolled ${a} and ${b}` : 'Dice'}
      role="img"
    >
      <Cube value={a} spins={spins} offset={-1} />
      <Cube value={b} spins={spins} offset={1} />
    </div>
  )
}
