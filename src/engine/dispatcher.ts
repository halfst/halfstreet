import type { World } from '../world/types'
import type { GameState, ParsedCommand, DispatchResult, ItemInstance, TranscriptLine } from './types'
import { SCHEMA_VERSION, TRANSCRIPT_CAP } from './types'
import { applyVerbToEncounter, maybeTriggerEncounter } from './encounters'

export const LIGHT_TURNS_MAX = 6

export interface LightStatus {
  itemId: string
  lit: boolean
  turnsLeft: number
  maxTurns: number
}

const HALFSTREET_ASCII = String.raw`
 _   _       _  __     ____  _                 _
| | | | __ _| |/ _|   / ___|| |_ _ __ ___  ___| |_
| |_| |/ _\` | | |_    \___ \| __| '__/ _ \/ _ \ __|
|  _  | (_| | |  _|    ___) | |_| | |  __/  __/ |_
|_| |_|\__,_|_|_|     |____/ \__|_|  \___|\___|\__|
`.trim()

export function initialStateFor(world: World): GameState {
  const startingRoom = world.rooms[world.startingRoom]
  if (!startingRoom) throw new Error(`World has invalid startingRoom: ${world.startingRoom}`)

  const inventory: ItemInstance[] = world.startingInventory.map((id) => {
    const item = world.items[id]
    if (!item) throw new Error(`Starting inventory references unknown item: ${id}`)
    return { id, state: { ...item.initialState } }
  })

  const opening: TranscriptLine[] = [
    { kind: 'system', text: HALFSTREET_ASCII },
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
    endedWith: null,
  }
}

export function getLightStatus(state: GameState, world: World): LightStatus | null {
  let fallback: LightStatus | null = null
  for (const inst of state.inventory) {
    const def = world.items[inst.id]
    if (!def?.lightable) continue
    const lit = inst.state['lit'] === true
    const turnsLeft = lit ? getLightTurnsLeft(inst) : 0
    const status = {
      itemId: inst.id,
      lit,
      turnsLeft,
      maxTurns: LIGHT_TURNS_MAX,
    }
    if (lit) return status
    fallback = fallback ?? status
  }
  return fallback
}

function append(state: GameState, lines: TranscriptLine[]): GameState {
  const transcript = [...state.transcript, ...lines]
  return { ...state, transcript: transcript.slice(-TRANSCRIPT_CAP) }
}

export function getItemsInRoom(state: GameState, world: World, roomId: string): string[] {
  const baseItems = world.rooms[roomId]?.items ?? []
  const dropped = (state.roomState[roomId]?.['droppedItems'] ?? []) as string[]
  const taken = (state.roomState[roomId]?.['takenItems'] ?? []) as string[]
  return [...baseItems.filter((i) => !taken.includes(i)), ...dropped]
}

function setRoomFlag(state: GameState, roomId: string, key: string, value: string | boolean | number | string[]): GameState {
  return {
    ...state,
    roomState: {
      ...state.roomState,
      [roomId]: { ...(state.roomState[roomId] ?? {}), [key]: value },
    },
  }
}

const ENDING_PRIORITY: ('true' | 'wrong' | 'bad')[] = ['true', 'wrong', 'bad']

function evaluateEndings(state: GameState, world: World): GameState | null {
  if (state.endedWith) return null
  for (const id of ENDING_PRIORITY) {
    const ending = world.endings[id]
    const flags = ending.whenFlags
    let allMatch = true
    for (const [k, v] of Object.entries(flags)) {
      if (state.flags[k] !== v) { allMatch = false; break }
    }
    if (!allMatch) continue
    return {
      ...state,
      endedWith: id,
      transcript: [...state.transcript, { kind: 'ending', text: ending.narration }],
    }
  }
  return null
}

