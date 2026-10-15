import { ContactShadows, Environment, Html, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { BOARD, HOTEL_LEVEL, groupIndian, type GameState, type Player } from '../../engine'
import { useMoneyFx } from '../../store/moneyFx'
import { placement, tileCenter } from '../boardLayout'
import { useAnimatedPositions, type TokenMotion } from '../hooks/useAnimatedPositions'
import { TOTAL, drawBoard, loadIcons, woodTexture } from './boardTexture'

const SIZE = 11 // world units across the playing surface
const UNIT = SIZE / TOTAL

/** Board tile index → world (x, z) of its centre. */
function world(tile: number): [number, number] {
  const c = tileCenter(tile)
  return [(c.x / 100 - 0.5) * SIZE, (c.y / 100 - 0.5) * SIZE]
}

function canvasTexture(cv: HTMLCanvasElement, repeat = 1) {
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (repeat !== 1) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeat, repeat)
  }
  return t
}

/* -------------------------------- quality ------------------------------- */

/**
 * Battery saver: redraw only when something changes (dice, pawns, buildings, camera)
 * instead of 60 times a second, at lower resolution, with cheaper materials and shadows.
 */
const SaverContext = createContext(false)
const useSaver = () => useContext(SaverContext)

/** Ask for one more frame. In always-redraw mode this is a no-op. */
function useInvalidate() {
  return useThree((s) => s.invalidate)
}

/** Glossy lacquer; plain standard material in battery saver. */
function Lacquer({
  clearcoat = 0.6,
  clearcoatRoughness = 0.15,
  sheen,
  ...props
}: {
  color: string
  roughness: number
  clearcoat?: number
  clearcoatRoughness?: number
  sheen?: number
  map?: THREE.Texture
  metalness?: number
  emissive?: string
  emissiveIntensity?: number
}) {
  return useSaver() ? (
    <meshStandardMaterial {...props} />
  ) : (
    <meshPhysicalMaterial {...props} clearcoat={clearcoat} clearcoatRoughness={clearcoatRoughness} sheen={sheen} />
  )
}

/** Counts frames actually drawn, reported once a second. */
function FrameCounter({ onRate }: { onRate: (perSecond: number) => void }) {
  const count = useRef(0)
  useFrame(() => {
    count.current++
  })
  useEffect(() => {
    const id = setInterval(() => {
      onRate(count.current)
      count.current = 0
    }, 1000)
    return () => clearInterval(id)
  }, [onRate])
  return null
}

/** Redraw once whenever `value` changes (state updates, money tags...). */
function RedrawOn({ value }: { value: unknown }) {
  const invalidate = useInvalidate()
  useEffect(() => {
    invalidate()
  }, [value, invalidate])
  return null
}

/* --------------------------------- board -------------------------------- */

function BoardMesh({ state, onTile }: { state: GameState; onTile: (i: number) => void }) {
  const gl = useThree((s) => s.gl)
  const [ready, setReady] = useState<Awaited<ReturnType<typeof loadIcons>> | null>(null)
  useEffect(() => {
    let alive = true
    void Promise.all([document.fonts.load('40px "Yatra One"'), document.fonts.load('600 40px Mukta'), loadIcons()]).then(([, , icons]) => {
      if (alive) setReady(icons)
    })
    return () => {
      alive = false
    }
  }, [])

  const texSize = Math.min(2048, gl.capabilities.maxTextureSize)
  const signature = BOARD.map((_, i) => `${state.properties[i]?.owner ?? ''}${state.properties[i]?.mortgaged ? 'm' : ''}`).join(',')
  const face = useMemo(
    () => (ready ? canvasTexture(drawBoard(state, ready, texSize)) : null),
    // Repaint only when ownership or mortgages change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, ready, texSize],
  )
  const frameWood = useMemo(() => canvasTexture(woodTexture('#5a2f17', '#2a1208'), 2), [])

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
      {/* Lacquered wooden frame */}
      <RoundedBox args={[SIZE + 0.9, 0.42, SIZE + 0.9]} radius={0.16} smoothness={5} position={[0, -0.2, 0]} castShadow receiveShadow>
        <Lacquer map={frameWood} color="#a0603a" roughness={0.38} clearcoat={0.8} clearcoatRoughness={0.25} />
      </RoundedBox>
      {/* Printed board face */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} receiveShadow onClick={click}>
        <planeGeometry args={[SIZE, SIZE]} />
        {/* Keyed so the material is rebuilt (not patched) once the artwork is ready. */}
        <meshStandardMaterial key={face ? face.uuid : 'plain'} map={face} color={face ? '#ffffff' : '#f4e8cc'} roughness={0.78} />
      </mesh>
    </group>
  )
}

