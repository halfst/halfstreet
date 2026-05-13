import { describe, it, expect } from 'vitest'
import {
  gameFrontmatterSchema,
  actionFrontmatterSchema,
  lightMechanicFrontmatterSchema,
  parserFrontmatterSchema,
  uiFrontmatterSchema,
  roomFrontmatterSchema,
  itemFrontmatterSchema,
  endingFrontmatterSchema,
  encounterFrontmatterSchema,
} from './schema'

describe('gameFrontmatterSchema', () => {
  it('accepts a markdown game manifest', () => {
    const data = {
      id: 'halfstreet',
      title: 'Halfstreet',
      description: 'A gothic mystery.',
      startingRoom: 'outside-gate',
      startingInventory: ['letter', 'matches'],
      endingPriority: ['true', 'wrong'],
      transcriptCap: 200,
    }
    expect(() => gameFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('rejects an empty ending priority', () => {
    const data = {
      id: 'halfstreet',
      title: 'Halfstreet',
      description: 'A gothic mystery.',
      startingRoom: 'outside-gate',
      startingInventory: [],
      endingPriority: [],
    }
    expect(() => gameFrontmatterSchema.parse(data)).toThrow()
  })
})

describe('parserFrontmatterSchema', () => {
  it('accepts markdown parser vocabulary', () => {
    const data = {
      directions: {
        n: ['n', 'north'],
        s: ['s', 'south'],
        e: ['e', 'east'],
        w: ['w', 'west'],
        u: ['u', 'up'],
        d: ['d', 'down'],
      },
      prepositions: ['with', 'on', 'in', 'to'],
      stopWords: ['at', 'the', 'a', 'an'],
      noTargetVerbs: ['look', 'inventory', 'wait', 'listen'],
      metaVerbs: ['restart', 'undo', 'theme'],
      verbs: {
        go: ['go', 'walk'],
        look: ['look', 'observe'],
        take: ['take', 'pick up'],
      },
    }
    expect(() => parserFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('rejects unsupported verb keys', () => {
    const data = {
      directions: {
        n: ['n'],
        s: ['s'],
        e: ['e'],
        w: ['w'],
        u: ['u'],
        d: ['d'],
      },
      prepositions: ['with'],
      verbs: { dance: ['dance'] },
    }
    expect(() => parserFrontmatterSchema.parse(data)).toThrow()
  })
})

describe('uiFrontmatterSchema', () => {
  it('accepts markdown UI config', () => {
    const data = {
      pageTitle: 'Halfstreet - Ethan J Lewis',
      description: 'A gothic mystery.',
      robots: 'noindex',
      themeColor: '#1a0d00',
      footer: {
        copyright: '© 2026 Ethan J Lewis',
        copyrightHref: 'https://ethanjlewis.com',
        buildLabel: 'Build #',
        showBuild: true,
        links: [
          { label: 'GNU 3.0', href: 'https://half.st/ejlewis/halfstreet/src/branch/main/LICENSE' },
          { label: 'Source Code', href: 'https://half.st/ejlewis/halfstreet' },
        ],
      },
      features: {
        chips: true,
        lightMeter: true,
        typedEffect: true,
        roomScroll: true,
      },
    }
    expect(() => uiFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('rejects invalid footer links', () => {
    const data = {
      pageTitle: 'Halfstreet',
      description: 'A gothic mystery.',
      footer: {
        copyright: '© 2026 Ethan J Lewis',
        links: [{ label: 'Source Code', href: '/relative' }],
      },
    }
    expect(() => uiFrontmatterSchema.parse(data)).toThrow()
  })
})

describe('lightMechanicFrontmatterSchema', () => {
  it('accepts markdown light mechanic config', () => {
    const data = {
      enabled: true,
      handler: 'light',
      maxTurns: 4,
      burnOn: ['move', 'wait'],
      stateKeys: { lit: 'lit', burn: 'burn' },
      ui: { meter: true, icon: 'candle' },
    }
    expect(() => lightMechanicFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('rejects unknown burn triggers', () => {
    const data = {
      enabled: true,
      handler: 'light',
      maxTurns: 4,
      burnOn: ['look'],
    }
    expect(() => lightMechanicFrontmatterSchema.parse(data)).toThrow()
  })
})

describe('actionFrontmatterSchema', () => {
  it('accepts a declarative action', () => {
    const data = {
      id: 'burn-letter',
      verbs: ['use'],
      requires: { allVisibleOrHeld: ['letter', 'matches'] },
      consumes: { inventory: ['letter'] },
      decrements: { item: 'matches', stateKey: 'uses' },
      setsFlags: { letterBurned: true },
    }
    expect(() => actionFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('accepts a handler-backed drunk transition action', () => {
    const data = {
      id: 'drink-whiskey',
      verbs: ['drink'],
      handler: 'drunk-transition',
      requires: { allHeld: ['whiskey'] },
      consumes: { inventory: ['whiskey'] },
      drunkTransition: {
        destinationRoom: 'drunk-hall',
        maxMoves: 20,
        wakeRoom: 'foyer',
        resetRoom: 'kitchen',
      },
    }
    expect(() => actionFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('requires drunk transition config for handler-backed drunk actions', () => {
    const data = { id: 'drink-whiskey', verbs: ['drink'], handler: 'drunk-transition' }
    expect(() => actionFrontmatterSchema.parse(data)).toThrow(/drunkTransition is required/)
  })

  it('rejects drunk transition config without the matching handler', () => {
    const data = {
      id: 'drink-whiskey',
      verbs: ['drink'],
      drunkTransition: {
        destinationRoom: 'drunk-hall',
        maxMoves: 20,
        wakeRoom: 'foyer',
        resetRoom: 'kitchen',
      },
    }
    expect(() => actionFrontmatterSchema.parse(data)).toThrow(/only supported when handler is drunk-transition/)
  })

  it('rejects unsupported action verbs', () => {
    const data = { id: 'dance-letter', verbs: ['dance'] }
    expect(() => actionFrontmatterSchema.parse(data)).toThrow()
  })
})

describe('roomFrontmatterSchema', () => {
  it('accepts a fully populated room', () => {
    const data = {
      id: 'foyer',
      title: '[ Foyer ]',
      exitN: 'hallway',
      exitS: null,
      exitE: null,
      exitW: null,
      exitU: null,
      exitD: null,
      items: ['letter'],
      encounter: null,
      safe: true,
    }
    expect(() => roomFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('accepts a locked exit with sibling fields', () => {
    const data = {
      id: 'hall',
      title: '[ Hall ]',
      exitN: null, exitS: null, exitE: null, exitW: null, exitU: null,
      exitD: 'vault',
      exitDRequires: 'rusted-key',
      exitDLockedText: 'The door is locked.',
      items: [],
    }
    expect(() => roomFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('rejects a room missing a required exit field', () => {
    const data = { id: 'r', title: '[ R ]', exitN: null, items: [] }
    expect(() => roomFrontmatterSchema.parse(data)).toThrow()
  })
})

describe('itemFrontmatterSchema', () => {
  it('accepts an item with state', () => {
    const data = {
      id: 'lamp',
      names: ['lamp', 'oil lamp'],
      short: 'an oil lamp',
      takeable: true,
      initialState: { lit: false },
    }
    expect(() => itemFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('accepts an item without state (defaults to {})', () => {
    const parsed = itemFrontmatterSchema.parse({
      id: 'letter',
      names: ['letter'],
      short: 'a letter',
      takeable: true,
    })
    expect(parsed.initialState).toEqual({})
  })
})

describe('endingFrontmatterSchema', () => {
  it('accepts true ending shape', () => {
    const data = { id: 'true', whenFlags: { ratGone: true } }
    expect(() => endingFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('accepts custom ending ids', () => {
    const data = { id: 'secret', whenFlags: {} }
    expect(() => endingFrontmatterSchema.parse(data)).not.toThrow()
  })
})

describe('encounterFrontmatterSchema', () => {
  it('accepts an encounter narration doc', () => {
    const data = { id: 'rat', startsIn: 'cellar-stair', initialPhase: 'lurking' }
    expect(() => encounterFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('accepts markdown-owned encounter phases', () => {
    const data = {
      id: 'rat',
      startsIn: 'cellar-stair',
      initialPhase: 'lurking',
      onResolved: { setFlags: { ratGone: true } },
      defaultWrongVerbNarration: 'wrong-verb',
      phases: {
        lurking: {
          description: 'lurking',
          transitions: [
            {
              verb: 'attack',
              target: 'rat',
              chipLabel: 'ATTACK RAT',
              chipCommand: 'attack rat',
              narration: 'attack-rat-resolved',
              to: 'resolved',
            },
          ],
        },
      },
    }
    expect(() => encounterFrontmatterSchema.parse(data)).not.toThrow()
  })
})

describe('itemFrontmatterSchema — bible additions', () => {
  it('accepts readable + lighter fields', () => {
    const data = {
      id: 'matches',
      names: ['matches', 'matchbook'],
      short: 'a matchbook',
      takeable: true,
      lighter: true,
      lighterUses: 4,
    }
    expect(() => itemFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('accepts lightable on its own', () => {
    const data = { id: 'lamp', names: ['lamp'], short: 'a lamp', takeable: true, lightable: true }
    expect(() => itemFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('rejects negative lighterUses', () => {
    const data = { id: 'matches', names: ['matches'], short: 'matches', takeable: true, lighter: true, lighterUses: -1 }
    expect(() => itemFrontmatterSchema.parse(data)).toThrow()
  })
})