function withEndingCheck(result: DispatchResult, world: World): DispatchResult {
  const updated = evaluateEndings(result.state, world)
  if (!updated) return result
  const endingLine: TranscriptLine = updated.transcript[updated.transcript.length - 1]!
  return { state: updated, appended: [...result.appended, endingLine] }
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

  // Once the game has ended, only restart/undo (handled by the UI) can clear state.
  if (state.endedWith) {
    return narrate(state, [{ kind: 'narration', text: 'The story has ended. Type `restart` or `undo`.' }])
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
    return withEndingCheck(handleGo(state, command.direction, world), world)
  }

  if (command.kind === 'ambiguous') {
    const candidateShorts = command.candidates.map((id) => world.items[id]?.short ?? id)
    const list =
      candidateShorts.length === 2
        ? `${candidateShorts[0]}, or ${candidateShorts[1]}`
        : candidateShorts.slice(0, -1).join(', ') + ', or ' + candidateShorts[candidateShorts.length - 1]
    const prompt = `Which ${command.rawNoun} — ${list}?`
    const next: GameState = {
      ...state,
      pendingDisambiguation: { verb: command.verb, candidates: command.candidates, prompt },
    }
    return narrate(next, [{ kind: 'narration', text: prompt }])
  }

  if (command.kind === 'verb-only') {
    const encResult = applyVerbToEncounter(state, command, world)
    if (encResult?.consumed) {
      return withEndingCheck({ state: encResult.state, appended: encResult.lines }, world)
    }
    if (command.verb === 'look') return withEndingCheck(handleLook(state, world), world)
    if (command.verb === 'inventory') return withEndingCheck(handleInventory(state, world), world)
    if (command.verb === 'wait') return withEndingCheck(handleWait(state, world), world)
    if (command.verb === 'listen') return withEndingCheck(narrate(state, [{ kind: 'narration', text: 'You listen. The house listens back.' }]), world)
  }

  if (command.kind === 'verb-target') {
    const stateWithNoun: GameState = { ...state, lastNoun: command.target }
    // Try the active encounter first — it may consume verbs like 'attack', 'hold'.
    const encResult = applyVerbToEncounter(stateWithNoun, command, world)
    if (encResult?.consumed) {
      return withEndingCheck({ state: encResult.state, appended: encResult.lines }, world)
    }
    if (command.verb === 'take') return withEndingCheck(handleTake(stateWithNoun, command.target.canonical, world), world)
    if (command.verb === 'drop') return withEndingCheck(handleDrop(stateWithNoun, command.target.canonical, world), world)
    if (command.verb === 'examine' || command.verb === 'look') return withEndingCheck(handleExamine(stateWithNoun, command.target.canonical, world), world)
    if (command.verb === 'read') return withEndingCheck(handleRead(stateWithNoun, command.target.canonical, world), world)
    if (command.verb === 'light') return withEndingCheck(handleLight(stateWithNoun, command.target.canonical, null, world), world)
    if (command.verb === 'extinguish') return withEndingCheck(handleExtinguish(stateWithNoun, command.target.canonical, world), world)
    if (command.verb === 'use') {
      const target = world.items[command.target.canonical]
      if (target?.lighter && !target.lightable) {
        return withEndingCheck(narrate(stateWithNoun, [{ kind: 'narration', text: 'Use match with what?' }]), world)
      }
      return withEndingCheck(narrate(stateWithNoun, [{ kind: 'narration', text: "You can't think how to use that here." }]), world)
    }
    return withEndingCheck(narrate(stateWithNoun, [{ kind: 'narration', text: `You're not sure how to ${command.verb} that.` }]), world)
  }

  if (command.kind === 'verb-target-prep') {
    const stateWithNoun: GameState = { ...state, lastNoun: command.target }
    // Try the encounter first — it may consume verbs like 'cut vines with shears'.
    const encResult = applyVerbToEncounter(stateWithNoun, command, world)
    if (encResult?.consumed) {
      return withEndingCheck({ state: encResult.state, appended: encResult.lines }, world)
    }
    if (command.verb === 'light' && command.preposition === 'with') {
      return withEndingCheck(handleLight(stateWithNoun, command.target.canonical, command.indirect.canonical, world), world)
    }
    if (command.verb === 'use') {
      const burnResult = handleBurnLetter(stateWithNoun, command.target.canonical, command.indirect.canonical, world)
      if (burnResult) return withEndingCheck(burnResult, world)
      const lightResult = handleUseAsLight(stateWithNoun, command.target.canonical, command.indirect.canonical, world)
      if (lightResult) return withEndingCheck(lightResult, world)
      return withEndingCheck(narrate(stateWithNoun, [{ kind: 'narration', text: "You can't think how to use that here." }]), world)
    }
    return withEndingCheck(narrate(stateWithNoun, [{ kind: 'narration', text: `You're not sure how to ${command.verb} that.` }]), world)
  }

  return narrate(state, [{ kind: 'narration', text: 'Nothing happens.' }])
}

function narrate(state: GameState, lines: TranscriptLine[]): DispatchResult {
  return { state: append(state, lines), appended: lines }
}

