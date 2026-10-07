import type { TokenId } from '../engine'

export const TOKENS: { id: TokenId; label: string }[] = [
  { id: 'auto', label: 'Auto-rickshaw' },
  { id: 'elephant', label: 'Elephant' },
  { id: 'peacock', label: 'Peacock' },
  { id: 'tiger', label: 'Tiger' },
  { id: 'diya', label: 'Diya' },
  { id: 'houseboat', label: 'Houseboat' },
]

export const PLAYER_COLORS = [
  { hex: '#d9480f', label: 'Marigold' },
  { hex: '#0b7a75', label: 'Peacock teal' },
  { hex: '#a61e4d', label: 'Kumkum' },
  { hex: '#3b3fa0', label: 'Indigo' },
  { hex: '#5c7f12', label: 'Mehendi' },
  { hex: '#7a4a1e', label: 'Sandalwood' },
]
