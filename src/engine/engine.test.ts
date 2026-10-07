import { describe, expect, it } from 'vitest'
import { applyAction, initialState } from './engine'
import { formatMoney } from './format'
import { netWorth, rentFor, waitingOn } from './rules'
import type { Action } from './types'
import { NOW, act, actError, arrange, cash, game, own, place, player, players, roll } from './testUtils'

const START_CASH = 15000

describe('setup', () => {
  it('creates players with starting cash on Start', () => {
    const s = initialState(players(4))
    expect(s.players).toHaveLength(4)
    expect(s.players.every((p) => p.cash === START_CASH && p.position === 0)).toBe(true)
    expect(s.turn.playerId).toBe('a')
    expect(s.turn.phase).toBe('roll')
  })

  it('rejects too few or too many players', () => {
    expect(() => initialState(players(1))).toThrow()
    expect(() => initialState([...players(6), { ...players(1)[0], id: 'z' }])).toThrow()
  })

  it('honours starting cash setting and time limit', () => {
    const s = initialState(players(2), { startingCash: 20000, timeLimitMinutes: 30 }, { now: 1000 })
    expect(s.players[0].cash).toBe(20000)
    expect(s.endsAt).toBe(1000 + 30 * 60_000)
  })

  it('never mutates the input state', () => {
    const s = game()
    const before = JSON.stringify(s)
    roll(s, 'a', 5)
    expect(JSON.stringify(s)).toBe(before)
  })
})

describe('money formatting', () => {
  it('uses Indian digit grouping', () => {
    expect(formatMoney(500)).toBe('₹500')
    expect(formatMoney(1500)).toBe('₹1,500')
    expect(formatMoney(150000)).toBe('₹1,50,000')
    expect(formatMoney(12345678)).toBe('₹1,23,45,678')
    expect(formatMoney(-2500)).toBe('-₹2,500')
  })
})

