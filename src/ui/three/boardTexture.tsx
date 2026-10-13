import { renderToStaticMarkup } from 'react-dom/server'
import { BOARD, GROUP_COLORS, SIDE_TILES, groupIndian, type GameState, type ServiceTile, type SimpleTileKind } from '../../engine'
import { CORNER, placement, span } from '../boardLayout'
import { TileIcon } from '../components/Art'
import { CORNER_STYLE, PRINT, RAINBOW, tint } from '../printStyle'

export const TOTAL = CORNER * 2 + SIDE_TILES

type IconKind = ServiceTile['icon'] | SimpleTileKind
const ICONS: IconKind[] = ['train', 'bus', 'plane', 'boat', 'bulb', 'tap', 'chance', 'chest', 'incomeTax', 'wealthTax', 'club', 'restHouse', 'jail', 'start']

let iconCache: Promise<Map<IconKind, HTMLImageElement>> | null = null

/** Render the app's SVG tile icons to images once, for drawing onto the board. */
export function loadIcons(): Promise<Map<IconKind, HTMLImageElement>> {
  iconCache ??= Promise.all(
    ICONS.map(
      (kind) =>
        new Promise<[IconKind, HTMLImageElement]>((resolve) => {
          const svg = renderToStaticMarkup(<TileIcon kind={kind} />)
            .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"')
            .replaceAll('currentColor', kind === 'jail' || kind === 'start' ? PRINT.red : PRINT.redDark)
          const img = new Image()
          img.onload = () => resolve([kind, img])
          img.onerror = () => resolve([kind, img])
          img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        }),
    ),
  ).then((entries) => new Map(entries))
  return iconCache
}

/** How much taller the far row's labels are drawn, to offset the camera's foreshortening. */
const TOP_ROW_STRETCH = 1.25

/** Where to break long one-word names on narrow squares. */
const WORD_BREAKS: Record<string, string[]> = {
  CHANDIGARH: ['CHANDI-', 'GARH'],
  BANGALORE: ['BANGA-', 'LORE'],
  DARJEELING: ['DARJEE-', 'LING'],
  HYDERABAD: ['HYDERA-', 'BAD'],
  AMRITSAR: ['AMRIT-', 'SAR'],
  SRINAGAR: ['SRINA-', 'GAR'],
  CALCUTTA: ['CAL-', 'CUTTA'],
}

/** Draw text at the largest size up to maxSize that fits maxWidth. */
function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, maxSize: number, weight = 800) {
  g.font = `${weight} ${maxSize}px Mukta, "Arial Black", sans-serif`
  const width = g.measureText(text).width
  const size = width > maxWidth ? (maxSize * maxWidth) / width : maxSize
  g.font = `${weight} ${size}px Mukta, "Arial Black", sans-serif`
  g.fillText(text, x, y)
}

function pinwheel(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, turn = 0) {
  const n = RAINBOW.length * 2
  for (let i = 0; i < n; i++) {
    g.fillStyle = RAINBOW[i % RAINBOW.length]
    g.beginPath()
    g.moveTo(cx, cy)
    g.arc(cx, cy, r, turn + (i / n) * Math.PI * 2, turn + ((i + 1) / n) * Math.PI * 2 + 0.01)
    g.closePath()
    g.fill()
  }
}

/** Red ribbon with white lettering, as on the printed corners. */
function banner(g: CanvasRenderingContext2D, text: string, y: number, w: number, fs: number) {
  const h = fs * 1.35
  const drop = fs * 0.14
  g.fillStyle = PRINT.redDark
  for (const dir of [-1, 1]) {
    const edge = (dir * w) / 2
    g.beginPath()
    g.moveTo(edge, y - h / 2 + drop)
    g.lineTo(edge + dir * fs * 0.45, y - h / 2 + drop)
    g.lineTo(edge + dir * fs * 0.22, y + drop)
    g.lineTo(edge + dir * fs * 0.45, y + h / 2 + drop)
    g.lineTo(edge, y + h / 2 + drop)
    g.closePath()
    g.fill()
  }
  g.fillStyle = PRINT.red
  g.fillRect(-w / 2, y - h / 2, w, h)
  g.fillStyle = '#fff'
  g.font = `800 ${fs}px Mukta, "Arial Black", sans-serif`
  g.fillText(text, 0, y + fs * 0.06, w * 0.94)
}