function Table() {
  const wood = useMemo(() => canvasTexture(woodTexture('#3b2414', '#120804', 1024), 3), [])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.42, 0]} receiveShadow>
      <circleGeometry args={[30, 64]} />
      <meshStandardMaterial map={wood} roughness={0.55} />
    </mesh>
  )
}

/** Soft pulsing glow on the tile the current player must decide about. */
function Highlight({ tile }: { tile: number | null }) {
  const ref = useRef<THREE.Mesh>(null)
  const saver = useSaver()
  useFrame(({ clock }) => {
    const m = ref.current?.material as THREE.MeshBasicMaterial | undefined
    // Battery saver keeps a steady glow so the scene can rest between moves.
    if (m) m.opacity = saver ? 0.28 : 0.18 + Math.sin(clock.elapsedTime * 4) * 0.1
  })
  if (tile === null) return null
  const { side } = placement(tile)
  const [x, z] = world(tile)
  const long = 1.55 * UNIT
  const [w, d] = side === 'corner' ? [long, long] : side === 'left' || side === 'right' ? [long, UNIT] : [UNIT, long]
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position={[x, 0.02, z]}>
      <planeGeometry args={[w * 0.96, d * 0.96]} />
      <meshBasicMaterial color="#ffd36b" transparent opacity={0.25} toneMapped={false} />
    </mesh>
  )
}

/* ------------------------------- buildings ------------------------------ */

function roofGeometry(w: number, d: number, h: number) {
  const shape = new THREE.Shape()
  shape.moveTo(-w / 2, 0)
  shape.lineTo(w / 2, 0)
  shape.lineTo(0, h)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false })
  geo.translate(0, 0, -d / 2)
  return geo
}

