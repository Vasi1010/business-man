import { ContactShadows, OrbitControls, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as THREE from 'three'
import { BOARD, GROUP_COLORS, HOTEL_LEVEL, groupIndian, type GameState, type Player } from '../../engine'
import { CORNER, placement, tileCenter } from '../boardLayout'
import { TokenBadge } from '../components/Art'
import { useAnimatedPositions, type TokenMotion } from '../hooks/useAnimatedPositions'

const SIZE = 11 // world units across the board
const TOTAL = CORNER * 2 + 9
const UNIT = SIZE / TOTAL
const TEX = 2048

/** Board tile index → world (x, z) of its centre. */
function world(tile: number): [number, number] {
  const c = tileCenter(tile)
  return [(c.x / 100 - 0.5) * SIZE, (c.y / 100 - 0.5) * SIZE]
}

function span(n: number): [number, number] {
  if (n === 1) return [0, CORNER]
  if (n === 11) return [CORNER + 9, TOTAL]
  return [CORNER + (n - 2), CORNER + (n - 1)]
}

/** Paint the board face onto a canvas (tiles, colour bands, names, owner outlines). */
function drawBoard(s: GameState): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = cv.height = TEX
  const g = cv.getContext('2d')!
  const k = TEX / TOTAL
  g.fillStyle = '#f1e3c4'
  g.fillRect(0, 0, TEX, TEX)
  g.fillStyle = '#e9d6ae'
  g.fillRect(CORNER * k, CORNER * k, 9 * k, 9 * k)
  g.save()
  g.translate(TEX / 2, TEX / 2)
  g.fillStyle = 'rgba(155,45,31,.85)'
  g.font = `${k * 1.15}px "Yatra One", Georgia, serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.rotate(-Math.PI / 4)
  g.fillText('Business-Man', 0, 0)
  g.restore()

  BOARD.forEach((tile, i) => {
    const { row, col, side } = placement(i)
    const [x0, x1] = span(col)
    const [y0, y1] = span(row)
    const [x, y, w, h] = [x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k]
    g.strokeStyle = 'rgba(42,28,18,.55)'
    g.lineWidth = 3
    g.strokeRect(x, y, w, h)
    // Rotate so text reads from outside the board, like a real board.
    g.save()
    g.translate(x + w / 2, y + h / 2)
    const rot = side === 'bottom' ? 0 : side === 'left' ? Math.PI / 2 : side === 'top' ? Math.PI : side === 'right' ? -Math.PI / 2 : 0
    g.rotate(rot)
    const tw = side === 'left' || side === 'right' ? h : w
    const th = side === 'left' || side === 'right' ? w : h
    if (tile.kind === 'city') {
      g.fillStyle = GROUP_COLORS[tile.group].hex
      g.fillRect(-tw / 2, -th / 2, tw, th * 0.24)
    }
    g.fillStyle = '#2a1c12'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const name = tile.kind === 'chest' ? 'Comm. Chest' : tile.name
    const size = side === 'corner' ? k * 0.32 : k * 0.2
    g.font = `${size}px "Yatra One", Georgia, serif`
    const words = name.length > 9 && name.includes(' ') ? name.split(' ') : [name]
    words.forEach((wd, j) => g.fillText(wd, 0, (j - (words.length - 1) / 2) * size * 1.1 + (tile.kind === 'city' ? th * 0.06 : 0), tw * 0.92))
    if (tile.kind === 'city' || tile.kind === 'service') {
      g.font = `600 ${k * 0.17}px Mukta, sans-serif`
      g.fillStyle = '#6b5442'
      g.fillText(`₹${groupIndian(tile.price)}`, 0, th * 0.34)
    }
    g.restore()
    const prop = s.properties[i]
    const owner = prop?.owner ? s.players.find((p) => p.id === prop.owner) : undefined
    if (owner) {
      g.strokeStyle = owner.color
      g.lineWidth = k * 0.07
      g.strokeRect(x + k * 0.05, y + k * 0.05, w - k * 0.1, h - k * 0.1)
    }
    if (prop?.mortgaged) {
      g.fillStyle = 'rgba(42,28,18,.25)'
      g.fillRect(x, y, w, h)
    }
  })
  return cv
}

function BoardMesh({ state, onTile }: { state: GameState; onTile: (i: number) => void }) {
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => {
    void document.fonts.load(`40px "Yatra One"`).finally(() => setFontsReady(true))
  }, [])
  const ownership = BOARD.map((_, i) => `${state.properties[i]?.owner ?? ''}${state.properties[i]?.mortgaged ? 'm' : ''}`).join(',')
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(drawBoard(state))
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
    // Redraw only when ownership/mortgages change (or fonts arrive).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownership, fontsReady])

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const x = e.point.x / SIZE + 0.5
    const z = e.point.z / SIZE + 0.5
    let best = 0
    let bestD = Infinity
    BOARD.forEach((_, i) => {
      const c = tileCenter(i)
      const d = (c.x / 100 - x) ** 2 + (c.y / 100 - z) ** 2
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    const c = tileCenter(best)
    if (Math.abs(c.x / 100 - 0.5) > 0.36 || Math.abs(c.y / 100 - 0.5) > 0.36) onTile(best)
  }

  return (
    <group>
      <RoundedBox args={[SIZE + 0.5, 0.5, SIZE + 0.5]} radius={0.12} position={[0, -0.27, 0]} receiveShadow castShadow>
        <meshStandardMaterial color="#6b3f1f" roughness={0.7} />
      </RoundedBox>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]} receiveShadow onClick={click}>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshStandardMaterial map={texture} roughness={0.85} />
      </mesh>
    </group>
  )
}

/** Houses (green) and hotels (red) on each city's colour band. */
function Buildings({ state }: { state: GameState }) {
  const items: { key: string; pos: [number, number, number]; hotel: boolean }[] = []
  BOARD.forEach((t, i) => {
    const level = state.properties[i]?.level ?? 0
    if (t.kind !== 'city' || level === 0) return
    const { side } = placement(i)
    const [cx, cz] = world(i)
    const inward = 0.35 * UNIT * 1.55
    const [dx, dz] = side === 'bottom' ? [0, -inward] : side === 'top' ? [0, inward] : side === 'left' ? [inward, 0] : [-inward, 0]
    const along: [number, number] = side === 'bottom' || side === 'top' ? [1, 0] : [0, 1]
    if (level === HOTEL_LEVEL) items.push({ key: `${i}h`, pos: [cx + dx, 0, cz + dz], hotel: true })
    else
      for (let n = 0; n < level; n++) {
        const off = (n - (level - 1) / 2) * 0.26
        items.push({ key: `${i}-${n}`, pos: [cx + dx + along[0] * off, 0, cz + dz + along[1] * off], hotel: false })
      }
  })
  return (
    <group>
      {items.map((b) => (
        <group key={b.key} position={b.pos}>
          <mesh position={[0, b.hotel ? 0.13 : 0.08, 0]} castShadow>
            <boxGeometry args={b.hotel ? [0.5, 0.26, 0.26] : [0.18, 0.16, 0.18]} />
            <meshStandardMaterial color={b.hotel ? '#c0392b' : '#3f8a3a'} roughness={0.5} />
          </mesh>
          <mesh position={[0, b.hotel ? 0.32 : 0.2, 0]} rotation-y={Math.PI / 4} castShadow>
            <coneGeometry args={b.hotel ? [0.24, 0.14, 4] : [0.15, 0.1, 4]} />
            <meshStandardMaterial color={b.hotel ? '#8e2a20' : '#2d6b29'} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

const PAWN_PROFILE = [
  [0, 0],
  [0.3, 0],
  [0.3, 0.06],
  [0.24, 0.1],
  [0.13, 0.2],
  [0.09, 0.42],
  [0.16, 0.47],
  [0.09, 0.52],
  [0.17, 0.62],
  [0.18, 0.72],
  [0.12, 0.82],
  [0, 0.86],
].map(([x, y]) => new THREE.Vector2(x, y))

function useTokenTexture(p: Player) {
  return useMemo(() => {
    const svg = renderToStaticMarkup(<TokenBadge token={p.token} color={p.color} size={128} ring />)
    const t = new THREE.TextureLoader().load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'))}`)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [p.token, p.color])
}