/** A cream instruction card printed in the centre, rotated to face its corner. */
function printedCard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, angle: number, title: string) {
  g.save()
  g.translate(x, y)
  g.rotate(angle)
  g.shadowColor = 'rgba(0,0,0,.35)'
  g.shadowBlur = w * 0.04
  g.shadowOffsetY = w * 0.015
  g.fillStyle = PRINT.card
  g.beginPath()
  g.roundRect(-w / 2, -h / 2, w, h, w * 0.06)
  g.fill()
  g.shadowColor = 'transparent'
  g.strokeStyle = PRINT.red
  g.lineWidth = w * 0.012
  g.setLineDash([w * 0.025, w * 0.015])
  g.beginPath()
  g.roundRect(-w / 2 + w * 0.04, -h / 2 + w * 0.04, w * 0.92, h - w * 0.08, w * 0.04)
  g.stroke()
  g.setLineDash([])
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = PRINT.redDark
  g.font = `800 ${w * 0.1}px Mukta, "Arial Black", sans-serif`
  g.fillText(title, 0, -h * 0.3, w * 0.84)
  g.fillStyle = PRINT.red
  g.fillRect(-w * 0.3, -h * 0.3 + w * 0.07, w * 0.6, w * 0.008)
  // Faux printed rules
  g.fillStyle = 'rgba(40,28,18,.38)'
  ;[0.78, 0.7, 0.82, 0.6, 0.74, 0.5].forEach((len, i) => {
    g.fillRect(-w * 0.4, -h * 0.1 + i * h * 0.09, w * 0.8 * len, w * 0.016)
  })
  g.restore()
}

function centre(g: CanvasRenderingContext2D, size: number, k: number) {
  const c0 = CORNER * k
  const c1 = (CORNER + SIDE_TILES) * k
  const w = c1 - c0
  const grad = g.createRadialGradient(size / 2, size / 2, w * 0.05, size / 2, size / 2, w * 0.72)
  grad.addColorStop(0, '#3463dc')
  grad.addColorStop(0.6, PRINT.blue)
  grad.addColorStop(1, PRINT.blueDark)
  g.fillStyle = grad
  g.fillRect(c0, c0, w, w)
  // Printed sheen stripes
  g.save()
  g.beginPath()
  g.rect(c0, c0, w, w)
  g.clip()
  g.strokeStyle = 'rgba(255,255,255,.05)'
  g.lineWidth = k * 0.35
  for (let d = 0; d < w * 2; d += k * 0.9) {
    g.beginPath()
    g.moveTo(c0 + d, c0)
    g.lineTo(c0 + d - w, c1)
    g.stroke()
  }
  g.restore()
  g.strokeStyle = PRINT.gold
  g.lineWidth = k * 0.05
  g.strokeRect(c0 + k * 0.16, c0 + k * 0.16, w - k * 0.32, w - k * 0.32)

  const off = k * 2.35
  const cards: [number, number, string][] = [
    [-1, -1, 'COMMUNITY CHEST'],
    [1, -1, 'CHANCE'],
    [-1, 1, 'CHANCE'],
    [1, 1, 'COMMUNITY CHEST'],
  ]
  // Each card's foot points at its corner of the board, so it reads from there.
  for (const [dx, dy, title] of cards) printedCard(g, size / 2 + dx * off, size / 2 + dy * off, k * 2.7, k * 1.9, Math.atan2(-dx, dy), title)

  g.save()
  g.translate(size / 2, size / 2)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const fs = k * 1.0
  const maxW = w * 0.84
  g.font = `800 ${fs}px Mukta, "Arial Black", Impact, sans-serif`
  g.lineJoin = 'round'
  g.strokeStyle = '#0b0b14'
  g.lineWidth = fs * 0.3
  g.strokeText('BUSINESSMAN', fs * 0.05, fs * 0.08, maxW)
  g.strokeStyle = '#fff'
  g.lineWidth = fs * 0.16
  g.strokeText('BUSINESSMAN', 0, 0, maxW)
  const tg = g.createLinearGradient(0, -fs / 2, 0, fs / 2)
  tg.addColorStop(0, '#ff5a3c')
  tg.addColorStop(0.55, PRINT.red)
  tg.addColorStop(1, PRINT.redDark)
  g.fillStyle = tg
  g.fillText('BUSINESSMAN', 0, 0, maxW)
  g.font = `700 ${k * 0.24}px Mukta, sans-serif`
  g.fillStyle = PRINT.gold
  g.fillText('BUY  ·  BUILD  ·  PROSPER', 0, fs * 0.8)
  g.restore()
}

