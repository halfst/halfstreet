import { describe, it, expect } from 'vitest'
import { roomFrontmatterSchema, itemFrontmatterSchema, endingFrontmatterSchema, encounterFrontmatterSchema } from './schema'

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

  it('rejects unknown ending id', () => {
    const data = { id: 'mercy', whenFlags: {} }
    expect(() => endingFrontmatterSchema.parse(data)).toThrow()
  })
})

describe('encounterFrontmatterSchema', () => {
  it('accepts an encounter narration doc', () => {
    const data = { id: 'rat', startsIn: 'cellar-stair', initialPhase: 'lurking' }
    expect(() => encounterFrontmatterSchema.parse(data)).not.toThrow()
  })
})
