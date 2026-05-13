import { describe, it, expect } from 'vitest'
import { dispatch, getLightStatus, initialStateFor } from './dispatcher'
import type { World } from '../world/types'
import type { GameState, ParsedCommand } from './types'
import { SCHEMA_VERSION } from './types'

const world: World = {
  startingRoom: 'foyer',
  startingInventory: ['matches'],
  rooms: {
    foyer: {
      id: 'foyer',
      title: '[ Foyer ]',
      descriptions: {
        firstVisit: 'A dim foyer. A door creaks north.',
        revisit: 'The dim foyer.',
        examined: 'A dim foyer with peeling paper. A door creaks north.',
      },
      exits: { n: 'hallway' },
      items: ['torch'],
      safe: true,
    },
    hallway: {
      id: 'hallway',
      title: '[ Hallway ]',
      descriptions: {
        firstVisit: 'A long hallway. The cellar door is south. A heavy door is east.',
        revisit: 'The long hallway.',
        examined: 'A long hallway. Dust thick on the floor.',
      },
      exits: { s: 'foyer', e: 'study' },
      lockedExits: { e: { requires: 'brass-key', lockedNarration: 'The east door is locked.' } },
      items: [],
    },
    study: {
      id: 'study',
      title: '[ Study ]',
      descriptions: {
        firstVisit: 'A small study, full of papers.',
        revisit: 'The small study.',
        examined: 'A small study. Papers everywhere.',
      },
      exits: { w: 'hallway' },
      items: ['brass-key'],
      safe: true,
    },
  },
  items: {
    matches: { id: 'matches', names: ['matches', 'safety matches'], short: 'a box of safety matches', long: 'A small cardboard box of safety matches.', initialState: {}, takeable: true },
    torch: { id: 'torch', names: ['torch', 'lamp'], short: 'an oil lamp', long: 'An iron oil lamp, unlit.', initialState: { lit: false }, takeable: true },
    'brass-key': { id: 'brass-key', names: ['brass key', 'key'], short: 'a brass key', long: 'A small brass key, warm to the touch.', initialState: {}, takeable: true },
  },
  encounters: {},
  endings: {
    true:  { whenFlags: { reachedTrueEnd: true }, narration: 'true ending' },
    wrong: { whenFlags: { reachedWrongEnd: true }, narration: 'wrong ending' },
    bad:   { whenFlags: { reachedBadEnd: true }, narration: 'bad ending' },
  },
}

describe('dispatcher — initial state', () => {
  it('starts in the starting room with starting inventory', () => {
    const s = initialStateFor(world)
    expect(s.schemaVersion).toBe(SCHEMA_VERSION)
    expect(s.location).toBe('foyer')
    expect(s.inventory.map((i) => i.id)).toEqual(['matches'])
  })

  it('appends the firstVisit description on initial state', () => {
    const s = initialStateFor(world)
    expect(s.transcript.some((line) => line.text.includes('dim foyer'))).toBe(true)
  })
})

describe('dispatcher — go', () => {
  it('moves through a valid exit and narrates the new room', () => {
    const s = initialStateFor(world)
    const r = dispatch(s, { kind: 'go', direction: 'n' }, world)
    expect(r.state.location).toBe('hallway')
    expect(r.appended.some((l) => l.text.includes('long hallway'))).toBe(true)
  })

  it('refuses an invalid exit', () => {
    const s = initialStateFor(world)
    const r = dispatch(s, { kind: 'go', direction: 'e' }, world)
    expect(r.state.location).toBe('foyer')
    expect(r.appended.some((l) => /can't go|no way/i.test(l.text))).toBe(true)
  })

  it('refuses a locked exit without the required item', () => {
    let s = initialStateFor(world)
    s = dispatch(s, { kind: 'go', direction: 'n' }, world).state
    const r = dispatch(s, { kind: 'go', direction: 'e' }, world)
    expect(r.state.location).toBe('hallway')
    expect(r.appended.some((l) => l.text.includes('locked'))).toBe(true)
  })
})

describe('locked exits', () => {
  function makeWorld(): World {
    return {
      startingRoom: 'antechamber',
      startingInventory: [],
      rooms: {
        antechamber: {
          id: 'antechamber',
          title: '[ Antechamber ]',
          descriptions: { firstVisit: '.', revisit: '.', examined: '.' },
          exits: { n: 'vault' },
          lockedExits: { n: { requires: 'rusted-key', lockedNarration: 'The door is locked.' } },
          items: ['rusted-key'],
        },
        vault: {
          id: 'vault',
          title: '[ Vault ]',
          descriptions: { firstVisit: 'You are inside.', revisit: '.', examined: '.' },
          exits: {},
          items: [],
        },
      },
      items: {
        'rusted-key': { id: 'rusted-key', names: ['rusted key', 'key'], short: 'a rusted key', long: '.', initialState: {}, takeable: true },
      },
      encounters: {},
      endings: { true: { whenFlags: { _never: true }, narration: '' }, wrong: { whenFlags: { _never: true }, narration: '' }, bad: { whenFlags: { _never: true }, narration: '' } },
    }
  }

  it('blocks movement without the key', () => {
    const world = makeWorld()
    const state = initialStateFor(world)
    const result = dispatch(state, { kind: 'go', direction: 'n' }, world)
    expect(result.appended.at(-1)?.text).toBe('The door is locked.')
    expect(result.state.location).toBe('antechamber')
  })

  it('permits movement once the key is in inventory', () => {
    const world = makeWorld()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'rusted-key', state: {} }] }
    const result = dispatch(state, { kind: 'go', direction: 'n' }, world)
    expect(result.state.location).toBe('vault')
  })

  it('does not consume the key on passage', () => {
    const world = makeWorld()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'rusted-key', state: {} }] }
    const result = dispatch(state, { kind: 'go', direction: 'n' }, world)
    expect(result.state.inventory.find((i) => i.id === 'rusted-key')).toBeDefined()
  })
})

