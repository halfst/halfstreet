import type { World, Room, Item, GameManifest, EncounterDef } from './types'
import {
  parseAction,
  parseGame,
  parseLightMechanic,
  parseMessages,
  parseParser,
  parseUi,
  parseResolveMechanic,
  parseRoom,
  parseItem,
  parseEnding,
  parseEncounterNarration,
  type ParsedEncounterNarration,
} from './loader'

const gameFiles = import.meta.glob<string>('./game.md', {
  eager: true, query: '?raw', import: 'default',
})
const parserFiles = import.meta.glob<string>('./parser.md', {
  eager: true, query: '?raw', import: 'default',
})
const uiFiles = import.meta.glob<string>('./ui.md', {
  eager: true, query: '?raw', import: 'default',
})
const messageFiles = import.meta.glob<string>('./messages.md', {
  eager: true, query: '?raw', import: 'default',
})
const mechanicFiles = import.meta.glob<string>('./mechanics/*.md', {
  eager: true, query: '?raw', import: 'default',
})
const actionFiles = import.meta.glob<string>('./actions/*.md', {
  eager: true, query: '?raw', import: 'default',
})
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

const encounterDocs = Object.entries(encounterFiles).map(([path, raw]) =>
  parseEncounterNarration(raw, path),
)
const markdownEncounters: Record<string, EncounterDef> = {}
for (const doc of encounterDocs) {
  if (!doc.encounter) {
    throw new Error(`encounters/${doc.id}.md is missing phases frontmatter`)
  }
  if (markdownEncounters[doc.id]) throw new Error(`encounters/${doc.id}.md: duplicate markdown encounter id "${doc.id}"`)
  markdownEncounters[doc.id] = doc.encounter
}
const encounters: Record<string, EncounterDef> = markdownEncounters

const gameEntry = Object.entries(gameFiles)[0]
if (!gameEntry) {
  throw new Error('world/game.md is missing')
}
const game = parseGame(gameEntry[1], gameEntry[0])
const parserEntry = Object.entries(parserFiles)[0]
if (!parserEntry) {
  throw new Error('world/parser.md is missing')
}
const parser = parseParser(parserEntry[1], parserEntry[0])
const uiEntry = Object.entries(uiFiles)[0]
const ui = uiEntry ? parseUi(uiEntry[1], uiEntry[0]) : undefined
const messageEntry = Object.entries(messageFiles)[0]
const messages = messageEntry ? parseMessages(messageEntry[1], messageEntry[0]) : undefined
const mechanics: World['mechanics'] = {}
for (const [path, raw] of Object.entries(mechanicFiles)) {
  if (path.endsWith('/light.md')) {
    mechanics.light = parseLightMechanic(raw, path)
  } else if (path.endsWith('/resolve.md')) {
    mechanics.resolve = parseResolveMechanic(raw, path)
  }
}

const actions: NonNullable<World['actions']> = {}
for (const [path, raw] of Object.entries(actionFiles)) {
  const action = parseAction(raw, path)
  if (actions[action.id]) throw new Error(`${path}: duplicate action id "${action.id}"`)
  actions[action.id] = action
}

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
const endings: World['endings'] = {}
const seenEndings = new Set<string>()
for (const [path, raw] of Object.entries(endingFiles)) {
  const { id, ending } = parseEnding(raw, path)
  if (seenEndings.has(id)) throw new Error(`${path}: duplicate ending id "${id}"`)
  endings[id] = ending
  seenEndings.add(id)
}

interface AssembleWorldInput {
  game: GameManifest
  ui?: World['ui']
  parser?: World['parser']
  messages?: World['messages']
  mechanics?: World['mechanics']
  actions?: World['actions']
  rooms: Record<string, Room>
  items: Record<string, Item>
  endings: World['endings']
  encounters: Record<string, EncounterDef>
  encounterDocs: ParsedEncounterNarration[]
}