const OFFSETS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
  [0, -1.6],
  [0, 1.6],
]

/** A turned wooden pawn in the player's colour, wearing their token as a medallion. It hops tile to tile. */
function Pawn({ player, target, hop, stepMs }: { player: Player; target: [number, number]; hop: number; stepMs: number }) {
  const ref = useRef<THREE.Group>(null)
  const anim = useRef({ from: target, to: target, start: 0, hop })
  const texture = useTokenTexture(player)
  const geometry = useMemo(() => new THREE.LatheGeometry(PAWN_PROFILE, 32), [])

  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const a = anim.current
    const now = clock.elapsedTime * 1000
    if (a.to[0] !== target[0] || a.to[1] !== target[1]) {
      a.from = [g.position.x, g.position.z]
      a.to = target
      a.start = now
      a.hop = hop
    }
    const t = Math.min(1, (now - a.start) / Math.max(stepMs, 120))
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    g.position.x = a.from[0] + (a.to[0] - a.from[0]) * e
    g.position.z = a.from[1] + (a.to[1] - a.from[1]) * e
    g.position.y = t < 1 ? Math.sin(t * Math.PI) * 0.45 : 0
  })

  return (
    <group ref={ref} position={[target[0], 0, target[1]]}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial color={player.color} roughness={0.35} metalness={0.1} />
      </mesh>
      <sprite position={[0, 1.15, 0]} scale={[0.55, 0.55, 0.55]}>
        <spriteMaterial map={texture} transparent />
      </sprite>
    </group>
  )
}