function handleMeta(state: GameState, verb: 'restart' | 'undo' | 'hint' | 'save' | 'quit' | 'theme'): DispatchResult {
  if (verb === 'save') return narrate(state, [{ kind: 'system', text: '(your progress is saved automatically)' }])
  // 'theme' is a UI preference: the terminal intercepts it before dispatch and
  // dispatches a 'halfstreet-toggle-theme' DOM event. The engine no-ops here so
  // typing the verb still produces transcript output if the UI ever misses it.
  if (verb === 'theme') return narrate(state, [{ kind: 'system', text: '(theme)' }])
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

  const lightTick = advanceLightState(next, 1, world)
  next = lightTick.state

  const arrivalLines: TranscriptLine[] = [
    { kind: 'system', text: destRoom.title },
    { kind: 'narration', text: description },
    ...lightTick.lines,
  ]
  const result = narrate(next, arrivalLines)

  // Trigger any encounter waiting in this room.
  const triggered = maybeTriggerEncounter(result.state, world)
  if (triggered) {
    return { state: triggered.state, appended: [...arrivalLines, ...triggered.appended] }
  }
  return result
}

function handleWait(state: GameState, world: World): DispatchResult {
  const lightTick = advanceLightState(state, 2, world)
  return narrate(lightTick.state, [
    { kind: 'narration', text: 'Time passes.' },
    ...lightTick.lines,
  ])
}

function handleLook(state: GameState, world: World): DispatchResult {
  const room = world.rooms[state.location]
  if (!room) return narrate(state, [{ kind: 'narration', text: 'You see nothing.' }])
  const items = getItemsInRoom(state, world, state.location)
  const itemNarration = describeRoomItems(items.map((id) => world.items[id]?.short ?? id))
  return narrate(state, [
    { kind: 'system', text: room.title },
    { kind: 'narration', text: room.descriptions.examined },
    ...(itemNarration ? [{ kind: 'narration' as const, text: itemNarration }] : []),
  ])
}

function describeRoomItems(shorts: string[]): string {
  if (shorts.length === 0) return ''
  const names = [sentenceCase(shorts[0]!), ...shorts.slice(1)]
  const verb = names.length === 1 ? 'is' : 'are'
  return `${joinList(names)} ${verb} here.`
}

function sentenceCase(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1)
}

