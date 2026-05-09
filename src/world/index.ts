import type { World, Room, Item } from './types'
import {
  parseRoom,
  parseItem,
  parseEnding,
  parseEncounterNarration,
} from './loader'
// Importing loader (above) triggers auto-registration of encounter narrations.
// ESM evaluates dependencies first, so by the time encounters.ts is evaluated below,
// narration() can resolve all keys.
import { encounters } from './encounters'

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

// Re-parse encounter docs here so we can validate startsIn / initialPhase against encounters.ts.
// (The loader already auto-registered narrations from these same files at module init.)
const encounterDocs = Object.entries(encounterFiles).map(([path, raw]) =>
  parseEncounterNarration(raw, path),
)

// Build rooms map.
const rooms: Record<string, Room> = {}
for (const [path, raw] of Object.entries(roomFiles)) {
  const room = parseRoom(raw, path)
  if (rooms[room.id]) throw new Error(`${path}: duplicate room id "${room.id}"`)
  rooms[room.id] = room
}

// Build items map.
const items: Record<string, Item> = {}
for (const [path, raw] of Object.entries(itemFiles)) {
  const item = parseItem(raw, path)
  if (items[item.id]) throw new Error(`${path}: duplicate item id "${item.id}"`)
  items[item.id] = item
}

// Build endings.
const endings: World['endings'] = {
  true: { whenFlags: {}, narration: '' },
  wrong: { whenFlags: {}, narration: '' },
  bad: { whenFlags: {}, narration: '' },
}
for (const [path, raw] of Object.entries(endingFiles)) {
  const { id, ending } = parseEnding(raw, path)
  endings[id] = ending
}

// Cross-reference validation.
for (const room of Object.values(rooms)) {
  for (const [dir, dest] of Object.entries(room.exits)) {
    if (!rooms[dest!]) {
      throw new Error(`rooms/${room.id}.md: exit${dir.toUpperCase()} references "${dest}" but no such room exists.`)
    }
  }
  for (const itemId of room.items) {
    if (!items[itemId]) {
      throw new Error(`rooms/${room.id}.md: items[] references unknown item "${itemId}"`)
    }
  }
  if (room.encounter && !encounters[room.encounter]) {
    throw new Error(`rooms/${room.id}.md: encounter "${room.encounter}" is not defined`)
  }
}

// Validate encounter narration registry: every encounter in TS has a markdown doc.
for (const enc of Object.values(encounters)) {
  const doc = encounterDocs.find(d => d.id === enc.id)
  if (!doc) {
    throw new Error(`encounters/${enc.id}.md: missing narration markdown for encounter "${enc.id}"`)
  }
  if (doc.startsIn !== enc.startsIn) {
    throw new Error(`encounters/${enc.id}.md: startsIn "${doc.startsIn}" does not match encounters.ts "${enc.startsIn}"`)
  }
  if (doc.initialPhase !== enc.initialPhase) {
    throw new Error(`encounters/${enc.id}.md: initialPhase "${doc.initialPhase}" does not match encounters.ts "${enc.initialPhase}"`)
  }
}

export const world: World = {
  startingRoom: 'foyer',
  startingInventory: ['matches'],
  rooms,
  items,
  encounters,
  endings,
}