export function assembleWorld({
  game,
  ui,
  parser,
  messages,
  mechanics,
  actions,
  rooms,
  items,
  endings,
  encounters,
  encounterDocs,
}: AssembleWorldInput): World {
  // Build set of all known flag names from encounter setFlags and ending whenFlags.
  const knownFlags = new Set<string>()
  for (const enc of Object.values(encounters)) {
    if (enc.onResolved?.setFlags) {
      for (const flagName of Object.keys(enc.onResolved.setFlags)) knownFlags.add(flagName)
    }
  }
  for (const action of Object.values(actions ?? {})) {
    if (action.setsFlags) {
      for (const flagName of Object.keys(action.setsFlags)) knownFlags.add(flagName)
    }
  }
  for (const ending of Object.values(endings)) {
    for (const flagName of Object.keys(ending.whenFlags)) knownFlags.add(flagName)
  }

  for (const id of game.endingPriority) {
    if (!endings[id]) {
      throw new Error(`game.md: endingPriority references "${id}" but endings/${id}.md is missing.`)
    }
  }

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
    if (room.lockedExits) {
      for (const [dir, lock] of Object.entries(room.lockedExits)) {
        const isItem = items[lock.requires] !== undefined
        const isFlag = knownFlags.has(lock.requires)
        if (!isItem && !isFlag) {
          const knownItemList = Object.keys(items).join(', ') || '(none)'
          const knownFlagList = [...knownFlags].join(', ') || '(none)'
          throw new Error(
            `rooms/${room.id}.md: exit${dir.toUpperCase()}Requires "${lock.requires}" matches no known item or flag. ` +
            `Known items: ${knownItemList}. Known flags: ${knownFlagList}.`,
          )
        }
      }
    }
  }

  if (!rooms[game.startingRoom]) {
    throw new Error(`game.md: startingRoom references "${game.startingRoom}" but no such room exists.`)
  }
  for (const itemId of game.startingInventory) {
    if (!items[itemId]) {
      throw new Error(`game.md: startingInventory references unknown item "${itemId}"`)
    }
  }

  const actionHandlers = new Map<string, string>()
  for (const action of Object.values(actions ?? {})) {
    if (action.handler) {
      const previous = actionHandlers.get(action.handler)
      if (previous) {
        throw new Error(
          `actions/${action.id}.md: handler "${action.handler}" is already used by actions/${previous}.md. ` +
          'Only one action may own a handler-backed behavior.',
        )
      }
      actionHandlers.set(action.handler, action.id)
    }

    const referencedItems: Array<[string, string]> = [
      ...(action.requires?.allHeld ?? []).map((id): [string, string] => ['requires.allHeld', id]),
      ...(action.requires?.allVisibleOrHeld ?? []).map((id): [string, string] => ['requires.allVisibleOrHeld', id]),
      ...(action.consumes?.inventory ?? []).map((id): [string, string] => ['consumes.inventory', id]),
      ...(action.decrements ? [['decrements.item', action.decrements.item] as [string, string]] : []),
    ]
    for (const [field, itemId] of referencedItems) {
      if (!items[itemId]) {
        throw new Error(`actions/${action.id}.md: ${field} references unknown item "${itemId}"`)
      }
    }
    if (action.handler === 'drunk-transition') {
      const config = action.drunkTransition
      if (!config) {
        throw new Error(`actions/${action.id}.md uses drunk-transition but is missing drunkTransition config`)
      }
      for (const [key, roomId] of Object.entries({
        destinationRoom: config.destinationRoom,
        wakeRoom: config.wakeRoom,
        resetRoom: config.resetRoom,
      })) {
        if (!rooms[roomId]) {
          throw new Error(`actions/${action.id}.md: drunkTransition.${key} references unknown room "${roomId}"`)
        }
      }
    }
  }

  // Validate encounter narration registry: every encounter has a markdown doc.
  for (const enc of Object.values(encounters)) {
    const doc = encounterDocs.find(d => d.id === enc.id)
    if (!doc) {
      throw new Error(`encounters/${enc.id}.md: missing narration markdown for encounter "${enc.id}"`)
    }
  }

  return {
    game,
    ui,
    parser,
    messages,
    mechanics,
    actions,
    startingRoom: game.startingRoom,
    startingInventory: game.startingInventory,
    endingPriority: game.endingPriority,
    rooms,
    items,
    encounters,
    endings,
  }
}

export const world: World = assembleWorld({
  game,
  ui,
  parser,
  messages,
  mechanics,
  actions,
  rooms,
  items,
  encounters,
  endings,
  encounterDocs,
})