describe('dispatcher — look', () => {
  it('verb-only look re-narrates the room with the examined description', () => {
    const s = initialStateFor(world)
    const r = dispatch(s, { kind: 'verb-only', verb: 'look' }, world)
    expect(r.appended.some((l) => l.text.includes('peeling paper'))).toBe(true)
  })

  it('adds a conditional sentence for items currently in the room', () => {
    const s = initialStateFor(world)
    const r = dispatch(s, { kind: 'verb-only', verb: 'look' }, world)
    expect(r.appended.some((l) => l.text === 'An oil lamp is here.')).toBe(true)
  })

  it('removes the conditional item sentence once the item is taken', () => {
    let s = initialStateFor(world)
    s = dispatch(s, { kind: 'verb-target', verb: 'take', target: { canonical: 'torch', raw: 'torch' } }, world).state
    const r = dispatch(s, { kind: 'verb-only', verb: 'look' }, world)
    expect(r.appended.some((l) => l.text === 'An oil lamp is here.')).toBe(false)
  })
})

describe('dispatcher — take and drop', () => {
  it('takes an item from the room and adds it to inventory', () => {
    const s = initialStateFor(world)
    const r = dispatch(s, { kind: 'verb-target', verb: 'take', target: { canonical: 'torch', raw: 'torch' } }, world)
    expect(r.state.inventory.map((i) => i.id)).toContain('torch')
    expect(r.appended.some((l) => /taken/i.test(l.text))).toBe(true)
  })

  it('refuses to take an item that is not present', () => {
    const s = initialStateFor(world)
    const r = dispatch(s, { kind: 'verb-target', verb: 'take', target: { canonical: 'brass-key', raw: 'brass key' } }, world)
    expect(r.state.inventory.find((i) => i.id === 'brass-key')).toBeUndefined()
    expect(r.appended.some((l) => /don't see|isn't here/i.test(l.text))).toBe(true)
  })

  it('drops an item from inventory into the current room', () => {
    let s = initialStateFor(world)
    s = dispatch(s, { kind: 'verb-target', verb: 'take', target: { canonical: 'torch', raw: 'torch' } }, world).state
    const r = dispatch(s, { kind: 'verb-target', verb: 'drop', target: { canonical: 'torch', raw: 'torch' } }, world)
    expect(r.state.inventory.find((i) => i.id === 'torch')).toBeUndefined()
  })

  it('refuses to drop a lit lightable item', () => {
    const lightWorld: World = {
      ...world,
      items: {
        ...world.items,
        lamp: { id: 'lamp', names: ['lamp'], short: 'an oil lamp', long: 'An oil lamp.', initialState: { lit: false }, takeable: true, lightable: true },
      },
    }
    let s = initialStateFor(lightWorld)
    s = { ...s, inventory: [{ id: 'lamp', state: { lit: true, burn: 6 } }] }
    const r = dispatch(s, { kind: 'verb-target', verb: 'drop', target: { canonical: 'lamp', raw: 'lamp' } }, lightWorld)
    expect(r.appended.at(-1)?.text).toBe('Extinguish it first.')
    expect(r.state.inventory.find((i) => i.id === 'lamp')).toBeDefined()
  })
})

describe('dispatcher — examine', () => {
  it('returns the long description for an item', () => {
    let s = initialStateFor(world)
    s = dispatch(s, { kind: 'verb-target', verb: 'take', target: { canonical: 'torch', raw: 'torch' } }, world).state
    const r = dispatch(s, { kind: 'verb-target', verb: 'examine', target: { canonical: 'torch', raw: 'torch' } }, world)
    expect(r.appended.some((l) => l.text.includes('iron oil lamp'))).toBe(true)
  })

  it('uses live match count when examining matches', () => {
    const matchWorld: World = {
      ...world,
      startingInventory: ['matches'],
      items: {
        ...world.items,
        matches: {
          id: 'matches',
          names: ['matches', 'match'],
          short: 'a matchbook',
          long: 'A damp matchbook with five matches left inside.',
          initialState: { uses: 4 },
          takeable: true,
          lighter: true,
          lighterUses: 5,
        },
      },
    }
    const s = initialStateFor(matchWorld)
    const r = dispatch(s, { kind: 'verb-target', verb: 'examine', target: { canonical: 'matches', raw: 'matches' } }, matchWorld)
    expect(r.appended.at(-1)?.text).toBe('A damp matchbook with four matches left inside.')
  })
})

