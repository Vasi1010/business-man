/**
 * Lakhpati board data — every price, rent and amount lives here.
 * Edit this file to rebalance the game; the engine reads nothing else.
 */

export type CityGroup = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export interface CityTile {
  kind: 'city'
  name: string
  group: CityGroup
  price: number
  /** [site, 1 house, 2 houses, 3 houses, hotel] */
  rents: [number, number, number, number, number]
  houseCost: number
  mortgage: number
}

export interface ServiceTile {
  kind: 'service'
  name: string
  icon: 'train' | 'bus' | 'plane' | 'boat' | 'bulb' | 'tap'
  price: number
  rent: number
  pairRent: number
  /** Board index of the paired service. */
  pair: number
  mortgage: number
  /** Counts as a transport tile for Chance "advance to nearest". */
  transport: boolean
}

export type SimpleTileKind =
  | 'start'
  | 'chance'
  | 'chest'
  | 'incomeTax'
  | 'wealthTax'
  | 'jail'
  | 'club'
  | 'restHouse'

export interface SimpleTile {
  kind: SimpleTileKind
  name: string
}

export type Tile = CityTile | ServiceTile | SimpleTile
export type OwnableTile = CityTile | ServiceTile

const city = (
  name: string,
  group: CityGroup,
  price: number,
  rents: [number, number, number, number, number],
  houseCost: number,
  mortgage: number,
): CityTile => ({ kind: 'city', name, group, price, rents, houseCost, mortgage })

const service = (
  name: string,
  icon: ServiceTile['icon'],
  price: number,
  rent: number,
  pairRent: number,
  pair: number,
  mortgage: number,
  transport: boolean,
): ServiceTile => ({ kind: 'service', name, icon, price, rent, pairRent, pair, mortgage, transport })

const simple = (kind: SimpleTileKind, name: string): SimpleTile => ({ kind, name })

export const BOARD: readonly Tile[] = [
  /* 0 */ simple('start', 'Start'),
  /* 1 */ city('Chandigarh', 1, 2500, [200, 900, 1600, 2400, 3400], 3000, 1250),
  /* 2 */ simple('chest', 'Community Chest'),
  /* 3 */ city('Darjeeling', 1, 2600, [200, 900, 1600, 2400, 3400], 3000, 1300),
  /* 4 */ simple('incomeTax', 'Income Tax'),
  /* 5 */ service('Railways', 'train', 9500, 1100, 2200, 15, 4750, true),
  /* 6 */ city('Shimla', 2, 2800, [250, 1100, 2000, 3000, 4250], 3000, 1400),
  /* 7 */ simple('chance', 'Chance'),
  /* 8 */ city('Ooty', 2, 2800, [250, 1100, 2000, 3000, 4250], 3000, 1400),
  /* 9 */ city('Amritsar', 2, 3300, [300, 1350, 2400, 3600, 5100], 3000, 1650),
  /* 10 */ simple('jail', 'Jail'),
  /* 11 */ city('Agra', 3, 3500, [300, 1350, 2400, 3600, 5100], 4000, 1750),
  /* 12 */ service('Electric Company', 'bulb', 2500, 500, 1000, 28, 1250, false),
  /* 13 */ city('Jaipur', 3, 3500, [300, 1350, 2400, 3600, 5100], 4000, 1750),
  /* 14 */ city('Kanpur', 3, 4000, [400, 1800, 3200, 4800, 6800], 4000, 2000),
  /* 15 */ service('City Bus', 'bus', 3500, 600, 1100, 5, 1750, true),
  /* 16 */ city('Lucknow', 4, 4200, [400, 1800, 3200, 4800, 6800], 4000, 2100),
  /* 17 */ simple('chest', 'Community Chest'),
  /* 18 */ city('Indore', 4, 4200, [400, 1800, 3200, 4800, 6800], 4000, 2100),
  /* 19 */ city('Nagpur', 4, 4500, [450, 2000, 3600, 5400, 7650], 4000, 2250),
  /* 20 */ simple('club', 'Club'),
  /* 21 */ city('Srinagar', 5, 5000, [500, 2250, 4000, 6000, 8500], 6000, 2500),
  /* 22 */ simple('chance', 'Chance'),
  /* 23 */ city('Goa', 5, 5000, [500, 2250, 4000, 6000, 8500], 6000, 2500),
  /* 24 */ city('Kochi', 5, 5500, [600, 2700, 4800, 7200, 10200], 6000, 2750),
  /* 25 */ service('Airways', 'plane', 10500, 1200, 2400, 35, 5250, true),
  /* 26 */ city('Hyderabad', 6, 5800, [650, 2900, 5200, 7800, 11050], 6000, 2900),
  /* 27 */ city('Chennai', 6, 5800, [650, 2900, 5200, 7800, 11050], 6000, 2900),
  /* 28 */ service('Water Works', 'tap', 3200, 500, 1000, 12, 1600, false),
  /* 29 */ city('Kolkata', 6, 6200, [750, 3400, 6000, 9000, 12750], 6000, 3100),
  /* 30 */ simple('restHouse', 'Rest House'),
  /* 31 */ city('Pune', 7, 6500, [800, 3600, 6400, 9600, 13600], 7000, 3250),
  /* 32 */ city('Ahmedabad', 7, 6500, [800, 3600, 6400, 9600, 13600], 7000, 3250),
  /* 33 */ simple('chest', 'Community Chest'),
  /* 34 */ city('Bengaluru', 7, 7000, [900, 4050, 7200, 10800, 15300], 7000, 3500),
  /* 35 */ service('Motor Boat', 'boat', 5500, 500, 900, 25, 2750, true),
  /* 36 */ simple('chance', 'Chance'),
  /* 37 */ simple('wealthTax', 'Wealth Tax'),
  /* 38 */ city('Delhi', 8, 8000, [1100, 4950, 8800, 13200, 18700], 7000, 4000),
  /* 39 */ city('Mumbai', 8, 8500, [1200, 5400, 9600, 14400, 20400], 7000, 4250),
]

