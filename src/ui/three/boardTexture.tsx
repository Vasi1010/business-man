import { renderToStaticMarkup } from 'react-dom/server'
import { BOARD, GROUP_COLORS, groupIndian, type GameState, type ServiceTile, type SimpleTileKind } from '../../engine'
import { CORNER, placement } from '../boardLayout'
import { TileIcon } from '../components/Art'

export const TOTAL = CORNER * 2 + 9

type IconKind = ServiceTile['icon'] | SimpleTileKind
const ICONS: IconKind[] = ['train', 'bus', 'plane', 'boat', 'bulb', 'tap', 'chance', 'chest', 'incomeTax', 'wealthTax', 'club', 'restHouse', 'jail', 'start']
const ICON_COLOR: Partial<Record<IconKind, string>> = { chance: '#c2417a', chest: '#0b7a75' }

const PAPER = '#f4e8cc'
const INK = '#2a1c12'
const MUTED = '#6b5442'
const BRAND = '#9b2d1f'
const GOLD = '#c99a2e'

const CORNER_STYLE: Partial<Record<SimpleTileKind, { bg: string; label: string; sub: string }>> = {
  start: { bg: '#f5d38c', label: 'START', sub: 'Collect salary' },
  jail: { bg: '#e6c9bd', label: 'JAIL', sub: 'Just visiting' },
  club: { bg: '#cfe2c0', label: 'CLUB', sub: 'Pay everyone' },
  restHouse: { bg: '#c9dfe9', label: 'REST HOUSE', sub: 'Put your feet up' },
}

let iconCache: Promise<Map<IconKind, HTMLImageElement>> | null = null

/** Render the app's SVG tile icons to images once, for drawing onto the board. */
export function loadIcons(): Promise<Map<IconKind, HTMLImageElement>> {
  iconCache ??= Promise.all(
    ICONS.map(
      (kind) =>
        new Promise<[IconKind, HTMLImageElement]>((resolve) => {
          const svg = renderToStaticMarkup(<TileIcon kind={kind} />)
            .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"')
            .replaceAll('currentColor', ICON_COLOR[kind] ?? BRAND)
          const img = new Image()
          img.onload = () => resolve([kind, img])
          img.onerror = () => resolve([kind, img])
          img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        }),
    ),
  ).then((entries) => new Map(entries))
  return iconCache
}

function span(n: number): [number, number] {
  if (n === 1) return [0, CORNER]
  if (n === 11) return [CORNER + 9, TOTAL]
  return [CORNER + (n - 2), CORNER + (n - 1)]
}

/** Deterministic pseudo-random for paper grain. */
function grain(g: CanvasRenderingContext2D, size: number, alpha: number) {
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  g.save()
  for (let i = 0; i < size * 6; i++) {
    g.fillStyle = `rgba(90,60,30,${rand() * alpha})`
    g.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2)
  }
  g.restore()
}

function rangoli(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const colors = Object.values(GROUP_COLORS).map((c) => c.hex)
  g.save()
  g.translate(cx, cy)
  g.globalAlpha = 0.16
  for (let ring = 0; ring < 3; ring++) {
    const petals = 8 + ring * 8
    const rr = r * (1 - ring * 0.27)
    for (let i = 0; i < petals; i++) {
      g.save()
      g.rotate((i / petals) * Math.PI * 2 + ring * 0.2)
      g.fillStyle = colors[(i + ring * 3) % colors.length]
      g.beginPath()
      g.moveTo(0, rr * 0.35)
      g.quadraticCurveTo(rr * 0.16, rr * 0.7, 0, rr)
      g.quadraticCurveTo(-rr * 0.16, rr * 0.7, 0, rr * 0.35)
      g.fill()
      g.restore()
    }
  }
  g.globalAlpha = 0.5
  g.strokeStyle = GOLD
  g.lineWidth = r * 0.012
  for (const k of [0.32, 1.04]) {
    g.beginPath()
    g.arc(0, 0, r * k, 0, Math.PI * 2)
    g.stroke()
  }
  g.restore()
}