describe('dispatcher — inventory', () => {
  it('lists held items', () => {
    const s = initialStateFor(world)
    const r = dispatch(s, { kind: 'verb-only', verb: 'inventory' }, world)
    expect(r.appended.some((l) => l.text.includes('safety matches'))).toBe(true)
  })

  it('says empty-handed when inventory is empty', () => {
    const empty: GameState = { ...initialStateFor(world), inventory: [] }
    const r = dispatch(empty, { kind: 'verb-only', verb: 'inventory' }, world)
    expect(r.appended.some((l) => /empty-handed|carrying nothing/i.test(l.text))).toBe(true)
  })
})

describe('light status', () => {
  it('shows the meter when carrying a lightable item even before it is lit', () => {
    const lightWorld: World = {
      ...world,
      items: {
        ...world.items,
        torch: {
          id: 'torch',
          names: ['torch', 'lamp'],
          short: 'an oil lamp',
          long: 'An iron oil lamp, unlit.',
          initialState: { lit: false },
          takeable: true,
          lightable: true,
        },
      },
    }
    const state: GameState = {
      ...initialStateFor(lightWorld),
      inventory: [{ id: 'torch', state: { lit: false } }],
    }

    expect(getLightStatus(state, lightWorld)).toEqual({
      itemId: 'torch',
      lit: false,
      turnsLeft: 0,
      maxTurns: 6,
    })
  })

  it('prefers a lit lightable item over an unlit one in inventory order', () => {
    const lightWorld: World = {
      ...world,
      items: {
        ...world.items,
        torch: {
          id: 'torch',
          names: ['torch', 'lamp'],
          short: 'an oil lamp',
          long: 'An iron oil lamp, unlit.',
          initialState: { lit: false },
          takeable: true,
          lightable: true,
        },
        candlestick: {
          id: 'candlestick',
          names: ['candlestick', 'candle'],
          short: 'a brass candlestick',
          long: 'A brass candlestick.',
          initialState: { lit: false },
          takeable: true,
          lightable: true,
        },
      },
    }
    const state: GameState = {
      ...initialStateFor(lightWorld),
      inventory: [
        { id: 'candlestick', state: { lit: false } },
        { id: 'torch', state: { lit: true, burn: 6 } },
      ],
    }

    expect(getLightStatus(state, lightWorld)).toEqual({
      itemId: 'torch',
      lit: true,
      turnsLeft: 6,
      maxTurns: 6,
    })
  })

  it('uses the configured light meter length and state keys', () => {
    const lightWorld: World = {
      ...world,
      mechanics: {
        light: {
          enabled: true,
          handler: 'light',
          maxTurns: 3,
          burnOn: ['wait'],
          stateKeys: { lit: 'isLit', burn: 'fuel' },
          ui: { meter: true, icon: 'candle' },
        },
      },
      items: {
        ...world.items,
        torch: {
          id: 'torch',
          names: ['torch', 'lamp'],
          short: 'an oil lamp',
          long: 'An iron oil lamp, unlit.',
          initialState: { isLit: false },
          takeable: true,
          lightable: true,
        },
      },
    }
    const state: GameState = {
      ...initialStateFor(lightWorld),
      inventory: [{ id: 'torch', state: { isLit: true, fuel: 2 } }],
    }

    expect(getLightStatus(state, lightWorld)).toEqual({
      itemId: 'torch',
      lit: true,
      turnsLeft: 2,
      maxTurns: 3,
    })
  })

  it('hides the meter when the light mechanic is disabled', () => {
    const lightWorld: World = {
      ...world,
      mechanics: {
        light: {
          enabled: false,
          handler: 'light',
          maxTurns: 6,
          burnOn: ['move', 'wait'],
          stateKeys: { lit: 'lit', burn: 'burn' },
          ui: { meter: true, icon: 'candle' },
        },
      },
      items: {
        ...world.items,
        torch: {
          id: 'torch',
          names: ['torch', 'lamp'],
          short: 'an oil lamp',
          long: 'An iron oil lamp, unlit.',
          initialState: { lit: false },
          takeable: true,
          lightable: true,
        },
      },
    }
    const state: GameState = {
      ...initialStateFor(lightWorld),
      inventory: [{ id: 'torch', state: { lit: true, burn: 6 } }],
    }

    expect(getLightStatus(state, lightWorld)).toBeNull()
  })
})

