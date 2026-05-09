import { describe, it, expect } from 'vitest'
import { world } from './index'

describe('assembled world', () => {
  it('contains all three rooms', () => {
    expect(Object.keys(world.rooms).sort()).toEqual(['cellar-stair', 'foyer', 'hallway'])
  })

  it('contains all three items', () => {
    expect(Object.keys(world.items).sort()).toEqual(['lamp', 'letter', 'matches'])
  })

  it('all room exits resolve to known rooms', () => {
    for (const room of Object.values(world.rooms)) {
      for (const dest of Object.values(room.exits)) {
        expect(world.rooms[dest], `${room.id} → ${dest}`).toBeDefined()
      }
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
    expect(world.rooms[world.startingRoom]).toBeDefined()
  })

  it('startingInventory items are known', () => {
    for (const itemId of world.startingInventory) {
      expect(world.items[itemId]).toBeDefined()
    }
  })

  it('endings have non-empty narration where the original did', () => {
    expect(world.endings.true.narration.length).toBeGreaterThan(0)
  })
})
