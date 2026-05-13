import { describe, it, expect } from 'vitest'
import { assembleWorld, world } from './index'
import type { GameManifest, Item, Room, World } from './types'

const manifest: GameManifest = {
  id: 'test',
  title: 'Test',
  description: 'A tiny test world.',
  startingRoom: 'foyer',
  startingInventory: ['letter'],
  endingPriority: ['true'],
}

const rooms: Record<string, Room> = {
  foyer: {
    id: 'foyer',
    title: '[ Foyer ]',
    descriptions: {
      firstVisit: 'You are here.',
      revisit: 'Still here.',
      examined: 'A foyer.',
    },
    exits: {},
    items: [],
  },
}

const items: Record<string, Item> = {
  letter: {
    id: 'letter',
    names: ['letter'],
    short: 'a letter',
    long: 'A folded letter.',
    initialState: {},
    takeable: true,
  },
}

const endings: World['endings'] = {
  true: { whenFlags: {}, narration: 'The end.' },
}

function build(overrides: Partial<Parameters<typeof assembleWorld>[0]> = {}) {
  return assembleWorld({
    game: manifest,
    rooms,
    items,
    endings,
    encounters: {},
    encounterDocs: [],
    ...overrides,
  })
}

describe('assembled world', () => {
  it('assembles a minimal manifest-backed world', () => {
    const result = build()
    expect(result.startingRoom).toBe('foyer')
    expect(result.startingInventory).toEqual(['letter'])
    expect(result.endingPriority).toEqual(['true'])
  })

  it('rejects a game manifest with an unknown starting room', () => {
    expect(() => build({
      game: { ...manifest, startingRoom: 'missing-room' },
    })).toThrow(/startingRoom references "missing-room"/)
  })

  it('rejects a game manifest with an unknown starting inventory item', () => {
    expect(() => build({
      game: { ...manifest, startingInventory: ['missing-item'] },
    })).toThrow(/startingInventory references unknown item "missing-item"/)
  })

  it('rejects a game manifest with an unknown ending priority entry', () => {
    expect(() => build({
      game: { ...manifest, endingPriority: ['missing-ending'] },
    })).toThrow(/endingPriority references "missing-ending"/)
  })

  it('contains the authored opening and main-floor rooms', () => {
    expect(Object.keys(world.rooms)).toEqual(expect.arrayContaining([
      'outside-gate',
      'foyer',
      'hallway',
      'cellar-stair',
      'parlor',
      'study',
      'dining-room',
      'conservatory',
      'smoking-room',
      'music-room',
      'servants-passage',
      'laundry',
      'stair-up',
      'bedroom',
      'nursery',
      'attic',
      'chapel',
    ]))
  })

  it('contains the authored opening, main-floor, and upper-floor items', () => {
    expect(Object.keys(world.items)).toEqual(expect.arrayContaining([
      'broken-cigarette',
      'lamp',
      'letter',
      'matches',
      'candlestick',
      'pruning-shears',
      'silver-lighter',
      'music-box-key',
      'damp-sheet',
      'grandfather-clock',
      'dinner-place-setting',
      'covered-cage',
      'childs-drawing',
      'music-box',
      'toy-dog',
      'silver-vial',
    ]))
  })

  it('all room exits resolve to known rooms', () => {
    for (const room of Object.values(world.rooms)) {
      for (const dest of Object.values(room.exits)) {
        expect(world.rooms[dest], `${room.id} → ${dest}`).toBeDefined()
      }
    }
  })

  it('hallway prose names every enabled exit', () => {
    const hallway = world.rooms['hallway']
    expect(hallway).toBeDefined()
    if (!hallway) throw new Error('hallway room is missing')
    expect(hallway.exits).toEqual({
      n: 'dining-room',
      s: 'foyer',
      e: 'cellar-stair',
      w: 'smoking-room',
      u: 'parlor',
      d: 'music-room',
    })
    const prose = `${hallway.descriptions.firstVisit}\n${hallway.descriptions.examined}`.toLowerCase()
    for (const word of ['north', 'south', 'east', 'west', 'up', 'down']) {
      expect(prose, `hallway prose should mention ${word}`).toContain(word)
    }
  })

  it('all room item refs resolve to known items', () => {
    for (const room of Object.values(world.rooms)) {
      for (const itemId of room.items) {
        expect(world.items[itemId], `${room.id} item ${itemId}`).toBeDefined()
      }
    }
  })

  it('all room encounter refs resolve to known encounters', () => {
    for (const room of Object.values(world.rooms)) {
      if (room.encounter) {
        expect(world.encounters[room.encounter]).toBeDefined()
      }
    }
  })

  it('startingRoom is a known room', () => {
    expect(world.game?.startingRoom).toBe(world.startingRoom)
    expect(world.rooms[world.startingRoom]).toBeDefined()
  })

  it('startingInventory items are known', () => {
    expect(world.game?.startingInventory).toEqual(world.startingInventory)
    for (const itemId of world.startingInventory) {
      expect(world.items[itemId]).toBeDefined()
    }
  })

  it('game manifest text is loaded from markdown', () => {
    expect(world.game?.title).toBe('Halfstreet')
    expect(world.game?.openingArt).toContain('____')
    expect(world.game?.helpText).toContain('This is a text adventure.')
    expect(world.game?.endedText).toContain('The story has ended.')
  })

  it('parser vocabulary is loaded from markdown', () => {
    expect(world.parser?.verbs.take).toContain('pick up')
    expect(world.parser?.verbs.open).toContain('uncover')
    expect(world.parser?.directions.n).toContain('north')
  })

  it('UI config is loaded from markdown', () => {
    expect(world.ui?.pageTitle).toBe('Halfstreet - Ethan J Lewis')
    expect(world.ui?.footer.links.map((link) => link.label)).toEqual(['GNU 3.0', 'Source Code'])
    expect(world.ui?.footer.showBuild).toBe(true)
    expect(world.ui?.features.typedEffect).toBe(true)
  })

  it('system messages are loaded from markdown', () => {
    expect(world.messages?.['unknown-verb']).toContain("don't fit this place")
    expect(world.messages?.taken).toBe('Taken.')
  })

  it('light mechanic config is loaded from markdown', () => {
    expect(world.mechanics?.light?.enabled).toBe(true)
    expect(world.mechanics?.light?.maxTurns).toBe(6)
    expect(world.mechanics?.light?.burnOn).toEqual(['move', 'wait'])
    expect(world.mechanics?.light?.messages?.flameDies).toBe('The flame dies.')
  })

  it('resolve mechanic config is loaded from markdown', () => {
    expect(world.mechanics?.resolve?.enabled).toBe(true)
    expect(world.mechanics?.resolve?.ladder).toEqual(['steady', 'shaken', 'reeling', 'returning'])
    expect(world.mechanics?.resolve?.safeRooms.recoverySteps).toBe(1)
    expect(world.mechanics?.resolve?.failure.afterRetreat).toBe('shaken')
  })

  it('declarative actions are loaded from markdown', () => {
    expect(world.actions?.['burn-letter']?.verbs).toEqual(['use'])
    expect(world.actions?.['burn-letter']?.requires?.allVisibleOrHeld).toEqual(['letter', 'matches'])
    expect(world.actions?.['burn-letter']?.messages.success).toContain('ash')
  })

  it('handler-backed actions are loaded from markdown', () => {
    expect(world.actions?.['drink-whiskey']?.verbs).toEqual(['drink'])
    expect(world.actions?.['drink-whiskey']?.handler).toBe('drunk-transition')
    expect(world.actions?.['drink-whiskey']?.requires?.allHeld).toEqual(['whiskey'])
    expect(world.actions?.['drink-whiskey']?.drunkTransition).toEqual({
      destinationRoom: 'drunk-hall',
      maxMoves: 20,
      wakeRoom: 'foyer',
      resetRoom: 'kitchen',
    })
  })

  it('loads a markdown-owned encounter phase machine', () => {
    expect(world.encounters.rat).toMatchObject({
      id: 'rat',
      startsIn: 'cellar-stair',
      initialPhase: 'lurking',
      onResolved: { setFlags: { ratGone: true } },
      defaultWrongVerbNarration: 'The rat watches.',
    })
    const lurking = world.encounters.rat?.phases.lurking
    expect(lurking).toBeDefined()
    expect(lurking?.transitions).toEqual([
      {
        verb: 'attack',
        target: 'rat',
        chipLabel: 'ATTACK RAT',
        chipCommand: 'attack rat',
        narration: 'You stamp. The rat squeals and is gone into the dark.',
        to: 'resolved',
      },
      {
        verb: 'wait',
        chipLabel: 'WAIT',
        narration: 'The rat does not move. Neither do you.',
        to: 'lurking',
      },
    ])
  })

  it('loads the first migrated encounter batch from markdown', () => {
    expect(world.encounters['window-guest']).toMatchObject({
      aliases: ['guest', 'window guest', 'curtains', 'curtain', 'window'],
      onResolved: { setFlags: { curtainsClosed: true } },
      onFailed: { retreatTo: 'hallway' },
    })
    expect(world.encounters['covered-cage']).toMatchObject({
      aliases: ['covered cage', 'cage', 'birdcage', 'cloth'],
      onResolved: { setFlags: { cageUncovered: true } },
      onFailed: { retreatTo: 'hallway' },
    })
    expect(world.encounters['piano-echo']).toMatchObject({
      aliases: ['piano echo', 'piano', 'note', 'key'],
      onResolved: { setFlags: { musicSolved: true } },
      onFailed: { retreatTo: 'hallway' },
    })
    expect(world.encounters['window-guest']?.phases['standing-outside']?.transitions[0]?.chipCommand).toBe('close curtains')
    expect(world.encounters['covered-cage']?.phases.rustling?.transitions[0]?.chipCommand).toBe('uncover cage')
    expect(world.encounters['piano-echo']?.phases.listening?.transitions[0]?.chipCommand).toBe('play note')
  })

  it('loads the wait-resolved encounter batch from markdown', () => {
    expect(world.encounters['breathing-wall']).toMatchObject({
      aliases: ['breathing wall', 'wall', 'walls', 'breathing'],
      onResolved: { setFlags: { breathingWallPassed: true } },
      onFailed: { retreatTo: 'music-room' },
    })
    expect(world.encounters['linen-shape']).toMatchObject({
      aliases: ['linen shape', 'shape', 'sheet', 'sheets', 'linen'],
      onResolved: { setFlags: { linenShapeEmpty: true } },
      onFailed: { retreatTo: 'servants-passage' },
    })
    expect(world.encounters['stair-sleeper']).toMatchObject({
      aliases: ['stair sleeper', 'sleeper', 'figure', 'person', 'body'],
      onResolved: { setFlags: { hallwayShifted: true } },
      onFailed: { retreatTo: 'parlor' },
    })
    expect(world.encounters['breathing-wall']?.phases.audible?.transitions[0]).toMatchObject({ verb: 'wait', chipLabel: 'WAIT', to: 'resolved' })
    expect(world.encounters['linen-shape']?.phases.hanging?.transitions[0]).toMatchObject({ verb: 'wait', chipLabel: 'WAIT', to: 'resolved' })
    expect(world.encounters['stair-sleeper']?.phases.seated?.transitions[0]).toMatchObject({ verb: 'wait', chipLabel: 'WAIT', to: 'resolved' })
  })

  it('loads the item-gated encounter batch from markdown', () => {
    expect(world.encounters['ivy-figure']).toMatchObject({
      aliases: ['ivy figure', 'figure', 'ivy', 'vines', 'vine'],
      onResolved: { setFlags: { conservatoryVinesCut: true } },
      onFailed: { retreatTo: 'dining-room' },
    })
    expect(world.encounters['child-beneath-well']).toMatchObject({
      aliases: ['child', 'well child', 'child beneath well', 'barefoot child'],
      onResolved: { setFlags: { childPassedWell: true } },
      onFailed: { retreatTo: 'well' },
    })
    expect(world.encounters['bone-keeper']).toMatchObject({
      aliases: ['bone keeper', 'keeper', 'hands', 'bones', 'ribs'],
      onResolved: { setFlags: { burialRingPlaced: true } },
      onFailed: { retreatTo: 'tunnel' },
    })

    expect(world.encounters['ivy-figure']?.phases.hidden?.transitions).toEqual([
      expect.objectContaining({ verb: 'cut', requires: { item: 'pruning-shears' }, chipCommand: 'cut vines' }),
      expect.objectContaining({ verb: 'use', requires: { item: 'pruning-shears' }, chipCommand: 'use vines with shears' }),
    ])
    expect(world.encounters['child-beneath-well']?.phases.climbing?.transitions).toEqual([
      expect.objectContaining({ verb: 'hold', requires: { item: 'toy-dog' }, setFlags: { woofReturned: true }, chipCommand: 'hold dog' }),
      expect.objectContaining({ verb: 'wait', chipLabel: 'WAIT', to: 'resolved' }),
    ])
    expect(world.encounters['bone-keeper']?.phases.arranging?.transitions[0]).toMatchObject({
      verb: 'drop',
      target: 'burial-ring',
      requires: { item: 'burial-ring' },
      chipCommand: 'leave ring',
    })
  })

  it('loads the garden and lower-passage encounter batch from markdown', () => {
    expect(world.encounters['garden-procession']).toMatchObject({
      aliases: ['garden procession', 'procession', 'lanterns', 'lantern', 'lights', 'hedge'],
      onResolved: { setFlags: { gardenQuiet: true } },
      onFailed: { retreatTo: 'back-door' },
    })
    expect(world.encounters.reflection).toMatchObject({
      aliases: ['reflection', 'water', 'black water', 'face', 'reflected figure'],
      onResolved: { setFlags: { reflectionObscured: true } },
      onFailed: { retreatTo: 'ossuary' },
    })
    expect(world.encounters['root-movement']).toMatchObject({
      aliases: ['root movement', 'roots', 'root', 'opening'],
      onResolved: { setFlags: { rootsListenedTo: true } },
      onFailed: { retreatTo: 'flooded-passage' },
    })

    expect(world.encounters['garden-procession']?.phases.passing?.transitions[0]).toMatchObject({
      verb: 'wait',
      chipLabel: 'WAIT',
      to: 'resolved',
    })
    expect(world.encounters.reflection?.phases.following?.transitions[0]).toMatchObject({
      verb: 'use',
      target: 'reflection',
      requires: { item: 'damp-sheet' },
      chipCommand: 'use water with sheet',
    })
    expect(world.encounters['root-movement']?.phases.shifting?.transitions[0]).toMatchObject({
      verb: 'listen',
      chipCommand: 'listen',
      to: 'resolved',
    })
  })

  it('loads the final encounter batch from markdown', () => {
    expect(world.encounters['portrait-woman']).toMatchObject({
      aliases: ['portrait woman', 'woman', 'portrait', 'portraits', 'veil', 'funeral veil'],
      onResolved: { setFlags: { familyResemblanceSeen: true } },
      onFailed: { retreatTo: 'root-chamber' },
    })
    expect(world.encounters.basilisk).toMatchObject({
      aliases: ['basilisk', 'creature', 'eye', 'altar', 'coil'],
      onResolved: { setFlags: { basiliskSpared: true } },
      onFailed: { retreatTo: 'vault' },
    })
    expect(world.encounters['vault-memory']).toMatchObject({
      aliases: ['vault memory', 'memory', 'bed', 'photograph', 'photo', 'thing', 'buried thing'],
    })
    expect(world.encounters['creaking-floorboard']).toMatchObject({
      aliases: ['creaking floorboard', 'floorboard', 'board', 'creak', 'secret door', 'faceless man', 'man', 'voice'],
    })
    expect(world.encounters['distant-steps']).toMatchObject({
      aliases: ['distant steps', 'steps', 'footsteps', 'hallway'],
      onResolved: { setFlags: { distantStepsPassed: true } },
      onFailed: { retreatTo: 'parlor' },
    })
    expect(world.encounters['rainwater-basin']).toMatchObject({
      aliases: ['rainwater basin', 'basin', 'water', 'rainwater', 'reflection'],
      onResolved: { setFlags: { rainRoomEntered: true, houseAcceptedYou: true } },
      onFailed: { retreatTo: 'wrong-hallway' },
    })

    expect(world.encounters['portrait-woman']?.phases.watching?.transitions[0]).toMatchObject({
      verb: 'examine',
      chipCommand: 'examine portraits',
    })
    expect(world.encounters.basilisk?.phases.sleeping?.transitions).toEqual([
      expect.objectContaining({ verb: 'pour', requires: { item: 'silver-vial' }, chipCommand: 'pour vial on basilisk' }),
      expect.objectContaining({ verb: 'use', requires: { item: 'silver-vial' }, chipCommand: 'use basilisk with vial' }),
    ])
    expect(world.encounters['vault-memory']?.phases.buried?.transitions).toEqual([
      expect.objectContaining({ verb: 'read', requires: { item: 'family-register' }, setFlags: { nameSpoken: true } }),
      expect.objectContaining({ verb: 'take', setFlags: { tookPhotograph: true } }),
      expect.objectContaining({ verb: 'attack', setFlags: { disturbedVault: true } }),
    ])
    expect(world.encounters['creaking-floorboard']?.phases.creaking?.transitions).toEqual([
      expect.objectContaining({ verb: 'listen', setFlags: { drunkSecretFound: true, facelessManMet: true, houseDebtNamed: true } }),
      expect.objectContaining({ verb: 'open', setFlags: { drunkSecretFound: true, facelessManMet: true, houseDebtNamed: true } }),
    ])
    expect(world.encounters['distant-steps']?.phases.approaching?.transitions[0]).toMatchObject({
      verb: 'wait',
      to: 'resolved',
    })
    expect(world.encounters['rainwater-basin']?.phases.reflecting?.transitions).toEqual([
      expect.objectContaining({ verb: 'look', chipCommand: 'look basin' }),
      expect.objectContaining({ verb: 'examine', chipCommand: 'examine basin' }),
    ])
  })

  it('rejects duplicate handler-backed action owners', () => {
    expect(() => build({
      actions: {
        first: {
          id: 'first',
          verbs: ['drink'],
          handler: 'drunk-transition',
          requires: { allHeld: ['letter'] },
          drunkTransition: {
            destinationRoom: 'foyer',
            maxMoves: 1,
            wakeRoom: 'foyer',
            resetRoom: 'foyer',
          },
          messages: {
            success: 'ok',
            secretFoundPassOut: 'secret',
            tooManyMovesPassOut: 'moves',
            reset: 'reset',
          },
        },
        second: {
          id: 'second',
          verbs: ['drink'],
          handler: 'drunk-transition',
          requires: { allHeld: ['letter'] },
          drunkTransition: {
            destinationRoom: 'foyer',
            maxMoves: 1,
            wakeRoom: 'foyer',
            resetRoom: 'foyer',
          },
          messages: {
            success: 'ok',
            secretFoundPassOut: 'secret',
            tooManyMovesPassOut: 'moves',
            reset: 'reset',
          },
        },
      },
    })).toThrow(/handler "drunk-transition" is already used by actions\/first\.md/)
  })

  it('reports the action field that references an unknown item', () => {
    expect(() => build({
      actions: {
        burn: {
          id: 'burn',
          verbs: ['use'],
          requires: { allVisibleOrHeld: ['letter', 'missing-match'] },
          messages: { success: 'ok' },
        },
      },
    })).toThrow(/actions\/burn\.md: requires\.allVisibleOrHeld references unknown item "missing-match"/)
  })

  it('reports the drunk transition field that references an unknown room', () => {
    expect(() => build({
      actions: {
        drink: {
          id: 'drink',
          verbs: ['drink'],
          handler: 'drunk-transition',
          requires: { allHeld: ['letter'] },
          drunkTransition: {
            destinationRoom: 'missing-room',
            maxMoves: 1,
            wakeRoom: 'foyer',
            resetRoom: 'foyer',
          },
          messages: {
            success: 'ok',
            secretFoundPassOut: 'secret',
            tooManyMovesPassOut: 'moves',
            reset: 'reset',
          },
        },
      },
    })).toThrow(/actions\/drink\.md: drunkTransition\.destinationRoom references unknown room "missing-room"/)
  })

  it('ending priority references loaded endings', () => {
    expect(world.endingPriority).toEqual(world.game?.endingPriority)
    for (const endingId of world.endingPriority ?? []) {
      expect(world.endings[endingId], endingId).toBeDefined()
    }
  })

  it('endings have non-empty narration where the original did', () => {
    expect(world.endings['true']?.narration.length).toBeGreaterThan(0)
  })
})