describe('ambiguous → disambiguation flow', () => {
  function makeAmbiguousWorld(): World {
    return {
      startingRoom: 'r',
      startingInventory: [],
      rooms: {
        r: {
          id: 'r',
          title: '[ R ]',
          descriptions: { firstVisit: 'r', revisit: 'r', examined: 'r' },
          exits: {},
          items: ['iron-key', 'brass-key'],
        },
      },
      items: {
        'iron-key': { id: 'iron-key', names: ['key', 'iron key'], short: 'an iron key', long: '.', initialState: {}, takeable: true },
        'brass-key': { id: 'brass-key', names: ['key', 'brass key'], short: 'a brass key', long: '.', initialState: {}, takeable: true },
      },
      encounters: {},
      endings: {
        true: { whenFlags: { _never: true }, narration: '' },
        wrong: { whenFlags: { _never: true }, narration: '' },
        bad: { whenFlags: { _never: true }, narration: '' },
      },
    }
  }

  it('sets pendingDisambiguation and prompts when the parser returns ambiguous', () => {
    const world = makeAmbiguousWorld()
    const state = initialStateFor(world)
    const cmd: ParsedCommand = {
      kind: 'ambiguous', verb: 'take', rawNoun: 'key', candidates: ['iron-key', 'brass-key'],
    }
    const result = dispatch(state, cmd, world)
    expect(result.state.pendingDisambiguation).toEqual({
      verb: 'take',
      candidates: ['iron-key', 'brass-key'],
      prompt: 'Which key — an iron key, or a brass key?',
    })
    expect(result.appended[0]?.text).toBe('Which key — an iron key, or a brass key?')
  })

  it('handles a single-word disambiguation reply by re-issuing the verb', () => {
    const world = makeAmbiguousWorld()
    let state = initialStateFor(world)
    state = {
      ...state,
      pendingDisambiguation: { verb: 'take', candidates: ['iron-key', 'brass-key'], prompt: '...' },
    }
    const result = dispatch(state, { kind: 'disambiguation', chosen: 'iron-key' }, world)
    expect(result.state.pendingDisambiguation).toBeNull()
    expect(result.state.inventory.find((i) => i.id === 'iron-key')).toBeDefined()
  })
})

function readWorld(): World {
  return {
    startingRoom: 'r',
    startingInventory: [],
    rooms: { r: { id: 'r', title: '[ R ]', descriptions: { firstVisit: '.', revisit: '.', examined: '.' }, exits: {}, items: [] } },
    items: {
      letter: { id: 'letter', names: ['letter'], short: 'a letter', long: 'A letter.', initialState: {}, takeable: true, readable: true, readableText: 'You loved Halfstreet, the letter says.' },
      rock: { id: 'rock', names: ['rock'], short: 'a rock', long: 'A rock.', initialState: {}, takeable: true },
    },
    encounters: {},
    endings: {
      true: { whenFlags: { _never: true }, narration: '' },
      wrong: { whenFlags: { _never: true }, narration: '' },
      bad: { whenFlags: { _never: true }, narration: '' },
    },
  }
}

describe('read verb', () => {
  it('narrates readableText for a readable item in inventory', () => {
    const world = readWorld()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'letter', state: {} }] }
    const result = dispatch(state, {
      kind: 'verb-target', verb: 'read', target: { canonical: 'letter', raw: 'letter' },
    }, world)
    expect(result.appended.at(-1)?.text).toBe('You loved Halfstreet, the letter says.')
  })

  it('errors politely on non-readable items', () => {
    const world = readWorld()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'rock', state: {} }] }
    const result = dispatch(state, {
      kind: 'verb-target', verb: 'read', target: { canonical: 'rock', raw: 'rock' },
    }, world)
    expect(result.appended.at(-1)?.text).toBe("There's nothing to read on it.")
  })
})

