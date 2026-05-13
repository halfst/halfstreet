import { describe, it, expect } from 'vitest'
import { parse } from './parser'
import type { ParserContext } from './parser'
import { dispatch, getItemsInRoom, initialStateFor } from './dispatcher'
import { world } from '../world'
import type { GameState } from './types'

function ctxFor(state: GameState): ParserContext {
  const room = world.rooms[state.location]
  const visibleNouns: { id: string; aliases: string[] }[] = []
  for (const itemId of room?.items ?? []) {
    const item = world.items[itemId]
    if (item) visibleNouns.push({ id: itemId, aliases: item.names })
  }
  for (const inst of state.inventory) {
    const item = world.items[inst.id]
    if (item) visibleNouns.push({ id: inst.id, aliases: item.names })
  }
  if (room?.encounter) {
    const encounter = world.encounters[room.encounter]
    visibleNouns.push({
      id: room.encounter,
      aliases: [room.encounter, room.encounter.replace(/-/g, ' '), ...(encounter?.aliases ?? [])],
    })
  }
  return {
    knownItems: Object.keys(world.items),
    knownEncounters: Object.keys(world.encounters),
    visibleNouns,
    inventoryItemIds: state.inventory.map((i) => i.id),
    lastNoun: state.lastNoun,
    awaitingDisambiguation: state.pendingDisambiguation,
  }
}

function play(commands: string[]): GameState {
  let state = initialStateFor(world)
  for (const cmd of commands) {
    const parsed = parse(cmd, ctxFor(state))
    state = dispatch(state, parsed, world).state
  }
  return state
}

