import type { World } from '../world/types'
import type { GameState, ParsedCommand, DispatchResult, ItemInstance, TranscriptLine, NounRef } from './types'
import { SCHEMA_VERSION, TRANSCRIPT_CAP } from './types'
import { applyVerbToEncounter, maybeTriggerEncounter } from './encounters'

export function initialStateFor(world: World): GameState {
  const startingRoom = world.rooms[world.startingRoom]
  if (!startingRoom) throw new Error(`World has invalid startingRoom: ${world.startingRoom}`)

  const inventory: ItemInstance[] = world.startingInventory.map((id) => {
    const item = world.items[id]
    if (!item) throw new Error(`Starting inventory references unknown item: ${id}`)
    return { id, state: { ...item.initialState } }
  })

  const opening: TranscriptLine[] = [
    { kind: 'system', text: startingRoom.title },
    { kind: 'narration', text: startingRoom.descriptions.firstVisit },
  ]

  return {
    schemaVersion: SCHEMA_VERSION,
    location: world.startingRoom,
    inventory,
    roomState: { [world.startingRoom]: { visited: true } },
    flags: {},
    resolveLevel: 'steady',
    encounterState: {},
    lastNoun: null,
    pendingDisambiguation: null,
    transcript: opening,
    theme: 'amber',
    endedWith: null,
  }
}

function append(state: GameState, lines: TranscriptLine[]): GameState {
  const transcript = [...state.transcript, ...lines]
  return { ...state, transcript: transcript.slice(-TRANSCRIPT_CAP) }
}

export function getItemsInRoom(state: GameState, world: World, roomId: string): string[] {
  const baseItems = world.rooms[roomId]?.items ?? []
  const dropped = (state.roomState[roomId]?.['droppedItems'] as string[] | undefined) ?? []
  const taken = (state.roomState[roomId]?.['takenItems'] as string[] | undefined) ?? []
  return [...baseItems.filter((i) => !taken.includes(i)), ...dropped]
}

function setRoomFlag(state: GameState, roomId: string, key: string, value: string | boolean | number | string[]): GameState {
  return {
    ...state,
    roomState: {
      ...state.roomState,
      [roomId]: { ...(state.roomState[roomId] ?? {}), [key]: value as string | boolean | number },
    },
  }
}

export function dispatch(state: GameState, command: ParsedCommand, world: World): DispatchResult {
  // Disambiguation reply: re-issue the original verb with the chosen target.
  if (command.kind === 'disambiguation') {
    const pending = state.pendingDisambiguation
    if (!pending) {
      return narrate(state, [{ kind: 'narration', text: 'Nothing to choose between.' }])
    }
    const cleared: GameState = { ...state, pendingDisambiguation: null }
    return dispatch(
      cleared,
      { kind: 'verb-target', verb: pending.verb, target: { canonical: command.chosen, raw: command.chosen } },
      world,
    )
  }

  if (command.kind === 'unknown') {
    const text =
      command.reason === 'unknown-verb' ? 'You consider the words, but they don\'t fit this place.'
      : command.reason === 'unknown-noun' ? 'You don\'t see anything like that here.'
      : 'You hesitate.'
    return narrate(state, [{ kind: 'narration', text }])
  }

  if (command.kind === 'meta') {
    return handleMeta(state, command.verb)
  }

  if (command.kind === 'go') {
    return handleGo(state, command.direction, world)
  }

  if (command.kind === 'verb-only') {
    if (command.verb === 'look') return handleLook(state, world)
    if (command.verb === 'inventory') return handleInventory(state, world)
    if (command.verb === 'wait') return narrate(state, [{ kind: 'narration', text: 'Time passes.' }])
  }

  if (command.kind === 'verb-target') {
    const stateWithNoun: GameState = { ...state, lastNoun: command.target }
    // Try the active encounter first — it may consume verbs like 'attack', 'hold'.
    const encResult = applyVerbToEncounter(stateWithNoun, command, world)
    if (encResult?.consumed) {
      return { state: encResult.state, appended: encResult.lines }
    }
    if (command.verb === 'take') return handleTake(stateWithNoun, command.target.canonical, world)
    if (command.verb === 'drop') return handleDrop(stateWithNoun, command.target.canonical, world)
    if (command.verb === 'examine' || command.verb === 'look') return handleExamine(stateWithNoun, command.target.canonical, world)
    return narrate(stateWithNoun, [{ kind: 'narration', text: `You're not sure how to ${command.verb} that.` }])
  }

  return narrate(state, [{ kind: 'narration', text: 'Nothing happens.' }])
}

function narrate(state: GameState, lines: TranscriptLine[]): DispatchResult {
  return { state: append(state, lines), appended: lines }
}

function handleMeta(state: GameState, verb: 'restart' | 'undo' | 'hint' | 'save' | 'quit' | 'theme'): DispatchResult {
  if (verb === 'save') return narrate(state, [{ kind: 'system', text: '(your progress is saved automatically)' }])
  if (verb === 'theme') {
    const newTheme = state.theme === 'amber' ? 'ansi' : 'amber'
    return narrate({ ...state, theme: newTheme }, [{ kind: 'system', text: `Theme: ${newTheme}.` }])
  }
  // restart / undo / hint / quit are handled by the UI layer (state mutations
  // require coordination with the save layer and route navigation). The
  // engine acknowledges them with a no-op narration; the UI intercepts before
  // calling dispatch for these.
  return narrate(state, [{ kind: 'system', text: `(${verb})` }])
}