describe('light/extinguish verbs (implicit lighter)', () => {
  function w(): World {
    return {
      startingRoom: 'r',
      startingInventory: [],
      rooms: { r: { id: 'r', title: '[ R ]', descriptions: { firstVisit: '.', revisit: '.', examined: '.' }, exits: {}, items: [] } },
      items: {
        lamp: { id: 'lamp', names: ['lamp'], short: 'an oil lamp', long: '.', initialState: { lit: false }, takeable: true, lightable: true, litText: 'The wick catches.', extinguishedText: 'The flame dies.' },
        matches: { id: 'matches', names: ['matches'], short: 'a matchbook', long: '.', initialState: {}, takeable: true, lighter: true, lighterUses: 2, lighterEmptyText: 'The book is empty.' },
        rock: { id: 'rock', names: ['rock'], short: 'a rock', long: '.', initialState: {}, takeable: true },
      },
      encounters: {},
      endings: { true: { whenFlags: { _never: true }, narration: '' }, wrong: { whenFlags: { _never: true }, narration: '' }, bad: { whenFlags: { _never: true }, narration: '' } },
    }
  }

  it('lights a lamp using the matchbook implicitly', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [
      { id: 'lamp', state: { lit: false } },
      { id: 'matches', state: { uses: 2 } },
    ] }
    const result = dispatch(state, { kind: 'verb-target', verb: 'light', target: { canonical: 'lamp', raw: 'lamp' } }, world)
    expect(result.state.inventory.find((i) => i.id === 'lamp')?.state['lit']).toBe(true)
    expect(result.state.inventory.find((i) => i.id === 'matches')?.state['uses']).toBe(1)
    expect(result.appended.at(-1)?.text).toBe('The wick catches.')
  })

  it('refuses when the target is already lit', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [
      { id: 'lamp', state: { lit: true } },
      { id: 'matches', state: { uses: 2 } },
    ] }
    const result = dispatch(state, { kind: 'verb-target', verb: 'light', target: { canonical: 'lamp', raw: 'lamp' } }, world)
    expect(result.appended.at(-1)?.text).toBe("It's already lit.")
  })

  it('refuses when no lighter is in inventory', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'lamp', state: { lit: false } }] }
    const result = dispatch(state, { kind: 'verb-target', verb: 'light', target: { canonical: 'lamp', raw: 'lamp' } }, world)
    expect(result.appended.at(-1)?.text).toBe('You have nothing to light it with.')
  })

  it('refuses when the target is not lightable', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'rock', state: {} }, { id: 'matches', state: { uses: 2 } }] }
    const result = dispatch(state, { kind: 'verb-target', verb: 'light', target: { canonical: 'rock', raw: 'rock' } }, world)
    expect(result.appended.at(-1)?.text).toBe("You can't light that.")
  })

  it('asks what to use a match with instead of lighting the matchbook alone', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'matches', state: { uses: 2 } }] }
    const result = dispatch(state, { kind: 'verb-target', verb: 'light', target: { canonical: 'matches', raw: 'match' } }, world)
    expect(result.appended.at(-1)?.text).toBe('Use match with what?')
  })

  it('emits the lighter-empty message when matches reach 0', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [
      { id: 'lamp', state: { lit: false } },
      { id: 'matches', state: { uses: 1 } },
    ] }
    const result = dispatch(state, { kind: 'verb-target', verb: 'light', target: { canonical: 'lamp', raw: 'lamp' } }, world)
    expect(result.state.inventory.find((i) => i.id === 'matches')?.state['uses']).toBe(0)
    const texts = result.appended.map((l) => l.text)
    expect(texts).toContain('The wick catches.')
    expect(texts).toContain('The book is empty.')
  })

  it('burns one segment on each wait and extinguishes when the last segment expires', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'lamp', state: { lit: true, burn: 6 } }] }

    const first = dispatch(state, { kind: 'verb-only', verb: 'wait' }, world)
    expect(first.state.inventory.find((i) => i.id === 'lamp')?.state['burn']).toBe(5)
    expect(first.state.inventory.find((i) => i.id === 'lamp')?.state['lit']).toBe(true)

    const second = dispatch(first.state, { kind: 'verb-only', verb: 'wait' }, world)
    expect(second.state.inventory.find((i) => i.id === 'lamp')?.state['burn']).toBe(4)

    const third = dispatch(second.state, { kind: 'verb-only', verb: 'wait' }, world)
    expect(third.state.inventory.find((i) => i.id === 'lamp')?.state['burn']).toBe(3)

    const fourth = dispatch(third.state, { kind: 'verb-only', verb: 'wait' }, world)
    expect(fourth.state.inventory.find((i) => i.id === 'lamp')?.state['burn']).toBe(2)

    const fifth = dispatch(fourth.state, { kind: 'verb-only', verb: 'wait' }, world)
    expect(fifth.state.inventory.find((i) => i.id === 'lamp')?.state['burn']).toBe(1)
    expect(fifth.state.inventory.find((i) => i.id === 'lamp')?.state['lit']).toBe(true)

    const sixth = dispatch(fifth.state, { kind: 'verb-only', verb: 'wait' }, world)
    expect(sixth.state.inventory.find((i) => i.id === 'lamp')?.state['burn']).toBe(0)
    expect(sixth.state.inventory.find((i) => i.id === 'lamp')?.state['lit']).toBe(false)
    expect(sixth.appended.map((l) => l.text)).toContain('The flame dies.')
  })

  it('burns one segment on movement', () => {
    const world = w()
    const movingWorld: World = {
      ...world,
      rooms: {
        ...world.rooms,
        r: {
          id: 'r',
          title: '[ R ]',
          descriptions: { firstVisit: '.', revisit: '.', examined: '.' },
          exits: { n: 'r2' },
          items: [],
        },
        r2: { id: 'r2', title: '[ R2 ]', descriptions: { firstVisit: '.', revisit: '.', examined: '.' }, exits: {}, items: [] },
      },
    }
    let state = initialStateFor(movingWorld)
    state = { ...state, inventory: [{ id: 'lamp', state: { lit: true, burn: 6 } }] }

    const result = dispatch(state, { kind: 'go', direction: 'n' }, movingWorld)
    expect(result.state.inventory.find((i) => i.id === 'lamp')?.state['burn']).toBe(5)
    expect(result.state.location).toBe('r2')
  })

  it('uses configured maxTurns when lighting and burning down', () => {
    const baseWorld = w()
    const world: World = {
      ...baseWorld,
      mechanics: {
        light: {
          enabled: true,
          handler: 'light',
          maxTurns: 3,
          burnOn: ['wait'],
          stateKeys: { lit: 'lit', burn: 'burn' },
          ui: { meter: true, icon: 'candle' },
          messages: { flameDies: 'The configured light dies.' },
        },
      },
      items: {
        ...baseWorld.items,
        lamp: {
          id: 'lamp',
          names: ['lamp'],
          short: 'an oil lamp',
          long: '.',
          initialState: { lit: false },
          takeable: true,
          lightable: true,
          litText: 'The wick catches.',
        },
      },
    }
    let state = initialStateFor(world)
    state = { ...state, inventory: [
      { id: 'lamp', state: { lit: false } },
      { id: 'matches', state: { uses: 2 } },
    ] }

    const lit = dispatch(state, { kind: 'verb-target', verb: 'light', target: { canonical: 'lamp', raw: 'lamp' } }, world)
    expect(lit.state.inventory.find((i) => i.id === 'lamp')?.state['burn']).toBe(3)

    const first = dispatch(lit.state, { kind: 'verb-only', verb: 'wait' }, world)
    expect(first.state.inventory.find((i) => i.id === 'lamp')?.state['burn']).toBe(2)
    const second = dispatch(first.state, { kind: 'verb-only', verb: 'wait' }, world)
    expect(second.state.inventory.find((i) => i.id === 'lamp')?.state['burn']).toBe(1)
    const third = dispatch(second.state, { kind: 'verb-only', verb: 'wait' }, world)
    expect(third.state.inventory.find((i) => i.id === 'lamp')?.state['lit']).toBe(false)
    expect(third.appended.map((l) => l.text)).toContain('The configured light dies.')
  })

  it('does not burn down on movement when move is not configured', () => {
    const world: World = {
      ...w(),
      mechanics: {
        light: {
          enabled: true,
          handler: 'light',
          maxTurns: 3,
          burnOn: ['wait'],
          stateKeys: { lit: 'lit', burn: 'burn' },
          ui: { meter: true, icon: 'candle' },
        },
      },
      rooms: {
        r: { id: 'r', title: '[ R ]', descriptions: { firstVisit: '.', revisit: '.', examined: '.' }, exits: { n: 'r2' }, items: [] },
        r2: { id: 'r2', title: '[ R2 ]', descriptions: { firstVisit: '.', revisit: '.', examined: '.' }, exits: {}, items: [] },
      },
    }
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'lamp', state: { lit: true, burn: 3 } }] }

    const result = dispatch(state, { kind: 'go', direction: 'n' }, world)
    expect(result.state.inventory.find((i) => i.id === 'lamp')?.state['burn']).toBe(3)
  })

  it('disabling the light mechanic removes burn-down behavior', () => {
    const world: World = {
      ...w(),
      mechanics: {
        light: {
          enabled: false,
          handler: 'light',
          maxTurns: 6,
          burnOn: ['move', 'wait'],
          stateKeys: { lit: 'lit', burn: 'burn' },
          ui: { meter: true, icon: 'candle' },
        },
      },
    }
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'lamp', state: { lit: true, burn: 1 } }] }

    const result = dispatch(state, { kind: 'verb-only', verb: 'wait' }, world)
    expect(result.state.inventory.find((i) => i.id === 'lamp')?.state).toEqual({ lit: true, burn: 1 })
    expect(result.appended.map((l) => l.text)).not.toContain('The flame dies.')
  })

  it('extinguishes a lit lamp', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'lamp', state: { lit: true } }] }
    const result = dispatch(state, { kind: 'verb-target', verb: 'extinguish', target: { canonical: 'lamp', raw: 'lamp' } }, world)
    expect(result.state.inventory.find((i) => i.id === 'lamp')?.state['lit']).toBe(false)
    expect(result.appended.at(-1)?.text).toBe('The flame dies.')
  })

  it("refuses to extinguish what isn't lit", () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'lamp', state: { lit: false } }] }
    const result = dispatch(state, { kind: 'verb-target', verb: 'extinguish', target: { canonical: 'lamp', raw: 'lamp' } }, world)
    expect(result.appended.at(-1)?.text).toBe("It isn't lit.")
  })
})