export const BOARD_SIZE = BOARD.length
export const START_TILE = 0
export const JAIL_TILE = 10
export const DELHI_TILE = 38

/** Group display colours (earthy palette). */
export const GROUP_COLORS: Record<CityGroup, { name: string; hex: string }> = {
  1: { name: 'Terracotta', hex: '#b9532f' },
  2: { name: 'Sky', hex: '#4f97cf' },
  3: { name: 'Rose', hex: '#cf5f86' },
  4: { name: 'Saffron', hex: '#ee8a1c' },
  5: { name: 'Vermilion', hex: '#d4302a' },
  6: { name: 'Turmeric', hex: '#d9ac10' },
  7: { name: 'Leaf green', hex: '#3f8a3a' },
  8: { name: 'Indigo', hex: '#3b4596' },
}

/** Default amounts for special tiles. All of these can be overridden in lobby settings. */
export const SPECIAL_DEFAULTS = {
  startingCash: 15000,
  startSalary: 1500,
  incomeTax: 1000,
  wealthTaxPerHouse: 500,
  wealthTaxPerHotel: 1000,
  wealthTaxPercent: 1,
  clubAmount: 100,
  restHouseAmount: 100,
  jailFine: 500,
}

/** Auction rules. */
export const AUCTION_STEP = 100
export const AUCTION_SECONDS = 10

/** Unmortgage costs the mortgage value plus this fraction. */
export const UNMORTGAGE_INTEREST = 0.1

/** Max buildings per city: 3 houses then a hotel (stored as level 4). */
export const HOTEL_LEVEL = 4

export type CardEffect =
  | { type: 'collect'; amount: number }
  | { type: 'pay'; amount: number }
  | { type: 'goToJail' }
  | { type: 'nearestTransport' }
  | { type: 'moveBack'; spaces: number }
  | { type: 'repairs'; perHouse: number; perHotel: number }
  | { type: 'moveTo'; tile: number }
  | { type: 'jailPass' }
  | { type: 'payEach'; amount: number }
  | { type: 'collectEach'; amount: number }

