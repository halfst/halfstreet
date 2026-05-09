import { describe, it, expect } from 'vitest'
import { parseRoom, parseItem, parseEnding, parseEncounterNarration } from './loader'
import { rooms } from './rooms'
import { items } from './items'
import { encounters } from './encounters'
import { endings } from './story'

const roomFiles = import.meta.glob<string>('./rooms/*.md', {
  eager: true, query: '?raw', import: 'default',
})
const itemFiles = import.meta.glob<string>('./items/*.md', {
  eager: true, query: '?raw', import: 'default',
})
const endingFiles = import.meta.glob<string>('./endings/*.md', {
  eager: true, query: '?raw', import: 'default',
})
const encounterFiles = import.meta.glob<string>('./encounters/*.md', {
  eager: true, query: '?raw', import: 'default',
})

describe('round-trip: rooms', () => {
  it('parses each room file back to the original Room', () => {
    for (const [path, raw] of Object.entries(roomFiles)) {
      const parsed = parseRoom(raw, path)
      const original = rooms[parsed.id]
      expect(original, `room ${parsed.id} missing in source TS`).toBeDefined()
      expect(parsed).toEqual(original)
    }
  })
})

describe('round-trip: items', () => {
  it('parses each item file back to the original Item', () => {
    for (const [path, raw] of Object.entries(itemFiles)) {
      const parsed = parseItem(raw, path)
      const original = items[parsed.id]
      expect(original, `item ${parsed.id} missing in source TS`).toBeDefined()
      expect(parsed).toEqual(original)
    }
  })
})

describe('round-trip: endings', () => {
  it('parses each ending file back to the original ending', () => {
    for (const [path, raw] of Object.entries(endingFiles)) {
      const { id, ending } = parseEnding(raw, path)
      const original = endings[id]
      expect(ending.whenFlags).toEqual(original.whenFlags)
      expect(ending.narration).toEqual(original.narration)
    }
  })
})

describe('round-trip: encounters narration', () => {
  it('captures every inline narration string', () => {
    for (const [path, raw] of Object.entries(encounterFiles)) {
      const doc = parseEncounterNarration(raw, path)
      const original = encounters[doc.id]
      expect(original).toBeDefined()
      for (const [phaseName, phase] of Object.entries(original.phases)) {
        expect(doc.narrations[phaseName], `phase ${phaseName} narration missing`).toBe(phase.description)
      }
      const allNarrations = new Set(Object.values(doc.narrations))
      for (const phase of Object.values(original.phases)) {
        for (const t of phase.transitions) {
          expect(allNarrations.has(t.narration), `transition narration missing: "${t.narration}"`).toBe(true)
        }
      }
    }
  })
})