describe('light X with Y (explicit lighter)', () => {
  function w(): World {
    return {
      startingRoom: 'r',
      startingInventory: [],
      rooms: { r: { id: 'r', title: '[ R ]', descriptions: { firstVisit: '.', revisit: '.', examined: '.' }, exits: {}, items: [] } },
      items: {
        lamp: { id: 'lamp', names: ['lamp'], short: 'an oil lamp', long: '.', initialState: { lit: false }, takeable: true, lightable: true, litText: 'The wick catches.', extinguishedText: 'The flame dies.' },
        matches: { id: 'matches', names: ['matches'], short: 'a matchbook', long: '.', initialState: {}, takeable: true, lighter: true, lighterUses: 2, lighterEmptyText: 'The book is empty.' },
        rock: { id: 'rock', names: ['rock'], short: 'a rock', long: '.', initialState: {}, takeable: true },
      },
      encounters: {},
      endings: { true: { whenFlags: { _never: true }, narration: '' }, wrong: { whenFlags: { _never: true }, narration: '' }, bad: { whenFlags: { _never: true }, narration: '' } },
    }
  }

  it('lights with the explicit instrument', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [
      { id: 'lamp', state: { lit: false } },
      { id: 'matches', state: { uses: 2 } },
    ] }
    const result = dispatch(state, {
      kind: 'verb-target-prep', verb: 'light',
      target: { canonical: 'lamp', raw: 'lamp' },
      preposition: 'with',
      indirect: { canonical: 'matches', raw: 'matches' },
    }, world)
    expect(result.state.inventory.find((i) => i.id === 'lamp')?.state['lit']).toBe(true)
    expect(result.state.inventory.find((i) => i.id === 'matches')?.state['uses']).toBe(1)
  })

  it('refuses when the named instrument is not a lighter', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [
      { id: 'lamp', state: { lit: false } },
      { id: 'rock', state: {} },
    ] }
    const result = dispatch(state, {
      kind: 'verb-target-prep', verb: 'light',
      target: { canonical: 'lamp', raw: 'lamp' },
      preposition: 'with',
      indirect: { canonical: 'rock', raw: 'rock' },
    }, world)
    expect(result.appended.at(-1)?.text).toBe("That isn't going to help.")
  })
})

