/** Where each of the 40 tiles sits on the 11×11 grid (Start bottom-right, moving clockwise). */

export type Side = 'bottom' | 'left' | 'top' | 'right' | 'corner'

export interface TilePlacement {
  row: number // 1-based grid row
  col: number // 1-based grid column
  side: Side
}

export const CORNER = 1.55 // corner size in "tile widths"
const TOTAL = CORNER * 2 + 9

export function placement(i: number): TilePlacement {
  if (i === 0) return { row: 11, col: 11, side: 'corner' }
  if (i < 10) return { row: 11, col: 11 - i, side: 'bottom' }
  if (i === 10) return { row: 11, col: 1, side: 'corner' }
  if (i < 20) return { row: 11 - (i - 10), col: 1, side: 'left' }
  if (i === 20) return { row: 1, col: 1, side: 'corner' }
  if (i < 30) return { row: 1, col: 1 + (i - 20), side: 'top' }
  if (i === 30) return { row: 1, col: 11, side: 'corner' }
  return { row: 1 + (i - 30), col: 11, side: 'right' }
}

function span(n: number): [number, number] {
  if (n === 1) return [0, CORNER]
  if (n === 11) return [CORNER + 9, TOTAL]
  return [CORNER + (n - 2), CORNER + (n - 1)]
}

/** Tile centre as percentages of the board. */
export function tileCenter(i: number): { x: number; y: number } {
  const { row, col } = placement(i)
  const [x0, x1] = span(col)
  const [y0, y1] = span(row)
  return { x: (((x0 + x1) / 2) / TOTAL) * 100, y: (((y0 + y1) / 2) / TOTAL) * 100 }
}

export const GRID_TEMPLATE = `${CORNER}fr repeat(9, 1fr) ${CORNER}fr`