function joinList(values: string[]): string {
  if (values.length === 1) return values[0]!
  if (values.length === 2) return `${values[0]} and ${values[1]}`
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`
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
    const taken = (next.roomState[state.location]?.['takenItems'] ?? []) as string[]
    next = setRoomFlag(next, state.location, 'takenItems', [...taken, itemId])
  } else {
    const dropped = (next.roomState[state.location]?.['droppedItems'] ?? []) as string[]
    next = setRoomFlag(next, state.location, 'droppedItems', dropped.filter((id) => id !== itemId))
  }
  return narrate(next, [{ kind: 'narration', text: 'Taken.' }])
}

function handleDrop(state: GameState, itemId: string, _world: World): DispatchResult {
  if (!state.inventory.find((i) => i.id === itemId)) {
    return narrate(state, [{ kind: 'narration', text: 'You don\'t have that.' }])
  }
  const itemDef = _world.items[itemId]
  const itemInst = state.inventory.find((i) => i.id === itemId) ?? null
  if (itemDef?.lightable && itemInst?.state['lit'] === true) {
    return narrate(state, [{ kind: 'narration', text: "Extinguish it first." }])
  }
  let next: GameState = {
    ...state,
    inventory: state.inventory.filter((i) => i.id !== itemId),
  }
  const dropped = (next.roomState[state.location]?.['droppedItems'] ?? []) as string[]
  next = setRoomFlag(next, state.location, 'droppedItems', [...dropped, itemId])
  return narrate(next, [{ kind: 'narration', text: 'Dropped.' }])
}

function handleExamine(state: GameState, itemId: string, world: World): DispatchResult {
  const item = world.items[itemId]
  if (!item) return narrate(state, [{ kind: 'narration', text: 'You don\'t see anything like that.' }])
  const inventoryInst = state.inventory.find((i) => i.id === itemId) ?? null
  const visible =
    inventoryInst ||
    getItemsInRoom(state, world, state.location).includes(itemId)
  if (!visible) return narrate(state, [{ kind: 'narration', text: 'You don\'t see anything like that.' }])
  return narrate(state, [{ kind: 'narration', text: describeItem(itemId, item.long, inventoryInst) }])
}

function describeItem(itemId: string, longDescription: string, inst: ItemInstance | null): string {
  if (itemId !== 'matches' || typeof inst?.state['uses'] !== 'number') return longDescription
  const uses = inst.state['uses']
  const noun = uses === 1 ? 'match' : 'matches'
  const count = spellSmallCount(uses)
  return longDescription.replace(/with \w+ matches? left inside\./i, `with ${count} ${noun} left inside.`)
}

function spellSmallCount(value: number): string {
  const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
  return words[value] ?? String(value)
}

function handleRead(state: GameState, itemId: string, world: World): DispatchResult {
  const item = world.items[itemId]
  if (!item) return narrate(state, [{ kind: 'narration', text: "You don't see anything like that." }])
  const visible =
    state.inventory.find((i) => i.id === itemId) ||
    getItemsInRoom(state, world, state.location).includes(itemId)
  if (!visible) return narrate(state, [{ kind: 'narration', text: "You don't see anything like that." }])
  if (!item.readable || !item.readableText) {
    return narrate(state, [{ kind: 'narration', text: "There's nothing to read on it." }])
  }
  return narrate(state, [{ kind: 'narration', text: item.readableText }])
}

function handleLight(state: GameState, targetId: string, instrumentId: string | null, world: World): DispatchResult {
  const target = world.items[targetId]
  if (!target) return narrate(state, [{ kind: 'narration', text: "You don't see anything like that." }])
  if (target.lighter && !target.lightable) return narrate(state, [{ kind: 'narration', text: 'Use match with what?' }])
  if (!target.lightable) return narrate(state, [{ kind: 'narration', text: "You can't light that." }])
  const targetInst = state.inventory.find((i) => i.id === targetId) ?? null
  const visibleInRoom = getItemsInRoom(state, world, state.location).includes(targetId)
  if (!targetInst && !visibleInRoom) {
    return narrate(state, [{ kind: 'narration', text: "You don't see anything like that." }])
  }
  // The 'lit' state lives on the inventory instance for inventory items, or
  // (eventually) on roomState for items left in a room. For now we only
  // support lighting items the player is carrying.
  if (!targetInst) {
    return narrate(state, [{ kind: 'narration', text: "You'd have to be carrying it." }])
  }
  if (targetInst.state['lit'] === true) {
    return narrate(state, [{ kind: 'narration', text: "It's already lit." }])
  }

  // Pick an instrument. If explicit, validate it; if implicit, find any.
  let lighterInst = null as typeof state.inventory[number] | null
  if (instrumentId) {
    lighterInst = state.inventory.find((i) => i.id === instrumentId) ?? null
    if (!lighterInst) return narrate(state, [{ kind: 'narration', text: "You don't have that." }])
    const lighterDef = world.items[instrumentId]
    if (!lighterDef?.lighter) return narrate(state, [{ kind: 'narration', text: "That isn't going to help." }])
    if (typeof lighterInst.state['uses'] === 'number' && lighterInst.state['uses'] <= 0) {
      return narrate(state, [{ kind: 'narration', text: "It is spent." }])
    }
  } else {
    for (const inst of state.inventory) {
      const def = world.items[inst.id]
      if (!def?.lighter) continue
      if (typeof inst.state['uses'] === 'number' && inst.state['uses'] <= 0) continue
      lighterInst = inst
      break
    }
    if (!lighterInst) {
      return narrate(state, [{ kind: 'narration', text: 'You have nothing to light it with.' }])
    }
  }

  // Apply state changes immutably.
  const lighterDef = world.items[lighterInst.id]!
  const lighterUsesField = typeof lighterInst.state['uses'] === 'number' ? lighterInst.state['uses'] : null
  const newLighterUses = lighterUsesField === null ? null : lighterUsesField - 1
  const newInventory = state.inventory.map((i) => {
    if (i.id === targetInst.id) return { ...i, state: { ...i.state, lit: true, burn: LIGHT_TURNS_MAX } }
    if (i.id === lighterInst!.id && newLighterUses !== null) return { ...i, state: { ...i.state, uses: newLighterUses } }
    return i
  })
  const lines: TranscriptLine[] = [{ kind: 'narration', text: target.litText ?? 'It catches.' }]
  if (newLighterUses === 0) {
    lines.push({ kind: 'narration', text: lighterDef.lighterEmptyText ?? 'It is spent.' })
  }
  return narrate({ ...state, inventory: newInventory }, lines)
}

function handleBurnLetter(state: GameState, firstId: string, secondId: string, world: World): DispatchResult | null {
  const ids = [firstId, secondId]
  if (!ids.includes('letter') || !ids.includes('matches')) return null

  const matches = state.inventory.find((i) => i.id === 'matches')
  if (!matches) return narrate(state, [{ kind: 'narration', text: "You don't have a match." }])
  if (typeof matches.state['uses'] === 'number' && matches.state['uses'] <= 0) {
    return narrate(state, [{ kind: 'narration', text: 'The matchbook is empty.' }])
  }

  const letterHeld = state.inventory.some((i) => i.id === 'letter')
  const letterInRoom = getItemsInRoom(state, world, state.location).includes('letter')
  if (!letterHeld && !letterInRoom) {
    return narrate(state, [{ kind: 'narration', text: "You don't see the letter here." }])
  }

  const newMatchesUses = typeof matches.state['uses'] === 'number' ? matches.state['uses'] - 1 : null
  let next: GameState = {
    ...state,
    inventory: state.inventory
      .filter((i) => i.id !== 'letter')
      .map((i) => i.id === 'matches' && newMatchesUses !== null ? { ...i, state: { ...i.state, uses: newMatchesUses } } : i),
    flags: { ...state.flags, letterBurned: true },
  }

  if (letterInRoom) {
    const baseItems = world.rooms[state.location]?.items ?? []
    const dropped = (next.roomState[state.location]?.['droppedItems'] ?? []) as string[]
    if (baseItems.includes('letter')) {
      const taken = (next.roomState[state.location]?.['takenItems'] ?? []) as string[]
      next = setRoomFlag(next, state.location, 'takenItems', [...new Set([...taken, 'letter'])])
    }
    if (dropped.includes('letter')) {
      next = setRoomFlag(next, state.location, 'droppedItems', dropped.filter((id) => id !== 'letter'))
    }
  }

  const lines: TranscriptLine[] = [
    { kind: 'narration', text: 'The letter catches at one corner. In a few breaths it is ash.' },
  ]
  if (newMatchesUses === 0) {
    lines.push({ kind: 'narration', text: world.items['matches']?.lighterEmptyText ?? 'The matchbook is empty.' })
  }
  return narrate(next, lines)
}

function handleUseAsLight(state: GameState, firstId: string, secondId: string, world: World): DispatchResult | null {
  const first = world.items[firstId]
  const second = world.items[secondId]
  if (first?.lighter && second?.lightable) return handleLight(state, secondId, firstId, world)
  if (second?.lighter && first?.lightable) return handleLight(state, firstId, secondId, world)
  return null
}

function handleExtinguish(state: GameState, targetId: string, world: World): DispatchResult {
  const target = world.items[targetId]
  if (!target) return narrate(state, [{ kind: 'narration', text: "You don't see anything like that." }])
  if (!target.lightable) return narrate(state, [{ kind: 'narration', text: "You can't extinguish that." }])
  const targetInst = state.inventory.find((i) => i.id === targetId)
  if (!targetInst) return narrate(state, [{ kind: 'narration', text: "You'd have to be carrying it." }])
  if (targetInst.state['lit'] !== true) {
    return narrate(state, [{ kind: 'narration', text: "It isn't lit." }])
  }
  const newInventory = state.inventory.map((i) =>
    i.id === targetId ? { ...i, state: { ...i.state, lit: false, burn: 0 } } : i,
  )
  return narrate({ ...state, inventory: newInventory }, [{ kind: 'narration', text: target.extinguishedText ?? 'The flame dies.' }])
}

function advanceLightState(state: GameState, cost: number, world: World): { state: GameState; lines: TranscriptLine[] } {
  if (cost <= 0) return { state, lines: [] }

  let changed = false
  const lines: TranscriptLine[] = []
  const inventory = state.inventory.map((inst) => {
    const def = world.items[inst.id]
    if (!def?.lightable || inst.state['lit'] !== true) return inst

    const turnsLeft = getLightTurnsLeft(inst)
    const nextTurns = Math.max(0, turnsLeft - cost)
    changed = true

    if (nextTurns === 0) {
      lines.push({ kind: 'narration', text: def.extinguishedText ?? 'The flame dies.' })
      return { ...inst, state: { ...inst.state, lit: false, burn: 0 } }
    }
    return { ...inst, state: { ...inst.state, burn: nextTurns } }
  })

  return changed ? { state: { ...state, inventory }, lines } : { state, lines }
}

function getLightTurnsLeft(inst: ItemInstance): number {
  const turns = inst.state['burn']
  if (typeof turns === 'number') return Math.max(0, turns)
  return inst.state['lit'] === true ? LIGHT_TURNS_MAX : 0
}