describe('use verb routing', () => {
  function w(): World {
    return {
      startingRoom: 'r',
      startingInventory: [],
      rooms: { r: { id: 'r', title: '[ R ]', descriptions: { firstVisit: '.', revisit: '.', examined: '.' }, exits: {}, items: [] } },
      items: {
        rock: { id: 'rock', names: ['rock'], short: 'a rock', long: '.', initialState: {}, takeable: true },
        matches: { id: 'matches', names: ['matches', 'match'], short: 'a matchbook', long: '.', initialState: { uses: 2 }, takeable: true, lighter: true, lighterUses: 2, lighterEmptyText: 'The book is empty.' },
        letter: { id: 'letter', names: ['letter'], short: 'a letter', long: '.', initialState: {}, takeable: true, readable: true, readableText: 'Read me.' },
        'broken-cigarette': { id: 'broken-cigarette', names: ['cigarette', 'broken cigarette'], short: 'a broken cigarette', long: '.', initialState: { lit: false }, takeable: true, lightable: true, litText: 'The end glows once, then steadies. The smoke is bitter.' },
      },
      actions: {
        'burn-letter': {
          id: 'burn-letter',
          verbs: ['use'],
          requires: { allVisibleOrHeld: ['letter', 'matches'] },
          consumes: { inventory: ['letter'] },
          decrements: { item: 'matches', stateKey: 'uses' },
          setsFlags: { letterBurned: true },
          messages: {
            success: 'The letter catches at one corner. In a few breaths it is ash.',
            spent: 'The matchbook is empty.',
            missingRequired: "You don't see the letter here.",
          },
        },
      },
      encounters: {},
      endings: { true: { whenFlags: { _never: true }, narration: '' }, wrong: { whenFlags: { _never: true }, narration: '' }, bad: { whenFlags: { _never: true }, narration: '' } },
    }
  }

  it('falls back when no encounter consumes use', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'rock', state: {} }] }
    const result = dispatch(state, {
      kind: 'verb-target', verb: 'use', target: { canonical: 'rock', raw: 'rock' },
    }, world)
    expect(result.appended.at(-1)?.text).toBe("You can't think how to use that here.")
  })

  it('asks what to use a bare match with', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'matches', state: { uses: 2 } }] }
    const result = dispatch(state, {
      kind: 'verb-target', verb: 'use', target: { canonical: 'matches', raw: 'match' },
    }, world)
    expect(result.appended.at(-1)?.text).toBe('Use match with what?')
  })

  it('burns the letter when using a match with it', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'matches', state: { uses: 2 } }, { id: 'letter', state: {} }] }
    const result = dispatch(state, {
      kind: 'verb-target-prep', verb: 'use',
      target: { canonical: 'matches', raw: 'match' },
      preposition: 'with',
      indirect: { canonical: 'letter', raw: 'letter' },
    }, world)

    expect(result.state.inventory.find((i) => i.id === 'letter')).toBeUndefined()
    expect(result.state.inventory.find((i) => i.id === 'matches')?.state['uses']).toBe(1)
    expect(result.state.flags['letterBurned']).toBe(true)
    expect(result.appended.at(-1)?.text).toContain('ash')
  })

  it('lights a lightable item when using a match with it', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [
      { id: 'matches', state: { uses: 2 } },
      { id: 'broken-cigarette', state: { lit: false } },
    ] }
    const result = dispatch(state, {
      kind: 'verb-target-prep', verb: 'use',
      target: { canonical: 'matches', raw: 'match' },
      preposition: 'with',
      indirect: { canonical: 'broken-cigarette', raw: 'cigarette' },
    }, world)

    expect(result.state.inventory.find((i) => i.id === 'broken-cigarette')?.state['lit']).toBe(true)
    expect(result.state.inventory.find((i) => i.id === 'matches')?.state['uses']).toBe(1)
    expect(result.appended.at(-1)?.text).toBe('The end glows once, then steadies. The smoke is bitter.')
  })
})