describe('movement and Start', () => {
  it('moves by the dice total', () => {
    const s = roll(game(), 'a', 8)
    expect(player(s, 'a').position).toBe(8)
  })

  it('pays salary when passing Start', () => {
    let s = arrange(game(), (d) => place(d, 'a', 36))
    s = roll(s, 'a', 6) // 36 -> 2 (Community Chest 6: collect ₹250 from each player)
    expect(player(s, 'a').position).toBe(2)
    expect(cash(s, 'a')).toBe(START_CASH + 1500 + 250 * 2)
  })

  it('pays salary when landing exactly on Start', () => {
    let s = arrange(game(), (d) => place(d, 'a', 32))
    s = roll(s, 'a', 8)
    expect(player(s, 'a').position).toBe(0)
    expect(cash(s, 'a')).toBe(START_CASH + 1500)
    expect(player(s, 'a').lapped).toBe(true)
  })

  it('uses the Start salary setting', () => {
    let s = arrange(game(3, { startSalary: 2000 }), (d) => place(d, 'a', 35))
    s = roll(s, 'a', 6) // 35 -> 1 Chandigarh
    expect(cash(s, 'a')).toBe(START_CASH + 2000)
  })

  it('rejects rolls from the wrong player and invalid dice', () => {
    const s = game()
    expect(actError(s, { type: 'roll', dice: [2, 3] }, 'b')).toMatch(/not your turn/)
    expect(actError(s, { type: 'roll', dice: [0, 7] }, 'a')).toMatch(/Invalid dice/)
    expect(actError(s, { type: 'roll', dice: [2, 3] }, 'zz')).toMatch(/not in this game/)
  })

  it('cannot roll twice without doubles, and ends the turn', () => {
    let s = roll(game(3, { auctions: true }), 'a', 5)
    expect(s.turn.phase).toBe('buy') // Railways
    s = act(s, { type: 'decline', now: NOW }, 'a')
    s = act(s, { type: 'passAuction' }, 'a')
    s = act(s, { type: 'passAuction' }, 'b')
    s = act(s, { type: 'passAuction' }, 'c')
    expect(s.auction).toBeNull()
    expect(actError(s, { type: 'roll', dice: [1, 2] }, 'a')).toMatch(/can't roll/)
    s = act(s, { type: 'endTurn' }, 'a')
    expect(s.turn.playerId).toBe('b')
  })
})

describe('first-lap rule', () => {
  it('is off by default', () => {
    let s = game(3, {}, { lapped: false })
    expect(s.settings.firstLapRule).toBe(false)
    s = roll(s, 'a', 9)
    expect(s.turn.phase).toBe('buy')
  })

  it('blocks buying before passing Start', () => {
    let s = game(3, { firstLapRule: true }, { lapped: false })
    s = roll(s, 'a', 9) // Amritsar
    expect(s.turn.phase).toBe('end')
    expect(s.turn.pendingTile).toBeNull()
    expect(s.properties[9].owner).toBeNull()
  })

  it('allows buying after passing Start', () => {
    let s = arrange(game(3, { firstLapRule: true }, { lapped: false }), (d) => place(d, 'a', 35))
    s = roll(s, 'a', 6) // passes Start, lands on Chandigarh
    expect(s.turn.phase).toBe('buy')
    s = act(s, { type: 'buy' }, 'a')
    expect(s.properties[1].owner).toBe('a')
  })

  it('can be switched off', () => {
    let s = game(3, { firstLapRule: false }, { lapped: false })
    s = roll(s, 'a', 9)
    expect(s.turn.phase).toBe('buy')
  })

  it('still charges rent before the first lap', () => {
    let s = arrange(game(3, { firstLapRule: true }, { lapped: false }), (d) => own(d, 'b', 9))
    s = roll(s, 'a', 9)
    expect(cash(s, 'a')).toBe(START_CASH - 300)
    expect(cash(s, 'b')).toBe(START_CASH + 300)
  })
})

describe('buying', () => {
  it('buys at list price', () => {
    let s = roll(game(), 'a', 9)
    s = act(s, { type: 'buy' }, 'a')
    expect(s.properties[9].owner).toBe('a')
    expect(cash(s, 'a')).toBe(START_CASH - 3300)
    expect(s.turn.phase).toBe('end')
  })

  it('cannot buy without enough cash', () => {
    let s = arrange(game(), (d) => (d.players[0].cash = 100))
    s = roll(s, 'a', 9)
    expect(actError(s, { type: 'buy' }, 'a')).toMatch(/need/)
  })

  it('auctions are off by default: declining leaves it with the bank', () => {
    expect(game(3).settings.auctions).toBe(false)
    let s = roll(game(3), 'a', 9)
    s = act(s, { type: 'decline', now: NOW }, 'a')
    expect(s.auction).toBeNull()
    expect(s.properties[9].owner).toBeNull()
    expect(s.turn.phase).toBe('end')
  })
})

describe('rent', () => {
  it('charges site rent', () => {
    let s = arrange(game(), (d) => own(d, 'b', 39))
    s = arrange(s, (d) => place(d, 'a', 32))
    s = roll(s, 'a', 7)
    expect(cash(s, 'a')).toBe(START_CASH - 1200)
    expect(cash(s, 'b')).toBe(START_CASH + 1200)
    expect(s.log.at(-1)?.text).toBe('Ayaan paid ₹1,200 rent to Sara for Mumbai.')
  })

  it('doubles site rent for a full colour group', () => {
    let s = arrange(game(), (d) => {
      own(d, 'b', 38, 39)
      place(d, 'a', 32)
    })
    s = roll(s, 'a', 7)
    expect(cash(s, 'a')).toBe(START_CASH - 2400)
  })

  it('charges house and hotel rent', () => {
    const base = arrange(game(), (d) => {
      own(d, 'b', 38, 39)
      place(d, 'a', 32)
      d.players[0].cash = 50_000
    })
    const expected = [5400, 9600, 14400, 20400]
    for (let level = 1; level <= 4; level++) {
      const s = roll(
        arrange(base, (d) => {
          d.properties[38].level = level
          d.properties[39].level = level
        }),
        'a',
        7,
      )
      expect(cash(s, 'a')).toBe(50_000 - expected[level - 1])
    }
  })

  it('charges no rent on mortgaged tiles', () => {
    let s = arrange(game(), (d) => {
      own(d, 'b', 39)
      d.properties[39].mortgaged = true
      place(d, 'a', 32)
    })
    s = roll(s, 'a', 7)
    expect(cash(s, 'a')).toBe(START_CASH)
  })

  it('charges paired service rent', () => {
    // Railways alone
    let s = arrange(game(), (d) => own(d, 'b', 5))
    s = roll(s, 'a', 5)
    expect(cash(s, 'a')).toBe(START_CASH - 1100)
    // Railways with City Bus
    s = arrange(game(), (d) => own(d, 'b', 5, 15))
    s = roll(s, 'a', 5)
    expect(cash(s, 'a')).toBe(START_CASH - 2200)
    // City Bus with Railways
    s = arrange(game(), (d) => {
      own(d, 'b', 5, 15)
      place(d, 'a', 10)
    })
    s = roll(s, 'a', 5)
    expect(cash(s, 'a')).toBe(START_CASH - 1100)
  })

  it('computes every service rent from the table', () => {
    const s = arrange(game(), (d) => own(d, 'b', 5, 15, 25, 35, 12, 28))
    expect([5, 15, 25, 35, 12, 28].map((i) => rentFor(s, i))).toEqual([2200, 1100, 2400, 900, 1000, 1000])
    const single = arrange(game(), (d) => own(d, 'b', 25, 12))
    expect(rentFor(single, 25)).toBe(1200)
    expect(rentFor(single, 12)).toBe(500)
  })

  it('pays no rent on your own tile', () => {
    let s = arrange(game(), (d) => own(d, 'a', 9))
    s = roll(s, 'a', 9)
    expect(cash(s, 'a')).toBe(START_CASH)
    expect(s.turn.phase).toBe('end')
  })

  it('halves rent while the owner is in jail when the house rule is on', () => {
    const arrangeJail = (on: boolean) =>
      arrange(game(3, { jailHalfRent: on }), (d) => {
        own(d, 'b', 39)
        d.players[1].inJail = true
        d.players[1].position = 10
        place(d, 'a', 32)
      })
    expect(cash(roll(arrangeJail(false), 'a', 7), 'b')).toBe(START_CASH + 1200)
    expect(cash(roll(arrangeJail(true), 'a', 7), 'b')).toBe(START_CASH + 600)
  })
})

describe('doubles and jail', () => {
  it('gives another roll on doubles', () => {
    let s = act(game(), { type: 'roll', dice: [2, 2] }, 'a') // Income Tax
    expect(s.turn.phase).toBe('roll')
    expect(actError(s, { type: 'endTurn' }, 'a')).toMatch(/Roll first/)
    s = act(s, { type: 'roll', dice: [1, 3] }, 'a')
    expect(player(s, 'a').position).toBe(8)
  })

  it('can switch off the extra roll (and the three-doubles Jail rule)', () => {
    let s = game(3, { doublesRollAgain: false })
    s = act(s, { type: 'roll', dice: [2, 2] }, 'a')
    expect(s.turn.phase).toBe('end')
    s = act(s, { type: 'endTurn' }, 'a')
    expect(s.turn.playerId).toBe('b')
    // Doubles still get you out of Jail.
    s = arrange(s, (d) => {
      d.players[1].inJail = true
      place(d, 'b', 10)
    })
    s = act(s, { type: 'roll', dice: [3, 3] }, 'b')
    expect(player(s, 'b').inJail).toBe(false)
  })

  it('sends you to jail on three doubles without passing Start', () => {
    let s = arrange(game(), (d) => place(d, 'a', 30))
    s = act(s, { type: 'roll', dice: [1, 1] }, 'a') // 32
    s = act(s, { type: 'buy' }, 'a')
    s = act(s, { type: 'roll', dice: [2, 2] }, 'a') // 36 chance(4) pay 500
    const before = cash(s, 'a')
    s = act(s, { type: 'roll', dice: [3, 3] }, 'a')
    expect(player(s, 'a').inJail).toBe(true)
    expect(player(s, 'a').position).toBe(10)
    expect(cash(s, 'a')).toBe(before)
    expect(s.turn.phase).toBe('end')
  })

  it('lets a jailed player pay the fine', () => {
    let s = arrange(game(), (d) => {
      d.players[0].inJail = true
      place(d, 'a', 10)
    })
    s = act(s, { type: 'payJailFine' }, 'a')
    expect(player(s, 'a').inJail).toBe(false)
    expect(cash(s, 'a')).toBe(START_CASH - 500)
    s = roll(s, 'a', 4)
    expect(player(s, 'a').position).toBe(14)
  })

  it('lets a jailed player use a pass', () => {
    let s = arrange(game(), (d) => {
      d.players[0].inJail = true
      d.players[0].jailPasses = 1
      place(d, 'a', 10)
    })
    s = act(s, { type: 'useJailPass' }, 'a')
    expect(player(s, 'a').inJail).toBe(false)
    expect(player(s, 'a').jailPasses).toBe(0)
    expect(cash(s, 'a')).toBe(START_CASH)
    expect(actError(s, { type: 'useJailPass' }, 'a')).toMatch(/not in Jail/)
  })

  it('releases on doubles with no extra roll', () => {
    let s = arrange(game(), (d) => {
      d.players[0].inJail = true
      place(d, 'a', 10)
    })
    s = act(s, { type: 'roll', dice: [3, 3] }, 'a')
    expect(player(s, 'a').inJail).toBe(false)
    expect(player(s, 'a').position).toBe(16)
    expect(s.turn.phase).toBe('buy')
    s = act(s, { type: 'buy' }, 'a')
    expect(s.turn.phase).toBe('end')
  })

  it('forces the fine and moves after three failed attempts', () => {
    let s = arrange(game(2), (d) => {
      d.players[0].inJail = true
      place(d, 'a', 10)
    })
    for (let attempt = 1; attempt <= 2; attempt++) {
      s = roll(s, 'a', 5)
      expect(player(s, 'a').inJail).toBe(true)
      expect(player(s, 'a').jailAttempts).toBe(attempt)
      s = act(s, { type: 'endTurn' }, 'a')
      s = roll(s, 'b', attempt === 1 ? 4 : 6) // Income Tax, then Just Visiting
      s = act(s, { type: 'endTurn' }, 'b')
    }
    s = roll(s, 'a', 5) // third failure
    expect(player(s, 'a').inJail).toBe(false)
    expect(player(s, 'a').position).toBe(15)
    expect(cash(s, 'a')).toBe(START_CASH - 500)
  })

  it('still collects rent while in jail', () => {
    let s = arrange(game(), (d) => {
      own(d, 'a', 9)
      d.players[0].inJail = true
      place(d, 'a', 10)
      d.turn.playerId = 'b'
    })
    s = roll(s, 'b', 9)
    expect(cash(s, 'a')).toBe(START_CASH + 300)
  })

  it('lets a jailed player build and mortgage', () => {
    let s = arrange(game(), (d) => {
      own(d, 'a', 1, 3, 9)
      d.players[0].inJail = true
      place(d, 'a', 10)
    })
    s = act(s, { type: 'build', tile: 1 }, 'a')
    s = act(s, { type: 'mortgage', tile: 9 }, 'a')
    expect(s.properties[1].level).toBe(1)
    expect(s.properties[9].mortgaged).toBe(true)
  })
})

describe('roll a 12 to start', () => {
  it('keeps you on Start until you roll 12', () => {
    let s = game(2, { rollTwelveToStart: true })
    s = roll(s, 'a', 8)
    expect(player(s, 'a').position).toBe(0)
    expect(s.turn.phase).toBe('end')
    s = act(s, { type: 'endTurn' }, 'a')
    s = act(s, { type: 'roll', dice: [6, 6] }, 'b')
    expect(player(s, 'b').position).toBe(12)
    expect(player(s, 'b').started).toBe(true)
  })
})

describe('building', () => {
  const withGroup = () =>
    arrange(game(), (d) => {
      own(d, 'a', 1, 3)
      d.players[0].cash = 30_000
    })

  it('requires the whole colour group', () => {
    const s = arrange(game(), (d) => own(d, 'a', 1))
    expect(actError(s, { type: 'build', tile: 1 }, 'a')).toMatch(/whole colour group/)
  })

  it('builds evenly, up to a hotel', () => {
    let s = withGroup()
    s = act(s, { type: 'build', tile: 1 }, 'a')
    expect(actError(s, { type: 'build', tile: 1 }, 'a')).toMatch(/evenly/)
    s = act(s, { type: 'build', tile: 3 }, 'a')
    for (let i = 0; i < 3; i++) {
      s = act(s, { type: 'build', tile: 1 }, 'a')
      s = act(s, { type: 'build', tile: 3 }, 'a')
    }
    expect(s.properties[1].level).toBe(4)
    expect(s.properties[3].level).toBe(4)
    expect(cash(s, 'a')).toBe(30_000 - 8 * 3000)
    expect(actError(s, { type: 'build', tile: 1 }, 'a')).toMatch(/already has a hotel/)
  })

  it('blocks building when the group has a mortgage', () => {
    const s = arrange(withGroup(), (d) => (d.properties[3].mortgaged = true))
    expect(actError(s, { type: 'build', tile: 1 }, 'a')).toMatch(/Unmortgage/)
  })

  it('only allows building on your turn', () => {
    const s = arrange(withGroup(), (d) => (d.turn.playerId = 'b'))
    expect(actError(s, { type: 'build', tile: 1 }, 'a')).toMatch(/your turn/)
  })

  it('sells evenly for half the cost', () => {
    let s = arrange(withGroup(), (d) => {
      d.properties[1].level = 4
      d.properties[3].level = 3
    })
    expect(actError(s, { type: 'sellBuilding', tile: 3 }, 'a')).toMatch(/evenly/)
    s = act(s, { type: 'sellBuilding', tile: 1 }, 'a')
    expect(s.properties[1].level).toBe(3)
    expect(cash(s, 'a')).toBe(30_000 + 1500)
    s = act(s, { type: 'sellBuilding', tile: 3 }, 'a')
    expect(s.properties[3].level).toBe(2)
  })

  it('cannot build on services', () => {
    const s = arrange(game(), (d) => own(d, 'a', 5, 15))
    expect(actError(s, { type: 'build', tile: 5 }, 'a')).toMatch(/only build on cities/)
  })
})

describe('mortgage', () => {
  it('mortgages for the mortgage value and unmortgages at +10%', () => {
    let s = arrange(game(), (d) => own(d, 'a', 39))
    s = act(s, { type: 'mortgage', tile: 39 }, 'a')
    expect(cash(s, 'a')).toBe(START_CASH + 4250)
    expect(s.properties[39].mortgaged).toBe(true)
    s = act(s, { type: 'unmortgage', tile: 39 }, 'a')
    expect(cash(s, 'a')).toBe(START_CASH + 4250 - 4675)
    expect(s.properties[39].mortgaged).toBe(false)
  })

  it('requires selling buildings in the group first', () => {
    const s = arrange(game(), (d) => {
      own(d, 'a', 38, 39)
      d.properties[38].level = 1
    })
    expect(actError(s, { type: 'mortgage', tile: 39 }, 'a')).toMatch(/Sell the buildings/)
  })

  it("can't mortgage someone else's tile", () => {
    const s = arrange(game(), (d) => own(d, 'b', 39))
    expect(actError(s, { type: 'mortgage', tile: 39 }, 'a')).toMatch(/don't own/)
  })
})

describe('Club and Rest House', () => {
  it('Club: pay every other player', () => {
    let s = arrange(game(4), (d) => place(d, 'a', 15))
    s = roll(s, 'a', 5)
    expect(cash(s, 'a')).toBe(START_CASH - 300)
    expect(['b', 'c', 'd'].map((id) => cash(s, id))).toEqual([START_CASH + 100, START_CASH + 100, START_CASH + 100])
  })

  it('Club amount is configurable', () => {
    let s = arrange(game(3, { clubAmount: 250 }), (d) => place(d, 'a', 15))
    s = roll(s, 'a', 5)
    expect(cash(s, 'a')).toBe(START_CASH - 500)
  })

  it('Rest House (collect): collect from every other player', () => {
    let s = arrange(game(3), (d) => place(d, 'a', 25))
    s = roll(s, 'a', 5)
    expect(cash(s, 'a')).toBe(START_CASH + 200)
    expect(cash(s, 'b')).toBe(START_CASH - 100)
  })

  it('Rest House (skip turn): miss the next turn', () => {
    let s = arrange(game(3, { restHouseMode: 'skipTurn' }), (d) => place(d, 'a', 25))
    s = roll(s, 'a', 5)
    expect(cash(s, 'a')).toBe(START_CASH)
    expect(player(s, 'a').missNextTurn).toBe(true)
    s = act(s, { type: 'endTurn' }, 'a')
    s = roll(s, 'b', 4)
    s = act(s, { type: 'endTurn' }, 'b')
    s = roll(s, 'c', 4)
    s = act(s, { type: 'endTurn' }, 'c')
    expect(s.turn.playerId).toBe('b')
    expect(player(s, 'a').missNextTurn).toBe(false)
  })
})

describe('taxes', () => {
  it('Income Tax', () => {
    const s = roll(game(), 'a', 4)
    expect(cash(s, 'a')).toBe(START_CASH - 1000)
  })

  it('Wealth Tax per building', () => {
    let s = arrange(game(), (d) => {
      own(d, 'a', 1, 3, 6, 8, 9)
      d.properties[1].level = 2
      d.properties[3].level = 4
      d.properties[6].level = 1
      place(d, 'a', 30)
    })
    s = roll(s, 'a', 7)
    expect(cash(s, 'a')).toBe(START_CASH - (3 * 500 + 1000))
  })

  it('Wealth Tax is zero without buildings', () => {
    let s = arrange(game(), (d) => {
      own(d, 'a', 1)
      place(d, 'a', 30)
    })
    s = roll(s, 'a', 7)
    expect(cash(s, 'a')).toBe(START_CASH)
  })

  it('Wealth Tax at 1% of property prices', () => {
    let s = arrange(game(3, { wealthTaxMode: 'percent' }), (d) => {
      own(d, 'a', 39, 5)
      place(d, 'a', 30)
    })
    s = roll(s, 'a', 7)
    expect(cash(s, 'a')).toBe(START_CASH - Math.round((8500 + 9500) / 100))
  })
})

describe('Chance (decided by dice total, landing on tile 22)', () => {
  const at = (total: number, fn?: Parameters<typeof arrange>[1]) => {
    const s = arrange(game(3), (d) => {
      place(d, 'a', 22 - total)
      fn?.(d)
    })
    return roll(s, 'a', total)
  }

  it('2: lottery, collect 2,500', () => {
    const s = at(2)
    expect(cash(s, 'a')).toBe(START_CASH + 2500)
    expect(s.lastCard?.title).toMatch(/Lottery/)
    expect(s.lastCard?.deck).toBe('chance')
  })
  it('3: go to jail', () => {
    const s = at(3)
    expect(player(s, 'a').inJail).toBe(true)
    expect(player(s, 'a').position).toBe(10)
  })
  it('4: pay 500', () => expect(cash(at(4), 'a')).toBe(START_CASH - 500))
  it('5: nearest transport, buy if unowned', () => {
    const s = at(5)
    expect(player(s, 'a').position).toBe(25)
    expect(s.turn.phase).toBe('buy')
    expect(s.turn.pendingTile).toBe(25)
  })
  it('5: nearest transport, double rent if owned', () => {
    const s = at(5, (d) => own(d, 'b', 25))
    expect(cash(s, 'a')).toBe(START_CASH - 2400)
    expect(cash(s, 'b')).toBe(START_CASH + 2400)
  })
  it('5: from Chance on 36 wraps to Railways and pays salary', () => {
    let s = arrange(game(3), (d) => place(d, 'a', 31))
    s = act(s, { type: 'roll', dice: [2, 3] }, 'a')
    expect(player(s, 'a').position).toBe(5)
    expect(cash(s, 'a')).toBe(START_CASH + 1500)
  })
  it('6: pay 1,000', () => expect(cash(at(6), 'a')).toBe(START_CASH - 1000))
  it('7: go back 3 spaces', () => {
    const s = at(7)
    expect(player(s, 'a').position).toBe(19)
    expect(s.turn.pendingTile).toBe(19)
  })
  it('7: going back from 36 lands on Community Chest and resolves it', () => {
    let s = arrange(game(3), (d) => place(d, 'a', 29))
    s = act(s, { type: 'roll', dice: [3, 4] }, 'a')
    expect(player(s, 'a').position).toBe(33)
    expect(cash(s, 'a')).toBe(START_CASH - 1000) // Chest 7: School fees
  })
  it('8: repairs, 250 per house and 750 per hotel', () => {
    const s = at(8, (d) => {
      own(d, 'a', 38, 39)
      d.properties[38].level = 3
      d.properties[39].level = 4
    })
    expect(cash(s, 'a')).toBe(START_CASH - (3 * 250 + 750))
  })
  it('9: trip to Delhi (no salary from 22)', () => {
    const s = at(9)
    expect(player(s, 'a').position).toBe(38)
    expect(cash(s, 'a')).toBe(START_CASH)
    expect(s.turn.pendingTile).toBe(38)
  })
  it('10: startup funded, collect 2,000', () => expect(cash(at(10), 'a')).toBe(START_CASH + 2000))
  it('11: get out of jail free pass', () => expect(player(at(11), 'a').jailPasses).toBe(1))
  it('12: pay 500 to every player', () => {
    const s = at(12)
    expect(cash(s, 'a')).toBe(START_CASH - 1000)
    expect(cash(s, 'b')).toBe(START_CASH + 500)
    expect(cash(s, 'c')).toBe(START_CASH + 500)
  })
})

describe('Community Chest (decided by dice total, landing on tile 17)', () => {
  const at = (total: number) => {
    const s = arrange(game(3), (d) => place(d, 'a', 17 - total))
    return roll(s, 'a', total)
  }
  it('2: tax refund', () => expect(cash(at(2), 'a')).toBe(START_CASH + 1500))
  it('3: car service', () => expect(cash(at(3), 'a')).toBe(START_CASH - 700))
  it('4: Diwali bonus', () => expect(cash(at(4), 'a')).toBe(START_CASH + 1000))
  it('5: go to jail', () => expect(player(at(5), 'a').inJail).toBe(true))
  it('6: wedding gifts from every player', () => {
    const s = at(6)
    expect(cash(s, 'a')).toBe(START_CASH + 500)
    expect(cash(s, 'b')).toBe(START_CASH - 250)
  })
  it('7: school fees', () => expect(cash(at(7), 'a')).toBe(START_CASH - 1000))
  it('8: advance to Start and collect', () => {
    const s = at(8)
    expect(player(s, 'a').position).toBe(0)
    expect(cash(s, 'a')).toBe(START_CASH + 1500)
  })
  it('9: fixed deposit', () => expect(cash(at(9), 'a')).toBe(START_CASH + 2000))
  it('10: jail pass', () => expect(player(at(10), 'a').jailPasses).toBe(1))
  it('11: charity', () => expect(cash(at(11), 'a')).toBe(START_CASH - 500))
  it('12: quiz show', () => {
    const s = at(12)
    expect(cash(s, 'a')).toBe(START_CASH + 3000)
    expect(s.lastCard?.deck).toBe('chest')
  })
})

describe('auctions', () => {
  const declined = () => act(roll(game(3, { auctions: true }), 'a', 9), { type: 'decline', now: NOW }, 'a')

  it('starts an auction when a tile is declined', () => {
    const s = declined()
    expect(s.auction?.tile).toBe(9)
    expect(s.auction?.endsAt).toBe(NOW + 10_000)
    expect(waitingOn(s).sort()).toEqual(['a', 'b', 'c'])
  })

  it('requires bids in ₹100 steps above the high bid', () => {
    let s = declined()
    expect(actError(s, { type: 'bid', amount: 150, now: NOW }, 'b')).toMatch(/steps/)
    s = act(s, { type: 'bid', amount: 500, now: NOW + 1000 }, 'b')
    expect(actError(s, { type: 'bid', amount: 500, now: NOW + 1000 }, 'c')).toMatch(/at least/)
    expect(actError(s, { type: 'bid', amount: 600, now: NOW + 1000 }, 'b')).toMatch(/already the highest/)
    expect(actError(s, { type: 'bid', amount: 99_900, now: NOW + 1000 }, 'c')).toMatch(/much cash/)
  })

  it('resets the countdown on each bid and sells when time runs out', () => {
    let s = declined()
    s = act(s, { type: 'bid', amount: 1000, now: NOW + 5000 }, 'b')
    expect(s.auction?.endsAt).toBe(NOW + 15_000)
    expect(actError(s, { type: 'closeAuction', now: NOW + 14_000 }, 'c')).toMatch(/still running/)
    expect(actError(s, { type: 'bid', amount: 2000, now: NOW + 16_000 }, 'c')).toMatch(/ended/)
    s = act(s, { type: 'closeAuction', now: NOW + 15_000 }, 'c')
    expect(s.auction).toBeNull()
    expect(s.properties[9].owner).toBe('b')
    expect(cash(s, 'b')).toBe(START_CASH - 1000)
  })

  it('ends early once everyone else drops out', () => {
    let s = declined()
    s = act(s, { type: 'bid', amount: 300, now: NOW }, 'c')
    s = act(s, { type: 'passAuction' }, 'a')
    expect(s.auction).not.toBeNull()
    s = act(s, { type: 'passAuction' }, 'b')
    expect(s.auction).toBeNull()
    expect(s.properties[9].owner).toBe('c')
    expect(cash(s, 'c')).toBe(START_CASH - 300)
  })

  it('stays with the bank when nobody bids', () => {
    let s = declined()
    s = act(s, { type: 'closeAuction', now: NOW + 10_000 }, 'b')
    expect(s.properties[9].owner).toBeNull()
  })

  it('blocks turn actions during an auction', () => {
    const s = declined()
    expect(actError(s, { type: 'endTurn' }, 'a')).toMatch(/auction/)
  })

  it('excludes players who have not lapped (first-lap rule)', () => {
    let s = arrange(game(3, { firstLapRule: true, auctions: true }), (d) => (d.players[2].lapped = false))
    s = act(roll(s, 'a', 9), { type: 'decline', now: NOW }, 'a')
    expect(actError(s, { type: 'bid', amount: 100, now: NOW }, 'c')).toMatch(/passed Start/)
  })
})

describe('trades', () => {
  const base = () =>
    arrange(game(3), (d) => {
      own(d, 'a', 1, 39)
      own(d, 'b', 3)
      d.players[1].jailPasses = 1
    })

  it('proposes and accepts a mixed trade', () => {
    let s = base()
    s = act(
      s,
      { type: 'proposeTrade', toId: 'b', give: { tiles: [39], cash: 500, passes: 0 }, get: { tiles: [3], cash: 0, passes: 1 } },
      'a',
    )
    expect(s.trades).toHaveLength(1)
    expect(actError(s, { type: 'respondTrade', tradeId: 1, accept: true }, 'c')).toMatch(/not offered to you/)
    s = act(s, { type: 'respondTrade', tradeId: 1, accept: true }, 'b')
    expect(s.properties[39].owner).toBe('b')
    expect(s.properties[3].owner).toBe('a')
    expect(cash(s, 'a')).toBe(START_CASH - 500)
    expect(cash(s, 'b')).toBe(START_CASH + 500)
    expect(player(s, 'a').jailPasses).toBe(1)
    expect(player(s, 'b').jailPasses).toBe(0)
    expect(s.trades).toHaveLength(0)
  })

  it('works off-turn and while in jail', () => {
    let s = arrange(base(), (d) => {
      d.players[1].inJail = true
      d.turn.playerId = 'c'
    })
    s = act(s, { type: 'proposeTrade', toId: 'a', give: { tiles: [3], cash: 0, passes: 0 }, get: { tiles: [], cash: 3000, passes: 0 } }, 'b')
    s = act(s, { type: 'respondTrade', tradeId: 1, accept: true }, 'a')
    expect(s.properties[3].owner).toBe('a')
  })

  it('can be rejected, countered and withdrawn', () => {
    let s = base()
    const offer: Action = { type: 'proposeTrade', toId: 'b', give: { tiles: [], cash: 1000, passes: 0 }, get: { tiles: [3], cash: 0, passes: 0 } }
    s = act(s, offer, 'a')
    s = act(s, { type: 'respondTrade', tradeId: 1, accept: false }, 'b')
    expect(s.trades).toHaveLength(0)
    s = act(s, offer, 'a')
    s = act(s, { type: 'counterTrade', tradeId: 2, give: { tiles: [3], cash: 0, passes: 0 }, get: { tiles: [], cash: 2000, passes: 0 } }, 'b')
    expect(s.trades).toHaveLength(1)
    expect(s.trades[0]).toMatchObject({ id: 3, fromId: 'b', toId: 'a' })
    expect(actError(s, { type: 'cancelTrade', tradeId: 3 }, 'a')).toMatch(/Only the proposer/)
    s = act(s, { type: 'cancelTrade', tradeId: 3 }, 'b')
    expect(s.trades).toHaveLength(0)
  })

  it('only trades built-on cities as a whole colour group', () => {
    const s = arrange(base(), (d) => {
      own(d, 'a', 3)
      d.properties[1].level = 1
    })
    expect(
      actError(s, { type: 'proposeTrade', toId: 'b', give: { tiles: [3], cash: 0, passes: 0 }, get: { tiles: [], cash: 100, passes: 0 } }, 'a'),
    ).toMatch(/whole group/)
  })

  it('trades houses and hotels along with their cities', () => {
    let s = arrange(base(), (d) => {
      own(d, 'a', 1, 3)
      d.properties[1].level = 4
      d.properties[3].level = 3
    })
    s = act(s, { type: 'proposeTrade', toId: 'b', give: { tiles: [1, 3], cash: 0, passes: 0 }, get: { tiles: [], cash: 9000, passes: 0 } }, 'a')
    s = act(s, { type: 'respondTrade', tradeId: 1, accept: true }, 'b')
    expect(s.properties[1]).toMatchObject({ owner: 'b', level: 4 })
    expect(s.properties[3]).toMatchObject({ owner: 'b', level: 3 })
    expect(cash(s, 'a')).toBe(START_CASH + 9000)
    // The new owner collects the built rent straight away.
    s = arrange(s, (d) => {
      d.turn.playerId = 'c'
      place(d, 'c', 0)
    })
    s = roll(s, 'c', 3)
    expect(cash(s, 'b')).toBe(START_CASH - 9000 + 2400)
  })

  it("rejects trades of things you don't have", () => {
    const s = base()
    expect(
      actError(s, { type: 'proposeTrade', toId: 'b', give: { tiles: [3], cash: 0, passes: 0 }, get: { tiles: [], cash: 0, passes: 0 } }, 'a'),
    ).toMatch(/doesn't own/)
    expect(
      actError(s, { type: 'proposeTrade', toId: 'b', give: { tiles: [], cash: 99_999, passes: 0 }, get: { tiles: [3], cash: 0, passes: 0 } }, 'a'),
    ).toMatch(/doesn't have/)
  })

  it('re-validates on accept', () => {
    let s = base()
    s = act(s, { type: 'proposeTrade', toId: 'b', give: { tiles: [], cash: 15_000, passes: 0 }, get: { tiles: [3], cash: 0, passes: 0 } }, 'a')
    s = arrange(s, (d) => (d.players[0].cash = 10))
    expect(actError(s, { type: 'respondTrade', tradeId: 1, accept: true }, 'b')).toMatch(/doesn't have/)
  })

  it('keeps mortgaged tiles mortgaged after a trade', () => {
    let s = arrange(base(), (d) => (d.properties[39].mortgaged = true))
    s = act(s, { type: 'proposeTrade', toId: 'b', give: { tiles: [39], cash: 0, passes: 0 }, get: { tiles: [], cash: 1000, passes: 0 } }, 'a')
    s = act(s, { type: 'respondTrade', tradeId: 1, accept: true }, 'b')
    expect(s.properties[39]).toMatchObject({ owner: 'b', mortgaged: true })
  })
})

describe('debt and bankruptcy', () => {
  const broke = () =>
    arrange(game(3), (d) => {
      own(d, 'b', 38, 39)
      d.properties[38].level = 1
      d.properties[39].level = 1
      own(d, 'a', 9, 25)
      d.players[0].cash = 1000
      place(d, 'a', 32)
    })

  it('queues a debt when you cannot pay and blocks other actions', () => {
    const s = roll(broke(), 'a', 7) // Mumbai with 1 house: 5,400
    expect(s.debts).toEqual([{ debtorId: 'a', creditorId: 'b', amount: 5400, reason: 'rent for Mumbai' }])
    expect(cash(s, 'a')).toBe(1000)
    expect(waitingOn(s)).toEqual(['a'])
    expect(actError(s, { type: 'endTurn' }, 'a')).toMatch(/debt/)
    expect(actError(s, { type: 'payDebt' }, 'a')).toMatch(/more/)
    expect(actError(s, { type: 'declareBankruptcy', now: NOW }, 'a')).toMatch(/can still raise/)
  })

  it('lets you raise funds and pay', () => {
    let s = roll(broke(), 'a', 7)
    s = act(s, { type: 'mortgage', tile: 25 }, 'a') // +5,250
    s = act(s, { type: 'payDebt' }, 'a')
    expect(s.debts).toHaveLength(0)
    expect(cash(s, 'a')).toBe(1000 + 5250 - 5400)
    expect(cash(s, 'b')).toBe(START_CASH + 5400)
    s = act(s, { type: 'endTurn' }, 'a')
    expect(s.turn.playerId).toBe('b')
  })

  it('bankruptcy to a player hands over everything', () => {
    let s = roll(
      arrange(broke(), (d) => (d.properties[25].owner = null)),
      'a',
      7,
    )
    s = act(s, { type: 'mortgage', tile: 9 }, 'a') // +1,650 -> 2,650 < 5,400
    s = arrange(s, (d) => (d.players[0].jailPasses = 1))
    s = act(s, { type: 'declareBankruptcy', now: NOW }, 'a')
    expect(player(s, 'a').bankrupt).toBe(true)
    expect(cash(s, 'a')).toBe(0)
    expect(cash(s, 'b')).toBe(START_CASH + 2650)
    expect(s.properties[9]).toMatchObject({ owner: 'b', mortgaged: true })
    expect(player(s, 'b').jailPasses).toBe(1)
    expect(s.turn.playerId).toBe('b')
    expect(s.status).toBe('playing')
  })

  it('bankruptcy to the bank auctions the properties', () => {
    let s = arrange(game(3, { auctions: true }), (d) => {
      own(d, 'a', 1)
      d.players[0].cash = 100
      place(d, 'a', 0)
    })
    s = roll(s, 'a', 4) // Income Tax 1,000
    expect(s.debts[0]).toMatchObject({ creditorId: null, amount: 1000 })
    expect(actError(s, { type: 'declareBankruptcy', now: NOW }, 'a')).toMatch(/can still raise/)
    s = arrange(s, (d) => (d.debts[0].amount = 5000))
    s = act(s, { type: 'declareBankruptcy', now: NOW }, 'a')
    expect(player(s, 'a').bankrupt).toBe(true)
    expect(s.properties[1].owner).toBeNull()
    expect(s.auction?.tile).toBe(1)
    expect(s.turn.playerId).toBe('b')
  })

  it('ends the game when one player is left', () => {
    let s = arrange(game(2), (d) => {
      own(d, 'b', 39)
      d.properties[39].level = 4
      d.players[0].cash = 100
      place(d, 'a', 32)
    })
    s = roll(s, 'a', 7)
    s = act(s, { type: 'declareBankruptcy', now: NOW }, 'a')
    expect(s.status).toBe('finished')
    expect(s.winnerId).toBe('b')
    expect(applyAction(s, { type: 'endTurn' }, 'b')).toEqual({ error: 'The game is over' })
  })

  it('splits Club payments into debts per creditor when short', () => {
    let s = arrange(game(3), (d) => {
      d.players[0].cash = 150
      place(d, 'a', 15)
    })
    s = roll(s, 'a', 5)
    expect(cash(s, 'b')).toBe(START_CASH + 100)
    expect(s.debts).toEqual([{ debtorId: 'a', creditorId: 'c', amount: 100, reason: 'Club' }])
  })

  it('makes other players settle Rest House debts', () => {
    let s = arrange(game(3), (d) => {
      d.players[1].cash = 50
      own(d, 'b', 39)
      place(d, 'a', 25)
    })
    s = roll(s, 'a', 5)
    expect(waitingOn(s)).toEqual(['b'])
    expect(actError(s, { type: 'endTurn' }, 'a')).toMatch(/Sara/)
    s = act(s, { type: 'mortgage', tile: 39 }, 'b')
    s = act(s, { type: 'payDebt' }, 'b')
    expect(cash(s, 'a')).toBe(START_CASH + 200)
    s = act(s, { type: 'endTurn' }, 'a')
    expect(s.turn.playerId).toBe('b')
  })
})

describe('time limit and net worth', () => {
  it('computes net worth with mortgaged tiles at half and buildings at cost', () => {
    const s = arrange(game(2), (d) => {
      own(d, 'a', 38, 39, 5)
      d.properties[38].level = 2
      d.properties[5].mortgaged = true
    })
    expect(netWorth(s, 'a')).toBe(START_CASH + 8000 + 8500 + 2 * 7000 + 4750)
  })

  it('ends by time with the richest player winning', () => {
    let s = initialState(players(3), { timeLimitMinutes: 10 }, { now: NOW })
    s = arrange(s, (d) => own(d, 'c', 39))
    expect(actError(s, { type: 'endByTime', now: NOW + 60_000 }, 'a')).toMatch(/isn't up/)
    s = act(s, { type: 'endByTime', now: NOW + 600_000 }, 'a')
    expect(s.status).toBe('finished')
    expect(s.winnerId).toBe('c')
  })
})

