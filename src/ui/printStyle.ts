/** Colours of the classic printed "Business" board, shared by the 2D and 3D boards. */
export const PRINT = {
  tile: '#fbf9f2',
  line: '#24180f',
  ink: '#1b1410',
  muted: '#4a3c30',
  red: '#d42a22',
  redDark: '#9c140f',
  blue: '#2148b8',
  blueDark: '#11286e',
  card: '#fdf3d4',
  gold: '#f4c21b',
}

/** The colours of the printed rainbow card tiles. */
export const RAINBOW = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#3949ab', '#8e24aa']

/** Mix a #rrggbb colour with white (amount = share of the colour). */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * amount + 255 * (1 - amount))
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}

export const CORNER_STYLE: Record<string, { bg: string; label: string; sub: string }> = {
  start: { bg: '#ffe7a3', label: 'START', sub: 'Collect salary' },
  jail: { bg: '#fde0da', label: 'JAIL', sub: 'Just visiting' },
  club: { bg: '#d9efcb', label: 'CLUB', sub: 'Pay everyone' },
  restHouse: { bg: '#d6ecf7', label: 'REST HOUSE', sub: 'Put your feet up' },
}