function House({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const roof = useMemo(() => roofGeometry(0.26, 0.22, 0.12), [])
  return (
    <group position={position} rotation-y={rotation}>
      <RoundedBox args={[0.2, 0.15, 0.18]} radius={0.015} position={[0, 0.075, 0]} castShadow>
        <Lacquer color="#3f9a45" roughness={0.35} clearcoat={0.6} />
      </RoundedBox>
      <mesh geometry={roof} position={[0, 0.15, 0]} castShadow>
        <Lacquer color="#246b2c" roughness={0.4} clearcoat={0.5} />
      </mesh>
    </group>
  )
}

function Hotel({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const roof = useMemo(() => roofGeometry(0.5, 0.28, 0.14), [])
  return (
    <group position={position} rotation-y={rotation}>
      <RoundedBox args={[0.46, 0.26, 0.24]} radius={0.02} position={[0, 0.13, 0]} castShadow>
        <Lacquer color="#c8352a" roughness={0.32} clearcoat={0.7} />
      </RoundedBox>
      {[-0.13, 0, 0.13].map((x) => (
        <mesh key={x} position={[x, 0.15, 0.121]}>
          <planeGeometry args={[0.07, 0.08]} />
          <meshStandardMaterial color="#ffe9a8" emissive="#ffcf66" emissiveIntensity={0.35} />
        </mesh>
      ))}
      <mesh geometry={roof} position={[0, 0.26, 0]} castShadow>
        <Lacquer color="#8e2219" roughness={0.4} clearcoat={0.5} />
      </mesh>
    </group>
  )
}

function Buildings({ state }: { state: GameState }) {
  const items: { key: string; pos: [number, number, number]; rot: number; hotel: boolean }[] = []
  BOARD.forEach((t, i) => {
    const level = state.properties[i]?.level ?? 0
    if (t.kind !== 'city' || level === 0) return
    const { side } = placement(i)
    const [cx, cz] = world(i)
    // Sit on the colour band, which is on the inner edge of the tile.
    const inward = 0.58 * UNIT
    const [dx, dz] = side === 'bottom' ? [0, -inward] : side === 'top' ? [0, inward] : side === 'left' ? [inward, 0] : [-inward, 0]
    const rot = side === 'bottom' ? 0 : side === 'top' ? Math.PI : side === 'left' ? Math.PI / 2 : -Math.PI / 2
    const along: [number, number] = side === 'bottom' || side === 'top' ? [1, 0] : [0, 1]
    if (level === HOTEL_LEVEL) items.push({ key: `${i}h`, pos: [cx + dx, 0.012, cz + dz], rot, hotel: true })
    else
      for (let n = 0; n < level; n++) {
        const off = (n - (level - 1) / 2) * 0.27
        items.push({ key: `${i}-${n}`, pos: [cx + dx + along[0] * off, 0.012, cz + dz + along[1] * off], rot, hotel: false })
      }
  })
  return (
    <group>
      {items.map((b) => (b.hotel ? <Hotel key={b.key} position={b.pos} rotation={b.rot} /> : <House key={b.key} position={b.pos} rotation={b.rot} />))}
    </group>
  )
}

/* --------------------------------- pawns -------------------------------- */

/** Classic turned pawn: wide base, collar, slim waist, ball head. */
const PAWN_PROFILE = [
  [0, 0],
  [0.3, 0],
  [0.315, 0.025],
  [0.3, 0.06],
  [0.25, 0.085],
  [0.27, 0.11],
  [0.25, 0.14],
  [0.18, 0.17],
  [0.13, 0.25],
  [0.1, 0.36],
  [0.085, 0.45],
  [0.17, 0.48],
  [0.185, 0.51],
  [0.17, 0.54],
  [0.09, 0.56],
  [0.1, 0.58],
  [0.16, 0.62],
  [0.19, 0.68],
  [0.19, 0.74],
  [0.165, 0.8],
  [0.12, 0.85],
  [0.06, 0.875],
  [0, 0.882],
].map(([x, y]) => new THREE.Vector2(x, y))

const OFFSETS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
  [0, -1.6],
  [0, 1.6],
]

const MARKER_SECONDS = 2.5

/** Gold marker bobbing over the pawn whose turn it is. */
function TurnMarker() {
  const ref = useRef<THREE.Group>(null)
  const saver = useSaver()
  const startedAt = useRef(-1)
  useFrame(({ clock, invalidate }) => {
    const g = ref.current
    if (!g) return
    if (startedAt.current < 0) startedAt.current = clock.elapsedTime
    const age = clock.elapsedTime - startedAt.current
    // Battery saver: bob for a moment when the turn starts, then hold still.
    if (saver && age > MARKER_SECONDS) return
    g.position.y = 1.2 + Math.sin(age * 3) * 0.07
    g.rotation.y = age * 1.6
    if (saver) invalidate()
  })
  return (
    <group ref={ref} position={[0, 1.2, 0]}>
      <mesh rotation-x={Math.PI}>
        <coneGeometry args={[0.13, 0.24, 4]} />
        <Lacquer color="#f4c21b" metalness={0.6} roughness={0.25} emissive="#7a5a00" emissiveIntensity={0.4} clearcoat={0} />
      </mesh>
    </group>
  )
}

/** Red/green amounts that rise from the pawn when its player pays or earns. */
function MoneyTags({ playerId }: { playerId: string }) {
  const bursts = useMoneyFx((s) => s.bursts).filter((b) => b.playerId === playerId)
  return bursts.map((b, i) => (
    <Html key={b.id} position={[0, 1.15 + i * 0.45, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`money-tag ${b.amount > 0 ? 'money-tag-gain' : 'money-tag-loss'}`}>
        {b.amount > 0 ? '+' : '−'}₹{groupIndian(Math.abs(b.amount))}
      </div>
    </Html>
  ))
}

/** A turned, lacquered pawn in the player's colour. */
function Pawn({ player, target, stepMs, active }: { player: Player; target: [number, number]; stepMs: number; active: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const anim = useRef({ from: target, to: target, start: -1 })
  const geometry = useMemo(() => new THREE.LatheGeometry(PAWN_PROFILE, 48), [])
  // Placed once; after that the frame loop moves it, so it glides instead of snapping.
  const [initial] = useState(target)
  const invalidate = useInvalidate()
  useEffect(() => {
    invalidate()
  }, [target[0], target[1], invalidate]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ clock, invalidate }) => {
    const g = ref.current
    if (!g) return
    const a = anim.current
    const now = clock.elapsedTime * 1000
    if (a.to[0] !== target[0] || a.to[1] !== target[1]) {
      a.from = [g.position.x, g.position.z]
      a.to = target
      a.start = now
    }
    const t = a.start < 0 ? 1 : Math.min(1, (now - a.start) / Math.max(stepMs, 120))
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    g.position.x = a.from[0] + (a.to[0] - a.from[0]) * e
    g.position.z = a.from[1] + (a.to[1] - a.from[1]) * e
    g.position.y = t < 1 ? Math.sin(t * Math.PI) * 0.5 : 0.012
    // Squash slightly on landing.
    const squash = t < 1 && t > 0.85 ? 1 - (1 - (t - 0.85) / 0.15) * 0.08 : 1
    g.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash))
    if (t < 1) invalidate()
  })

  return (
    <group ref={ref} position={[initial[0], 0.012, initial[1]]}>
      <mesh geometry={geometry} castShadow scale={1.1}>
        <Lacquer color={player.color} roughness={0.22} clearcoat={1} clearcoatRoughness={0.1} sheen={0.3} />
      </mesh>
      {player.inJail && (
        <mesh position={[0, 0.62, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.2, 0.025, 8, 24]} />
          <meshStandardMaterial color="#555" metalness={0.8} roughness={0.3} />
        </mesh>
      )}
      {active && <TurnMarker />}
      <MoneyTags playerId={player.id} />
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
              stepMs={motion.stepMs[p.id] ?? 220}
              active={state.turn.playerId === p.id && state.status === 'playing'}
            />
          )
        }),
      )}
    </group>
  )
}