function Pawns({ state, motion }: { state: GameState; motion: TokenMotion }) {
  const byTile = new Map<number, Player[]>()
  for (const p of state.players) {
    if (p.bankrupt) continue
    const pos = motion.positions[p.id] ?? p.position
    byTile.set(pos, [...(byTile.get(pos) ?? []), p])
  }
  return (
    <group>
      {[...byTile.entries()].flatMap(([tile, group]) =>
        group.map((p, i) => {
          const [x, z] = world(tile)
          const [ox, oz] = group.length === 1 ? [0, 0] : OFFSETS[i % OFFSETS.length]
          return (
            <Pawn
              key={p.id}
              player={p}
              target={[x + ox * 0.22, z + oz * 0.22]}
              hop={motion.hops[p.id] ?? 0}
              stepMs={motion.stepMs[p.id] ?? 220}
            />
          )
        }),
      )}
    </group>
  )
}

const DIE_ROT: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
  5: [Math.PI / 2, 0, 0],
  6: [Math.PI, 0, 0],
}

function dieFace(n: number): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#fffaf0'
  g.fillRect(0, 0, 128, 128)
  const pips: Record<number, [number, number][]> = {
    1: [[64, 64]],
    2: [[36, 36], [92, 92]],
    3: [[32, 32], [64, 64], [96, 96]],
    4: [[36, 36], [92, 36], [36, 92], [92, 92]],
    5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]],
    6: [[36, 30], [92, 30], [36, 64], [92, 64], [36, 98], [92, 98]],
  }
  g.fillStyle = n === 1 ? '#9b2d1f' : '#2a1c12'
  for (const [x, y] of pips[n]) {
    g.beginPath()
    g.arc(x, y, 11, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Box face order in three.js: +x, -x, +y, -y, +z, -z → values placed so +y shows "1" at rest. */
const FACE_ORDER = [3, 4, 1, 6, 2, 5]

function Die({ value, rollKey, x, onClick }: { value: number; rollKey: number; x: number; onClick?: () => void }) {
  const ref = useRef<THREE.Mesh>(null)
  const materials = useMemo(() => FACE_ORDER.map((n) => new THREE.MeshStandardMaterial({ map: dieFace(n), roughness: 0.4 })), [])
  const anim = useRef({ key: rollKey, start: -1 })
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const now = clock.elapsedTime
    const a = anim.current
    if (a.key !== rollKey) {
      a.key = rollKey
      a.start = now
    }
    const t = a.start < 0 ? 1 : Math.min(1, (now - a.start) / 0.75)
    const [rx, ry, rz] = DIE_ROT[value]
    const spin = (1 - t) * 4 * Math.PI
    m.rotation.set(rx + spin, ry + spin * 0.6, rz + spin * 0.3)
    m.position.y = 0.21 + Math.abs(Math.sin(t * Math.PI * 2.5)) * (1 - t) * 1.2
  })
  return (
    <mesh
      ref={ref}
      position={[x, 0.21, 0.6]}
      material={materials}
      castShadow
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      onPointerOver={() => onClick && (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <boxGeometry args={[0.42, 0.42, 0.42]} />
    </mesh>
  )
}

export default function Scene3D({ state, onTile, onDiceClick }: { state: GameState; onTile: (i: number) => void; onDiceClick?: () => void }) {
  const motion = useAnimatedPositions(state.players)
  const [a, b] = state.lastRoll?.dice ?? [5, 3]
  const key = state.lastRoll?.seq ?? 0
  return (
    <Canvas shadows camera={{ position: [0, 11, 10], fov: 40 }} dpr={[1, 2]} style={{ touchAction: 'none' }}>
      <color attach="background" args={['#2b2018']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 12, 5]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />
      <hemisphereLight args={['#fff1d6', '#3a2a1c', 0.35]} />
      <BoardMesh state={state} onTile={onTile} />
      <Buildings state={state} />
      <Pawns state={state} motion={motion} />
      <Die value={a} rollKey={key} x={-0.35} onClick={onDiceClick} />
      <Die value={b} rollKey={key} x={0.35} onClick={onDiceClick} />
      <ContactShadows position={[0, -0.53, 0]} opacity={0.5} scale={20} blur={2.5} far={4} />
      <OrbitControls enablePan={false} minDistance={7} maxDistance={20} maxPolarAngle={Math.PI / 2.4} target={[0, 0, 0]} />
    </Canvas>
  )
}
