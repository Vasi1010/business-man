import { SIDE_TILES } from '../engine'

/** Where each tile sits on the square grid (Start bottom-right, moving clockwise). */

export type Side = 'bottom' | 'left' | 'top' | 'right' | 'corner'

export interface TilePlacement {
  row: number // 1-based grid row
  col: number // 1-based grid column
  side: Side
}

/** Grid lines per side: two corners plus the tiles between them. */
export const GRID = SIDE_TILES + 2
export const CORNER = 1.55 // corner size in "tile widths"
const TOTAL = CORNER * 2 + SIDE_TILES
const S = SIDE_TILES + 1 // tiles from one corner to the next

export function placement(i: number): TilePlacement {
  if (i === 0) return { row: GRID, col: GRID, side: 'corner' }
  if (i < S) return { row: GRID, col: GRID - i, side: 'bottom' }
  if (i === S) return { row: GRID, col: 1, side: 'corner' }
  if (i < 2 * S) return { row: GRID - (i - S), col: 1, side: 'left' }
  if (i === 2 * S) return { row: 1, col: 1, side: 'corner' }
  if (i < 3 * S) return { row: 1, col: 1 + (i - 2 * S), side: 'top' }
  if (i === 3 * S) return { row: 1, col: GRID, side: 'corner' }
  return { row: 1 + (i - 3 * S), col: GRID, side: 'right' }
}

/** Start and end of a grid row/column, in tile widths. */
export function span(n: number): [number, number] {
  if (n === 1) return [0, CORNER]
  if (n === GRID) return [CORNER + SIDE_TILES, TOTAL]
  return [CORNER + (n - 2), CORNER + (n - 1)]
}

/** Tile centre as percentages of the board. */
export function tileCenter(i: number): { x: number; y: number } {
  const { row, col } = placement(i)
  const [x0, x1] = span(col)
  const [y0, y1] = span(row)
  return { x: (((x0 + x1) / 2) / TOTAL) * 100, y: (((y0 + y1) / 2) / TOTAL) * 100 }
}

export const GRID_TEMPLATE = `${CORNER}fr repeat(${SIDE_TILES}, 1fr) ${CORNER}fr`