/* --------------------------------- dice --------------------------------- */

const DIE = 0.56
/** Rotation that brings each value to the top (+y). Faces: 1 +y, 6 -y, 2 +z, 5 -z, 3 +x, 4 -x. */
const DIE_ROT: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
  5: [Math.PI / 2, 0, 0],
  6: [Math.PI, 0, 0],
}
const PIP_UV: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
}
/** Face normal and two in-plane axes for each value. */
const FACES: Record<number, [THREE.Vector3, THREE.Vector3, THREE.Vector3]> = {
  1: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)],
  6: [new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)],
  2: [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
  5: [new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
  3: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)],
  4: [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)],
}

const PIPS = (() => {
  const out: { pos: [number, number, number]; red: boolean }[] = []
  for (let v = 1; v <= 6; v++) {
    const [n, a, b] = FACES[v]
    for (const [u, w] of PIP_UV[v]) {
      const p = n.clone().multiplyScalar(DIE / 2 - 0.006).addScaledVector(a, u * DIE * 0.25).addScaledVector(b, w * DIE * 0.25)
      out.push({ pos: [p.x, p.y, p.z], red: v === 1 })
    }
  }
  return out
})()

function Die({ value, rollKey, x, onClick }: { value: number; rollKey: number; x: number; onClick?: () => void }) {
  const ref = useRef<THREE.Group>(null)
  const anim = useRef({ key: rollKey, start: -1 })
  const invalidate = useInvalidate()
  useEffect(() => {
    invalidate()
  }, [rollKey, value, invalidate])
  useFrame(({ clock, invalidate }) => {
    const m = ref.current
    if (!m) return
    const now = clock.elapsedTime
    const a = anim.current
    if (a.key !== rollKey) {
      a.key = rollKey
      a.start = now
    }
    const t = a.start < 0 ? 1 : Math.min(1, (now - a.start) / 0.8)
    const [rx, ry, rz] = DIE_ROT[value]
    const spin = (1 - t) ** 2 * 5 * Math.PI
    m.rotation.set(rx + spin, ry + spin * 0.7, rz + spin * 0.4)
    m.position.y = DIE / 2 + 0.012 + Math.abs(Math.sin(t * Math.PI * 2.5)) * (1 - t) ** 1.5 * 1.3
    m.position.x = x + (1 - t) * x * 1.5
    if (t < 1) invalidate()
  })
  return (
    <group
      ref={ref}
      position={[x, DIE / 2, 1.55]}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      onPointerOver={() => onClick && (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <RoundedBox args={[DIE, DIE, DIE]} radius={0.07} smoothness={6} castShadow>
        <Lacquer color="#fffaf0" roughness={0.25} clearcoat={1} clearcoatRoughness={0.1} />
      </RoundedBox>
      {PIPS.map((p, i) => (
        <mesh key={i} position={p.pos}>
          <sphereGeometry args={[0.048, 16, 12]} />
          <meshStandardMaterial color={p.red ? '#9b2d1f' : '#22160e'} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

/* --------------------------------- scene -------------------------------- */

/** Place the camera so the whole board fits, whatever the screen's shape. */
function CameraFit() {
  const { camera, size, invalidate } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const aspect = size.width / size.height
    const vfov = (cam.fov * Math.PI) / 180
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect)
    const half = (SIZE + 1) / 2
    // Portrait phones look down more steeply so the board fills the narrow view.
    const steep = aspect < 1
    const dir = new THREE.Vector3(0, steep ? 2.2 : 1.15, 1).normalize()
    // Distance to fit the width (front edge is nearest, so allow a little extra), and the tilted depth.
    const fitWidth = (half * 1.08) / Math.tan(hfov / 2) + half * 0.15
    const fitDepth = (half * (dir.y + dir.z * 0.35)) / Math.tan(vfov / 2)
    const dist = Math.max(fitWidth, fitDepth, 11)
    cam.position.copy(dir.multiplyScalar(dist))
    cam.lookAt(0, 0, 0.4)
    cam.updateProjectionMatrix()
    invalidate()
  }, [camera, size.width, size.height, invalidate])
  return null
}

export default function Scene3D({
  state,
  onTile,
  onDiceClick,
  status,
  saver = false,
  onFrameRate,
}: {
  state: GameState
  onTile: (i: number) => void
  onDiceClick?: () => void
  /** Optional line shown over the scene, e.g. whose turn it is. */
  status?: ReactNode
  /** Battery saver: redraw only on change, lighter rendering. */
  saver?: boolean
  /** Called once a second with how many frames were drawn. */
  onFrameRate?: (perSecond: number) => void
}) {
  const motion = useAnimatedPositions(state.players)
  const [a, b] = state.lastRoll?.dice ?? [5, 3]
  const key = state.lastRoll?.seq ?? 0
  const highlight = state.auction?.tile ?? state.turn.pendingTile
  const [view, setView] = useState(0)
  const bursts = useMoneyFx((s) => s.bursts)
  return (
    <div className="relative h-full w-full">
      {/* pan-y keeps vertical swipes scrolling the page; sideways drags spin the board. */}
      <Canvas
        shadows
        frameloop={saver ? 'demand' : 'always'}
        camera={{ position: [0, 10.5, 10.5], fov: 38 }}
        dpr={saver ? [1, 1.5] : [1, 2]}
        style={{ touchAction: 'pan-y' }}
      >
        <SaverContext.Provider value={saver}>
          {onFrameRate && <FrameCounter onRate={onFrameRate} />}
          <RedrawOn value={state} />
          <RedrawOn value={motion} />
          <RedrawOn value={bursts} />
          <color attach="background" args={['#1d140d']} />
          <fog attach="fog" args={['#1d140d', 22, 40]} />
          <ambientLight intensity={0.3} />
          <directionalLight
            position={[5, 13, 6]}
            intensity={2.2}
            color="#fff1dc"
            castShadow
            shadow-mapSize={saver ? [1024, 1024] : [2048, 2048]}
            shadow-camera-left={-9}
            shadow-camera-right={9}
            shadow-camera-top={9}
            shadow-camera-bottom={-9}
            shadow-bias={-0.0004}
            shadow-radius={6}
          />
          <pointLight position={[-8, 5, -6]} intensity={30} color="#ffb070" distance={30} />
          {/* Studio reflections without downloading an HDR file */}
          <Environment resolution={256}>
            <Lightformer form="rect" intensity={2} position={[0, 6, 4]} scale={[10, 4, 1]} rotation-x={-Math.PI / 3} />
            <Lightformer form="rect" intensity={1} color="#ffd9a8" position={[-6, 3, -4]} scale={[6, 3, 1]} rotation-y={Math.PI / 3} />
            <Lightformer form="circle" intensity={1.5} position={[6, 4, -2]} scale={2} />
          </Environment>
          <CameraFit key={`fit-${view}`} />
          <Table />
          <BoardMesh state={state} onTile={onTile} />
          <Highlight tile={highlight} />
          <Buildings state={state} />
          <Pawns state={state} motion={motion} />
          <Die value={a} rollKey={key} x={-0.42} onClick={onDiceClick} />
          <Die value={b} rollKey={key} x={0.42} onClick={onDiceClick} />
          {/* Re-renders every frame; the sun's shadows are enough in battery saver. */}
          {!saver && <ContactShadows position={[0, 0.014, 0]} opacity={0.35} scale={SIZE} blur={2} far={1.5} resolution={512} />}
          <OrbitControls
            key={`orbit-${view}`}
            target={[0, 0, 0.4]}
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            minDistance={7}
            maxDistance={34}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI / 2.35}
            touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
          />
        </SaverContext.Provider>
      </Canvas>
      {status && (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-2">
          <div className="rounded-full bg-black/55 px-3 py-1 text-sm font-semibold text-white shadow backdrop-blur-sm" aria-live="polite">
            {status}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setView((v) => v + 1)}
        className="absolute bottom-2 right-2 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/70"
      >
        Reset view
      </button>
    </div>
  )
}