function cardPile(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, angle: number, color: string, label: string, icon: HTMLImageElement | undefined) {
  g.save()
  g.translate(x, y)
  g.rotate(angle)
  for (let i = 3; i >= 0; i--) {
    g.fillStyle = i === 0 ? color : 'rgba(0,0,0,.12)'
    g.beginPath()
    g.roundRect(-w / 2 + i * 3, -h / 2 + i * 3, w, h, w * 0.08)
    g.fill()
  }
  g.strokeStyle = 'rgba(255,255,255,.75)'
  g.lineWidth = w * 0.02
  g.beginPath()
  g.roundRect(-w / 2 + w * 0.06, -h / 2 + w * 0.06, w * 0.88, h - w * 0.12, w * 0.05)
  g.stroke()
  g.fillStyle = '#fff8ee'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `${w * 0.15}px "Yatra One", Georgia, serif`
  label.split(' ').forEach((wd, j, arr) => g.fillText(wd, 0, h * 0.2 + (j - (arr.length - 1) / 2) * w * 0.17))
  if (icon) {
    g.globalAlpha = 0.9
    g.filter = 'brightness(0) invert(1)'
    g.drawImage(icon, -w * 0.22, -h * 0.3, w * 0.44, w * 0.44)
    g.filter = 'none'
  }
  g.restore()
}