/** Paint the full board face (tiles, bands, icons, owners, centre art). */
export function drawBoard(s: GameState, icons: Map<IconKind, HTMLImageElement>, size: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const g = cv.getContext('2d')!
  const k = size / TOTAL

  g.fillStyle = PRINT.tile
  g.fillRect(0, 0, size, size)
  centre(g, size, k)

  BOARD.forEach((tile, i) => {
    const { row, col, side } = placement(i)
    const [x0, x1] = span(col)
    const [y0, y1] = span(row)
    const [x, y, w, h] = [x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k]
    const corner = side === 'corner' ? CORNER_STYLE[tile.kind] : undefined
    const card = tile.kind === 'chance' || tile.kind === 'chest'

    g.fillStyle = corner ? corner.bg : tile.kind === 'city' ? tint(GROUP_COLORS[tile.group].hex, 0.42) : PRINT.tile
    g.fillRect(x, y, w, h)
    if (card) {
      g.save()
      g.beginPath()
      g.rect(x, y, w, h)
      g.clip()
      pinwheel(g, x + w / 2, y + h / 2, Math.hypot(w, h), i * 0.3)
      g.restore()
    }

    // All text stands upright, facing the near (bottom) edge where the camera sits.
    g.textAlign = 'center'
    g.textBaseline = 'middle'

    if (corner) {
      const cx = x + w / 2
      const cy = y + h / 2
      const icon = icons.get(tile.kind as IconKind)
      if (icon) g.drawImage(icon, cx - k * 0.33, cy - k * 0.62, k * 0.66, k * 0.66)
      g.save()
      g.translate(cx, cy)
      banner(g, corner.label, k * 0.22, k * 1.15, k * 0.28)
      g.fillStyle = PRINT.ink
      fitText(g, tile.kind === 'start' ? `COLLECT ₹${groupIndian(s.settings.startSalary)}` : corner.sub.toUpperCase(), 0, k * 0.5, w * 0.78, k * 0.15, 700)
      g.restore()
    } else {
      // Inner edge carries the colour band; the rest holds the label.
      const bandSize = (side === 'left' || side === 'right' ? w : h) * 0.24
      let [cx0, cy0, cw, ch] = [x, y, w, h]
      if (tile.kind === 'city') {
        g.fillStyle = GROUP_COLORS[tile.group].hex
        const band: [number, number, number, number] =
          side === 'bottom' ? [x, y, w, bandSize] : side === 'top' ? [x, y + h - bandSize, w, bandSize] : side === 'left' ? [x + w - bandSize, y, bandSize, h] : [x, y, bandSize, h]
        g.fillRect(...band)
        if (side === 'bottom') [cy0, ch] = [y + bandSize, h - bandSize]
        else if (side === 'top') ch = h - bandSize
        else if (side === 'left') cw = w - bandSize
        else [cx0, cw] = [x + bandSize, w - bandSize]
      }
      // Keep clear of the printed border on the outer edge.
      const edge = k * 0.11
      if (side === 'bottom') ch -= edge
      else if (side === 'top') [cy0, ch] = [cy0 + edge, ch - edge]
      else if (side === 'left') [cx0, cw] = [cx0 + edge, cw - edge]
      else cw -= edge
      const cx = cx0 + cw / 2
      const cy = cy0 + ch / 2
      // The far (top) row is foreshortened by the camera's tilt, so draw its labels taller to compensate.
      const stretch = side === 'top' ? TOP_ROW_STRETCH : 1
      const chFit = ch / stretch
      g.save()
      g.translate(cx, cy)
      g.scale(1, stretch)
      g.translate(-cx, -cy)

      if (card) {
        const lines = tile.kind === 'chance' ? ['CHANCE'] : ['COMMUNITY', 'CHEST']
        lines.forEach((text, j) => {
          const ly = cy + (j - (lines.length - 1) / 2) * k * 0.32
          g.fillStyle = 'rgba(255,255,255,.95)'
          g.beginPath()
          g.roundRect(cx - cw * 0.45, ly - k * 0.14, cw * 0.9, k * 0.28, k * 0.05)
          g.fill()
          g.fillStyle = PRINT.redDark
          fitText(g, text, cx, ly + k * 0.01, cw * 0.84, k * 0.2)
        })
      } else {
        const price =
          tile.kind === 'city' || tile.kind === 'service'
            ? `₹${groupIndian(tile.price)}`
            : tile.kind === 'incomeTax'
              ? `PAY ₹${groupIndian(s.settings.incomeTax)}`
              : tile.kind === 'wealthTax'
                ? 'ON BUILDINGS'
                : ''
        const icon = tile.kind === 'city' ? undefined : icons.get((tile.kind === 'service' ? tile.icon : tile.kind) as IconKind)
        const wide = cw > ch
        const name = tile.name.toUpperCase()
        const words = name.split(' ')
        // Wide side squares fit names on one line; narrow ones split long names in two.
        const lines = wide
          ? [name]
          : words.length > 1 && name.length > 9
            ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
            : side === 'top' && WORD_BREAKS[name]
              ? WORD_BREAKS[name]
              : [name]
        // Stack: [icon] name, price, centred in the label area and shrunk to fit its height.
        // The price keeps its size; the icon and name shrink to fit what's left.
        const priceH = price ? k * 0.32 : 0
        const priceBlock = price ? priceH + k * 0.06 : 0
        let iconSize = k * 0.4
        let nameSize = k * (side === 'top' ? 0.3 : 0.24)
        const restH = () => (icon ? iconSize + k * 0.04 : 0) + lines.length * nameSize * 1.02
        const fit = Math.min(1, (chFit * 0.92 - priceBlock) / restH())
        iconSize *= fit
        nameSize *= fit
        const blockH = restH() + priceBlock
        let top = cy - blockH / 2
        if (icon) {
          g.drawImage(icon, cx - iconSize / 2, top, iconSize, iconSize)
          top += iconSize + k * 0.04
        }
        g.fillStyle = PRINT.ink
        for (const line of lines) {
          fitText(g, line, cx, top + nameSize / 2, cw * 0.92, nameSize)
          top += nameSize * 1.02
        }
        if (price) {
          top += k * 0.06
          g.fillStyle = '#fff'
          g.strokeStyle = 'rgba(36,24,15,.55)'
          g.lineWidth = k * 0.012
          g.beginPath()
          g.roundRect(cx - cw * 0.46, top, cw * 0.92, priceH, k * 0.05)
          g.fill()
          g.stroke()
          g.fillStyle = PRINT.redDark
          fitText(g, price, cx, top + priceH / 2 + k * 0.01, cw * 0.86, priceH * 0.78, 800)
        }
      }
      g.restore()
    }

    g.strokeStyle = PRINT.line
    g.lineWidth = k * 0.022
    g.strokeRect(x, y, w, h)

    const prop = s.properties[i]
    const owner = prop?.owner ? s.players.find((p) => p.id === prop.owner) : undefined
    if (owner) {
      g.strokeStyle = owner.color
      g.lineWidth = k * 0.09
      g.strokeRect(x + k * 0.065, y + k * 0.065, w - k * 0.13, h - k * 0.13)
    }
    if (prop?.mortgaged) {
      g.save()
      g.beginPath()
      g.rect(x, y, w, h)
      g.clip()
      g.fillStyle = 'rgba(255,255,255,.35)'
      g.fillRect(x, y, w, h)
      g.strokeStyle = 'rgba(42,28,18,.28)'
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

  // Printed red border
  g.strokeStyle = PRINT.red
  g.lineWidth = k * 0.1
  g.strokeRect(k * 0.05, k * 0.05, size - k * 0.1, size - k * 0.1)
  g.strokeStyle = PRINT.line
  g.lineWidth = k * 0.02
  g.strokeRect(k * 0.1, k * 0.1, size - k * 0.2, size - k * 0.2)
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