describe('handler-backed drink action', () => {
  function w(): World {
    return {
      startingRoom: 'r',
      startingInventory: ['whiskey'],
      rooms: {
        r: { id: 'r', title: '[ R ]', descriptions: { firstVisit: '.', revisit: '.', examined: '.' }, exits: {}, items: [] },
        'drunk-start': { id: 'drunk-start', title: '[ Drunk Start ]', descriptions: { firstVisit: 'The hall tips.', revisit: 'The hall tips again.', examined: '.' }, exits: { n: 'drunk-next' }, items: [] },
        'drunk-next': { id: 'drunk-next', title: '[ Drunk Next ]', descriptions: { firstVisit: 'The room doubles.', revisit: 'The room doubles again.', examined: '.' }, exits: { s: 'drunk-start' }, items: [] },
        vestibule: { id: 'vestibule', title: '[ Vestibule ]', descriptions: { firstVisit: '.', revisit: 'You wake somewhere else.', examined: '.' }, exits: {}, items: [] },
        pantry: { id: 'pantry', title: '[ Pantry ]', descriptions: { firstVisit: '.', revisit: '.', examined: '.' }, exits: {}, items: ['whiskey'] },
      },
      items: {
        whiskey: { id: 'whiskey', names: ['whiskey'], short: 'a bottle of whiskey', long: '.', initialState: {}, takeable: true },
      },
      actions: {
        'drink-whiskey': {
          id: 'drink-whiskey',
          verbs: ['drink'],
          handler: 'drunk-transition',
          requires: { allHeld: ['whiskey'] },
          consumes: { inventory: ['whiskey'] },
          drunkTransition: {
            destinationRoom: 'drunk-start',
            maxMoves: 2,
            wakeRoom: 'vestibule',
            resetRoom: 'pantry',
          },
          messages: {
            success: 'Custom drink text.',
            missingRequired: 'Hold it first.',
            tooManyMovesPassOut: 'Custom pass out.',
            reset: 'Custom reset.',
          },
        },
      },
      encounters: {},
      endings: { true: { whenFlags: { _never: true }, narration: '' }, wrong: { whenFlags: { _never: true }, narration: '' }, bad: { whenFlags: { _never: true }, narration: '' } },
    }
  }

  it('uses markdown action config for destination, move cap, wake room, and reset room', () => {
    const world = w()
    let state = initialStateFor(world)
    let result = dispatch(state, { kind: 'verb-target', verb: 'drink', target: { canonical: 'whiskey', raw: 'whiskey' } }, world)

    expect(result.state.location).toBe('drunk-start')
    expect(result.state.inventory.find((i) => i.id === 'whiskey')).toBeUndefined()
    expect(result.appended.map((l) => l.text)).toContain('Custom drink text.')

    state = {
      ...result.state,
      roomState: {
        ...result.state.roomState,
        pantry: { takenItems: ['whiskey'], droppedItems: ['whiskey'] },
      },
    }
    result = dispatch(state, { kind: 'go', direction: 'n' }, world)
    expect(result.state.location).toBe('drunk-next')
    expect(result.state.flags['drunkMoves']).toBe(1)

    result = dispatch(result.state, { kind: 'go', direction: 's' }, world)
    expect(result.state.location).toBe('vestibule')
    expect(result.state.flags['drunk']).toBe(false)
    expect(result.state.roomState['pantry']?.['takenItems']).toEqual([])
    expect(result.state.roomState['pantry']?.['droppedItems']).toEqual([])
    expect(result.appended.map((l) => l.text)).toContain('Custom pass out.')
    expect(result.appended.map((l) => l.text)).toContain('Custom reset.')
  })
})

describe('ending detection', () => {
  function makeWorld(): World {
    return {
      startingRoom: 'r',
      startingInventory: [],
      rooms: {
        r: {
          id: 'r',
          title: '[ R ]',
          descriptions: { firstVisit: '.', revisit: '.', examined: '.' },
          exits: { n: 'r2' },
          items: [],
        },
        r2: {
          id: 'r2',
          title: '[ R2 ]',
          descriptions: { firstVisit: '.', revisit: '.', examined: '.' },
          exits: {},
          items: [],
        },
      },
      items: {},
      encounters: {},
      endings: {
        true: { whenFlags: { reachedR2: true }, narration: 'You stand at the top of the stair.' },
        wrong: { whenFlags: {}, narration: 'You disturb what should not be disturbed.' },
        bad: { whenFlags: { tookPhoto: true }, narration: 'The child in it is you.' },
      },
    }
  }

  it('sets endedWith and emits an ending line when flags match', () => {
    const world = makeWorld()
    let state = initialStateFor(world)
    state = { ...state, flags: { reachedR2: true } }
    const result = dispatch(state, { kind: 'verb-only', verb: 'wait' }, world)
    expect(result.state.endedWith).toBe('true')
    const last = result.appended.at(-1)!
    expect(last.kind).toBe('ending')
    expect(last.text).toBe('You stand at the top of the stair.')
  })

  it('honors priority order: true beats wrong beats bad', () => {
    const world = makeWorld()
    let state = initialStateFor(world)
    state = { ...state, flags: { reachedR2: true } }
    const result = dispatch(state, { kind: 'verb-only', verb: 'wait' }, world)
    expect(result.state.endedWith).toBe('true')
  })

  it('rejects further input once ended', () => {
    const world = makeWorld()
    let state = initialStateFor(world)
    state = { ...state, flags: { reachedR2: true } }
    const ended = dispatch(state, { kind: 'verb-only', verb: 'wait' }, world).state
    const result = dispatch(ended, { kind: 'verb-only', verb: 'wait' }, world)
    expect(result.appended.at(-1)?.text).toBe('The story has ended. Type `restart` or `undo`.')
    expect(result.state.location).toBe(ended.location)
  })

  it('does not fire on unknown turns (no state mutation)', () => {
    const world = makeWorld()
    const state = initialStateFor(world)
    const result = dispatch(state, { kind: 'unknown', raw: 'fnord', reason: 'unknown-verb' }, world)
    expect(result.state.endedWith).toBeNull()
  })
})