export interface Card {
  title: string
  text: string
  effect: CardEffect
}

/** Chance — chosen by the dice total (2–12) that landed you on the tile. */
export const CHANCE: Record<number, Card> = {
  2: { title: 'Lottery win!', text: 'Collect ₹2,500.', effect: { type: 'collect', amount: 2500 } },
  3: { title: 'Caught out', text: 'Go to Jail. Do not collect your Start salary.', effect: { type: 'goToJail' } },
  4: { title: 'Speeding fine', text: 'Pay ₹500.', effect: { type: 'pay', amount: 500 } },
  5: {
    title: 'On the move',
    text: 'Advance to the nearest Railways, City Bus, Airways or Motor Boat. Buy it if unowned, or pay the owner double rent.',
    effect: { type: 'nearestTransport' },
  },
  6: { title: 'Stock market dip', text: 'Pay ₹1,000.', effect: { type: 'pay', amount: 1000 } },
  7: { title: 'Wrong turn', text: 'Go back 3 spaces.', effect: { type: 'moveBack', spaces: 3 } },
  8: {
    title: 'Property repairs',
    text: 'Pay ₹250 per house and ₹750 per hotel you own.',
    effect: { type: 'repairs', perHouse: 250, perHotel: 750 },
  },
  9: {
    title: 'Trip to Delhi',
    text: 'Advance to Delhi. Collect your Start salary if you pass Start.',
    effect: { type: 'moveTo', tile: DELHI_TILE },
  },
  10: { title: 'Startup funded!', text: 'Your startup got funded. Collect ₹2,000.', effect: { type: 'collect', amount: 2000 } },
  11: {
    title: 'Get Out of Jail Free',
    text: 'Keep this pass until you use it or trade it.',
    effect: { type: 'jailPass' },
  },
  12: { title: 'You threw a party', text: 'Pay ₹500 to every player.', effect: { type: 'payEach', amount: 500 } },
}

/** Community Chest — chosen by the dice total (2–12) that landed you on the tile. */
export const CHEST: Record<number, Card> = {
  2: { title: 'Tax refund', text: 'Collect ₹1,500.', effect: { type: 'collect', amount: 1500 } },
  3: { title: 'Car service', text: 'Pay ₹700.', effect: { type: 'pay', amount: 700 } },
  4: { title: 'Diwali bonus', text: 'Collect ₹1,000.', effect: { type: 'collect', amount: 1000 } },
  5: { title: 'Caught out', text: 'Go to Jail. Do not collect your Start salary.', effect: { type: 'goToJail' } },
  6: { title: 'Wedding gifts', text: 'Collect ₹250 from every player.', effect: { type: 'collectEach', amount: 250 } },
  7: { title: 'School fees', text: 'Pay ₹1,000.', effect: { type: 'pay', amount: 1000 } },
  8: { title: 'Back to Start', text: 'Advance to Start and collect your salary.', effect: { type: 'moveTo', tile: START_TILE } },
  9: { title: 'Fixed deposit matured', text: 'Collect ₹2,000.', effect: { type: 'collect', amount: 2000 } },
  10: {
    title: 'Get Out of Jail Free',
    text: 'Keep this pass until you use it or trade it.',
    effect: { type: 'jailPass' },
  },
  11: { title: 'Charity drive', text: 'Pay ₹500.', effect: { type: 'pay', amount: 500 } },
  12: { title: 'Quiz show champion', text: 'You won a quiz show. Collect ₹3,000.', effect: { type: 'collect', amount: 3000 } },
}

export function isOwnable(tile: Tile): tile is OwnableTile {
  return tile.kind === 'city' || tile.kind === 'service'
}

export const OWNABLE_TILES: readonly number[] = BOARD.flatMap((t, i) => (isOwnable(t) ? [i] : []))

export function groupTiles(group: CityGroup): number[] {
  return BOARD.flatMap((t, i) => (t.kind === 'city' && t.group === group ? [i] : []))
}

export const TRANSPORT_TILES: readonly number[] = BOARD.flatMap((t, i) =>
  t.kind === 'service' && t.transport ? [i] : [],
)