function handleGo(state: GameState, direction: 'n' | 's' | 'e' | 'w' | 'u' | 'd', world: World): DispatchResult {
  const room = world.rooms[state.location]
  if (!room) return narrate(state, [{ kind: 'narration', text: 'You are nowhere.' }])

  const dest = room.exits[direction]
  if (!dest) {
    return narrate(state, [{ kind: 'narration', text: 'You can\'t go that way.' }])
  }

  const lock = room.lockedExits?.[direction]
  if (lock) {
    const hasKey = state.inventory.some((i) => i.id === lock.requires) || !!state.flags[lock.requires]
    if (!hasKey) {
      return narrate(state, [{ kind: 'narration', text: lock.lockedNarration }])
    }
  }

  const destRoom = world.rooms[dest]
  if (!destRoom) return narrate(state, [{ kind: 'narration', text: 'The way ahead is unfinished.' }])

  const visited = !!state.roomState[dest]?.['visited']
  const description = visited ? destRoom.descriptions.revisit : destRoom.descriptions.firstVisit

  let next: GameState = { ...state, location: dest }
  next = setRoomFlag(next, dest, 'visited', true)

  if (destRoom.safe) {
    const ladder = ['steady', 'shaken', 'reeling', 'returning'] as const
    const idx = ladder.indexOf(state.resolveLevel)
    if (idx > 0) next = { ...next, resolveLevel: ladder[idx - 1]! }
  }

  const arrivalLines: TranscriptLine[] = [
    { kind: 'system', text: destRoom.title },
    { kind: 'narration', text: description },
  ]
  const result = narrate(next, arrivalLines)

  // Trigger any encounter waiting in this room.
  const triggered = maybeTriggerEncounter(result.state, world)
  if (triggered) {
    return { state: triggered.state, appended: [...arrivalLines, ...triggered.appended] }
  }
  return result
}

function handleLook(state: GameState, world: World): DispatchResult {
  const room = world.rooms[state.location]
  if (!room) return narrate(state, [{ kind: 'narration', text: 'You see nothing.' }])
  const items = getItemsInRoom(state, world, state.location)
  const itemNarration = items.length > 0 ? `You see here: ${items.map((id) => world.items[id]?.short ?? id).join(', ')}.` : ''
  return narrate(state, [
    { kind: 'system', text: room.title },
    { kind: 'narration', text: room.descriptions.examined },
    ...(itemNarration ? [{ kind: 'narration' as const, text: itemNarration }] : []),
  ])
}

function handleInventory(state: GameState, world: World): DispatchResult {
  if (state.inventory.length === 0) {
    return narrate(state, [{ kind: 'narration', text: 'You are empty-handed.' }])
  }
  const lines = state.inventory.map((inst) => {
    const item = world.items[inst.id]
    const litSuffix = inst.state['lit'] === true ? ' (lit)' : ''
    return `  ${item?.short ?? inst.id}${litSuffix}`
  })
  return narrate(state, [
    { kind: 'narration', text: 'You are carrying:' },
    { kind: 'narration', text: lines.join('\n') },
  ])
}

function handleTake(state: GameState, itemId: string, world: World): DispatchResult {
  const item = world.items[itemId]
  if (!item) return narrate(state, [{ kind: 'narration', text: 'You don\'t see that here.' }])
  if (!item.takeable) return narrate(state, [{ kind: 'narration', text: 'You can\'t take that.' }])

  const itemsHere = getItemsInRoom(state, world, state.location)
  if (!itemsHere.includes(itemId)) {
    return narrate(state, [{ kind: 'narration', text: 'You don\'t see that here.' }])
  }
  if (state.inventory.find((i) => i.id === itemId)) {
    return narrate(state, [{ kind: 'narration', text: 'You already have it.' }])
  }

  const wasInRoomBase = (world.rooms[state.location]?.items ?? []).includes(itemId)
  let next: GameState = {
    ...state,
    inventory: [...state.inventory, { id: itemId, state: { ...item.initialState } }],
  }
  if (wasInRoomBase) {
    const taken = (next.roomState[state.location]?.['takenItems'] as string[] | undefined) ?? []
    next = setRoomFlag(next, state.location, 'takenItems', [...taken, itemId])
  } else {
    const dropped = (next.roomState[state.location]?.['droppedItems'] as string[] | undefined) ?? []
    next = setRoomFlag(next, state.location, 'droppedItems', dropped.filter((id) => id !== itemId))
  }
  return narrate(next, [{ kind: 'narration', text: 'Taken.' }])
}

function handleDrop(state: GameState, itemId: string, world: World): DispatchResult {
  if (!state.inventory.find((i) => i.id === itemId)) {
    return narrate(state, [{ kind: 'narration', text: 'You don\'t have that.' }])
  }
  let next: GameState = {
    ...state,
    inventory: state.inventory.filter((i) => i.id !== itemId),
  }
  const dropped = (next.roomState[state.location]?.['droppedItems'] as string[] | undefined) ?? []
  next = setRoomFlag(next, state.location, 'droppedItems', [...dropped, itemId])
  return narrate(next, [{ kind: 'narration', text: 'Dropped.' }])
}

function handleExamine(state: GameState, itemId: string, world: World): DispatchResult {
  const item = world.items[itemId]
  if (!item) return narrate(state, [{ kind: 'narration', text: 'You don\'t see anything like that.' }])
  const visible =
    state.inventory.find((i) => i.id === itemId) ||
    getItemsInRoom(state, world, state.location).includes(itemId)
  if (!visible) return narrate(state, [{ kind: 'narration', text: 'You don\'t see anything like that.' }])
  return narrate(state, [{ kind: 'narration', text: item.long }])
}
