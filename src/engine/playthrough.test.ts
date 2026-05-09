import { describe, it, expect } from 'vitest'
import { parse } from './parser'
import type { ParserContext } from './parser'
import { dispatch, initialStateFor } from './dispatcher'
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
    visibleNouns.push({ id: room.encounter, aliases: [room.encounter] })
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
      'take letter',
      'read letter',  // verb is recognized but encounter takes priority elsewhere; here it's a no-op
      'n',            // foyer → hallway
      'take lamp',
      'e',            // hallway → cellar-stair (triggers rat encounter)
      'attack rat',
    ])
    expect(state.flags['ratGone']).toBe(true)
    expect(state.location).toBe('cellar-stair')
    expect(state.encounterState['rat']).toBeUndefined()
  })

  it('handles invalid moves gracefully', () => {
    const state = play([
      'go up',        // foyer has no up exit
      'n',
      's',
      'flibbertigibbet',  // unknown verb
    ])
    expect(state.location).toBe('foyer')
  })
})