/** Paint the full board face (tiles, bands, icons, owners, centre art). */
export function drawBoard(s: GameState, icons: Map<IconKind, HTMLImageElement>, size: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const g = cv.getContext('2d')!
  const k = size / TOTAL

  g.fillStyle = PAPER
  g.fillRect(0, 0, size, size)
  grain(g, size, 0.05)

  // Centre
  const c0 = CORNER * k
  const c1 = (CORNER + 9) * k
  g.fillStyle = '#ecdcb6'
  g.fillRect(c0, c0, c1 - c0, c1 - c0)
  g.strokeStyle = GOLD
  g.lineWidth = k * 0.03
  g.strokeRect(c0 + k * 0.18, c0 + k * 0.18, c1 - c0 - k * 0.36, c1 - c0 - k * 0.36)
  rangoli(g, size / 2, size / 2, k * 3.2)
  g.save()
  g.translate(size / 2, size / 2)
  g.rotate(-Math.PI / 4)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = 'rgba(0,0,0,.18)'
  g.font = `${k * 1.05}px "Yatra One", Georgia, serif`
  g.fillText('Business-Man', k * 0.04, k * 0.06)
  g.fillStyle = BRAND
  g.fillText('Business-Man', 0, 0)
  g.font = `600 ${k * 0.26}px Mukta, sans-serif`
  g.fillStyle = MUTED
  g.fillText('BUY  ·  BUILD  ·  PROSPER', 0, k * 0.78)
  g.restore()
  cardPile(g, size / 2 - k * 2.5, size / 2 - k * 2.5, k * 1.7, k * 2.4, -Math.PI / 4, '#c2417a', 'Chance', icons.get('chance'))
  cardPile(g, size / 2 + k * 2.5, size / 2 + k * 2.5, k * 1.7, k * 2.4, -Math.PI / 4 + Math.PI, '#0b7a75', 'Community Chest', icons.get('chest'))

  BOARD.forEach((tile, i) => {
    const { row, col, side } = placement(i)
    const [x0, x1] = span(col)
    const [y0, y1] = span(row)
    const [x, y, w, h] = [x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k]
    const corner = side === 'corner' ? CORNER_STYLE[tile.kind as SimpleTileKind] : undefined
    if (corner) {
      g.fillStyle = corner.bg
      g.fillRect(x, y, w, h)
    }

    g.save()
    g.translate(x + w / 2, y + h / 2)
    // Text reads from outside the board, like a printed board.
    const rot = side === 'bottom' ? 0 : side === 'left' ? Math.PI / 2 : side === 'top' ? Math.PI : side === 'right' ? -Math.PI / 2 : 0
    // Corner art sits diagonally, readable from the near (bottom) edge.
    const cornerRot = (row === 11) === (col === 11) ? -Math.PI / 4 : Math.PI / 4
    g.rotate(corner ? cornerRot : rot)
    const tw = side === 'left' || side === 'right' ? h : w
    const th = side === 'left' || side === 'right' ? w : h
    g.textAlign = 'center'
    g.textBaseline = 'middle'

    if (corner) {
      const icon = icons.get(tile.kind as IconKind)
      if (icon) g.drawImage(icon, -k * 0.38, -k * 0.62, k * 0.76, k * 0.76)
      g.fillStyle = INK
      g.font = `${k * 0.27}px "Yatra One", Georgia, serif`
      g.fillText(corner.label, 0, k * 0.28)
      g.fillStyle = MUTED
      g.font = `500 ${k * 0.15}px Mukta, sans-serif`
      g.fillText(tile.kind === 'start' ? `Collect ₹${groupIndian(s.settings.startSalary)}` : corner.sub, 0, k * 0.52)
    } else {
      if (tile.kind === 'city') {
        const band = th * 0.25
        g.fillStyle = GROUP_COLORS[tile.group].hex
        g.fillRect(-tw / 2, -th / 2, tw, band)
        g.fillStyle = 'rgba(0,0,0,.12)'
        g.fillRect(-tw / 2, -th / 2 + band - k * 0.025, tw, k * 0.025)
      } else {
        const icon = icons.get((tile.kind === 'service' ? tile.icon : tile.kind) as IconKind)
        if (icon) g.drawImage(icon, -k * 0.22, -th * 0.36, k * 0.44, k * 0.44)
      }
      const name = tile.kind === 'chest' ? 'Community Chest' : tile.name
      const words = name.length > 9 && name.includes(' ') ? name.split(' ') : [name]
      const fs = k * (words.some((wd) => wd.length > 9) ? 0.16 : 0.19)
      g.fillStyle = INK
      g.font = `${fs}px "Yatra One", Georgia, serif`
      const baseY = tile.kind === 'city' ? -th * 0.06 : th * 0.06
      words.forEach((wd, j) => g.fillText(wd, 0, baseY + (j - (words.length - 1) / 2) * fs * 1.1, tw * 0.9))
      if (tile.kind === 'city' || tile.kind === 'service') {
        g.font = `700 ${k * 0.16}px Mukta, sans-serif`
        g.fillStyle = MUTED
        g.fillText(`₹${groupIndian(tile.price)}`, 0, th * 0.36)
      } else if (tile.kind === 'incomeTax' || tile.kind === 'wealthTax') {
        g.font = `600 ${k * 0.13}px Mukta, sans-serif`
        g.fillStyle = MUTED
        g.fillText(tile.kind === 'incomeTax' ? `Pay ₹${groupIndian(s.settings.incomeTax)}` : 'On buildings', 0, th * 0.36)
      }
    }
    g.restore()

    g.strokeStyle = 'rgba(42,28,18,.6)'
    g.lineWidth = k * 0.018
    g.strokeRect(x, y, w, h)

    const prop = s.properties[i]
    const owner = prop?.owner ? s.players.find((p) => p.id === prop.owner) : undefined
    if (owner) {
      g.strokeStyle = owner.color
      g.lineWidth = k * 0.08
      g.strokeRect(x + k * 0.06, y + k * 0.06, w - k * 0.12, h - k * 0.12)
    }
    if (prop?.mortgaged) {
      g.save()
      g.beginPath()
      g.rect(x, y, w, h)
      g.clip()
      g.strokeStyle = 'rgba(42,28,18,.22)'
      g.lineWidth = k * 0.03
      for (let d = -h; d < w; d += k * 0.14) {
        g.beginPath()
        g.moveTo(x + d, y + h)
        g.lineTo(x + d + h, y)
        g.stroke()
      }
      g.restore()
    }
  })

  // Outer gold rule
  g.strokeStyle = GOLD
  g.lineWidth = k * 0.05
  g.strokeRect(k * 0.03, k * 0.03, size - k * 0.06, size - k * 0.06)
  return cv
}

/** Procedural wood grain for the frame and table. */
export function woodTexture(base: string, dark: string, size = 1024): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const g = cv.getContext('2d')!
  g.fillStyle = base
  g.fillRect(0, 0, size, size)
  let seed = 3
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 140; i++) {
    const y = rand() * size
    g.strokeStyle = dark
    g.globalAlpha = 0.05 + rand() * 0.12
    g.lineWidth = 1 + rand() * 4
    g.beginPath()
    g.moveTo(0, y)
    for (let x = 0; x <= size; x += size / 16) g.lineTo(x, y + Math.sin(x / (60 + rand() * 80) + i) * (4 + rand() * 6))
    g.stroke()
  }
  g.globalAlpha = 1
  return cv
}