describe('playthrough — sample world', () => {
  it('reaches the rat-gone flag via the canonical command sequence', () => {
    const state = play([
      'read letter',  // verb is recognized but encounter takes priority elsewhere; here it's a no-op
      'n',            // gate → foyer
      'n',            // foyer → hallway
      'take lamp',
      'e',            // hallway → cellar-stair (triggers rat encounter)
      'attack rat',
      'yes',
    ])
    expect(state.flags['ratGone']).toBe(true)
    expect(state.location).toBe('cellar-stair')
    expect(state.encounterState['rat']).toBeUndefined()
  })

  it('handles invalid moves gracefully', () => {
    const state = play([
      'go up',        // gate has no up exit
      'n',
      's',
      'flibbertigibbet',  // unknown verb
    ])
    expect(state.location).toBe('outside-gate')
  })

  it('plays through the main-floor slice encounters', () => {
    const state = play([
      'n',                 // gate → foyer
      'n',                 // foyer → hallway
      'n',                 // hallway → dining-room
      'close curtains',
      'take candlestick',
      'n',                 // dining-room → conservatory
      'take shears',
      'cut vines with shears',
      's',
      'w',                 // dining-room → hallway
      'w',                 // hallway → smoking-room
      'take lighter',
      'uncover cage',
      'e',
      'd',                 // hallway → music-room
      'play note',
      'take tiny key',
      'n',                 // music-room → servants-passage
      'wait',
      'e',                 // servants-passage → laundry
      'wait',
      'take damp sheet',
    ])

    expect(state.flags['window-guest.resolved']).toBe(true)
    expect(state.flags['ivy-figure.resolved']).toBe(true)
    expect(state.flags['covered-cage.resolved']).toBe(true)
    expect(state.flags['piano-echo.resolved']).toBe(true)
    expect(state.flags['breathing-wall.resolved']).toBe(true)
    expect(state.flags['linen-shape.resolved']).toBe(true)
    expect(state.inventory.map((i) => i.id)).toEqual(expect.arrayContaining([
      'candlestick',
      'pruning-shears',
      'silver-lighter',
      'music-box-key',
      'damp-sheet',
    ]))
  })

  it('plays through the upper-floor slice', () => {
    const state = play([
      'n',                 // gate → foyer
      'n',                 // foyer → hallway
      'u',                 // hallway → parlor
      'u',                 // parlor → upper stair
      'wait',
      'u',                 // upper stair → bedroom
      'e',                 // bedroom → nursery
      'read drawing',
      'take dog',
      'w',
      'u',                 // bedroom → attic
    ])

    expect(state.flags['stair-sleeper.resolved']).toBe(true)
    expect(state.flags['hallwayShifted']).toBe(true)
    expect(state.location).toBe('attic')
    expect(state.inventory.map((i) => i.id)).toContain('toy-dog')
  })

  it('plays through the garden and grounds slice', () => {
    const state = play([
      'n',                 // gate → foyer
      'n',                 // foyer → hallway
      'u',                 // hallway → parlor
      'u',                 // parlor → upper stair
      'wait',
      'u',                 // upper stair → bedroom
      'e',                 // bedroom → nursery
      'take dog',
      'w',
      'd',                 // bedroom → upper stair
      'd',                 // upper stair → parlor
      'd',                 // parlor → hallway
      'n',                 // hallway → dining-room
      'close curtains',
      'e',                 // dining-room → kitchen
      'e',                 // kitchen → back-door
      'e',                 // back-door → garden
      'wait',
      'n',                 // garden → well
      'd',                 // well → well-shaft
      'hold dog',
    ])

    expect(state.flags['garden-procession.resolved']).toBe(true)
    expect(state.flags['child-beneath-well.resolved']).toBe(true)
    expect(state.flags['gardenQuiet']).toBe(true)
    expect(state.flags['childPassedWell']).toBe(true)
    expect(state.location).toBe('well-shaft')
  })

  it('plays through the lower-passages slice', () => {
    const state = play([
      'n',                 // gate → foyer
      'n',                 // foyer → hallway
      'n',                 // hallway → dining-room
      'close curtains',
      'n',                 // dining-room → conservatory
      'take shears',
      'cut vines with shears',
      's',                 // conservatory → dining-room
      'w',                 // dining-room → hallway
      'd',                 // hallway → music-room
      'play note',
      'n',                 // music-room → servants-passage
      'wait',
      'e',                 // servants-passage → laundry
      'wait',
      'take damp sheet',
      'w',                 // laundry → servants-passage
      's',                 // servants-passage → music-room
      'u',                 // music-room → hallway
      'n',                 // hallway → dining-room
      'e',                 // dining-room → kitchen
      'e',                 // kitchen → back-door
      'e',                 // back-door → garden
      'wait',
      'n',                 // garden → well
      'd',                 // well → well-shaft
      'wait',
      'd',                 // well-shaft → tunnel
      'n',                 // tunnel → ossuary
      'take ring',
      'leave ring',
      'e',                 // ossuary → flooded-passage
      'use water with sheet',
      'take boat',
      'n',                 // flooded-passage → root-chamber
      'listen',
      'e',                 // root-chamber → burial-gallery
      'examine portraits',
      'take register',
      'read register',
      'e',                 // burial-gallery → antechamber
      'e',                 // antechamber → vault
    ])

    expect(state.flags['bone-keeper.resolved']).toBe(true)
    expect(state.flags['reflection.resolved']).toBe(true)
    expect(state.flags['root-movement.resolved']).toBe(true)
    expect(state.flags['portrait-woman.resolved']).toBe(true)
    expect(state.flags['burialRingPlaced']).toBe(true)
    expect(state.flags['reflectionObscured']).toBe(true)
    expect(state.flags['rootsListenedTo']).toBe(true)
    expect(state.flags['familyResemblanceSeen']).toBe(true)
    expect(state.location).toBe('vault')
    expect(state.inventory.map((i) => i.id)).toEqual(expect.arrayContaining([
      'damp-sheet',
      'toy-boat',
      'family-register',
    ]))
  })

  it('plays through the conditional rain-room branch', () => {
    const state = play([
      'n',                 // gate → foyer
      'n',                 // foyer → hallway
      'u',                 // hallway → parlor
      'u',                 // parlor → upper stair
      'wait',
      'd',                 // upper stair → parlor
      's',                 // parlor → wrong hallway
      'wait',
      'n',                 // wrong hallway → rain room
      'look basin',
    ])

    expect(state.flags['distant-steps.resolved']).toBe(true)
    expect(state.flags['rainwater-basin.resolved']).toBe(true)
    expect(state.flags['rainRoomEntered']).toBe(true)
    expect(state.endedWith).toBe('replacement')
  })

  it('reaches the expanded true ending through the vault choice', () => {
    const state = play([
      'n',                 // gate → foyer
      'n',                 // foyer → hallway
      'n',                 // hallway → dining-room
      'close curtains',
      'n',                 // dining-room → conservatory
      'take shears',
      'cut vines with shears',
      's',                 // conservatory → dining-room
      'w',                 // dining-room → hallway
      'd',                 // hallway → music-room
      'play note',
      'n',                 // music-room → servants-passage
      'wait',
      'e',                 // servants-passage → laundry
      'wait',
      'take damp sheet',
      'w',                 // laundry → servants-passage
      's',                 // servants-passage → music-room
      'u',                 // music-room → hallway
      'n',                 // hallway → dining-room
      'e',                 // dining-room → kitchen
      'e',                 // kitchen → back-door
      'e',                 // back-door → garden
      'wait',
      'n',                 // garden → well
      'd',                 // well → well-shaft
      'wait',
      'd',                 // well-shaft → tunnel
      'n',                 // tunnel → ossuary
      'take ring',
      'leave ring',
      'e',                 // ossuary → flooded-passage
      'use water with sheet',
      'n',                 // flooded-passage → root-chamber
      'listen',
      'e',                 // root-chamber → burial-gallery
      'examine portraits',
      'take register',
      'e',                 // burial-gallery → antechamber
      'e',                 // antechamber → vault
      'n',                 // vault → chapel
      'take vial',
      'pour vial on basilisk',
      's',                 // chapel → vault
      'read register',
    ])

    expect(state.flags['basiliskSpared']).toBe(true)
    expect(state.flags['nameSpoken']).toBe(true)
    expect(state.endedWith).toBe('true')
  })

  it('passes out after wandering the drunk rooms too long', () => {
    const state = play([
      'n',                 // gate → foyer
      'n',                 // foyer → hallway
      'n',                 // hallway → dining-room
      'e',                 // dining-room → kitchen
      'take whiskey',
      'drink whiskey',
      'e', 'w', 'e', 'w', 'e',
      'w', 'e', 'w', 'e', 'w',
      'e', 'w', 'e', 'w', 'e',
      'w', 'e', 'w', 'e', 'w',
    ])

    expect(state.location).toBe('foyer')
    expect(state.flags['drunk']).toBe(false)
    expect(state.flags['drunkMoves']).toBe(0)
    expect(getItemsInRoom(state, world, 'kitchen')).toContain('whiskey')
  })

  it('finds the faceless man in the drunk rooms and wakes in the foyer', () => {
    const state = play([
      'n',                 // gate → foyer
      'n',                 // foyer → hallway
      'n',                 // hallway → dining-room
      'e',                 // dining-room → kitchen
      'take whiskey',
      'drink whiskey',
      'u',                 // drunk hall → drunk landing
      'listen',
    ])

    expect(state.location).toBe('foyer')
    expect(state.flags['facelessManMet']).toBe(true)
    expect(state.flags['houseDebtNamed']).toBe(true)
    expect(state.flags['drunk']).toBe(false)
  })
})
