import { DEFAULT_WORLD_MESSAGES, type DeclarativeAction, type LightMechanicMessageKey, type World, type WorldMessageKey } from '../world/types'
import type { GameState, ParsedCommand, DispatchResult, ItemInstance, TranscriptLine, ResolveLevel } from './types'
import { SCHEMA_VERSION, TRANSCRIPT_CAP, RESOLVE_LEVELS } from './types'
import { applyVerbToEncounter, maybeTriggerEncounter } from './encounters'

type ActiveLightMechanic = NonNullable<NonNullable<World['mechanics']>['light']>
type ActiveResolveMechanic = NonNullable<NonNullable<World['mechanics']>['resolve']>

const DEFAULT_LIGHT_MECHANIC: ActiveLightMechanic = {
  enabled: true,
  handler: 'light',
  maxTurns: 6,
  burnOn: ['move', 'wait'],
  stateKeys: { lit: 'lit', burn: 'burn' },
  ui: { meter: true, icon: 'candle' },
  messages: {},
}
const DEFAULT_RESOLVE_MECHANIC: ActiveResolveMechanic = {
  enabled: true,
  handler: 'resolve',
  ladder: RESOLVE_LEVELS,
  wrongVerbCost: 1,
  safeRooms: { recoverySteps: 1 },
  failure: { retreatAt: 'returning', afterRetreat: 'shaken' },
}
const DEFAULT_DRUNK_ACTION: DeclarativeAction = {
  id: 'drink-whiskey',
  verbs: ['drink'],
  handler: 'drunk-transition',
  requires: { allHeld: ['whiskey'] },
  consumes: { inventory: ['whiskey'] },
  drunkTransition: {
    destinationRoom: 'drunk-hall',
    maxMoves: 20,
    wakeRoom: 'foyer',
    resetRoom: 'kitchen',
  },
  messages: {
    success: 'You drink from the bottle. It tastes of smoke, sugar, and rainwater left too long in a pipe.',
    secretFoundPassOut: 'The faceless man steps backward into the dark. The floor rises under you, or you fall toward it.',
    tooManyMovesPassOut: 'The rooms keep turning until they become one room. Then even that room is gone.',
    reset: 'The bottle is not with you. Somewhere in the kitchen, it is half full again.',
  },
}

export interface LightStatus {
  itemId: string
  lit: boolean
  turnsLeft: number
  maxTurns: number
}

function message(world: World, key: WorldMessageKey): string {
  return world.messages?.[key] ?? DEFAULT_WORLD_MESSAGES[key]
}

function lightMechanic(world: World): ActiveLightMechanic {
  return world.mechanics?.light ?? DEFAULT_LIGHT_MECHANIC
}

function resolveMechanic(world: World): ActiveResolveMechanic {
  return world.mechanics?.resolve ?? DEFAULT_RESOLVE_MECHANIC
}

function drunkAction(world: World): DeclarativeAction {
  return Object.values(world.actions ?? {}).find((action) => action.handler === 'drunk-transition') ?? DEFAULT_DRUNK_ACTION
}

function recoverResolve(level: ResolveLevel, world: World): ResolveLevel {
  const mechanic = resolveMechanic(world)
  if (!mechanic.enabled || mechanic.safeRooms.recoverySteps === 0) return level
  const idx = mechanic.ladder.indexOf(level)
  if (idx <= 0) return level
  return mechanic.ladder[Math.max(0, idx - mechanic.safeRooms.recoverySteps)] ?? level
}

function lightMessage(world: World, key: LightMechanicMessageKey, fallback: WorldMessageKey): string {
  const mechanic = lightMechanic(world)
  return mechanic?.messages?.[key] ?? message(world, fallback)
}

export function initialStateFor(world: World): GameState {
  const startingRoom = world.rooms[world.startingRoom]
  if (!startingRoom) throw new Error(`World has invalid startingRoom: ${world.startingRoom}`)

  const inventory: ItemInstance[] = world.startingInventory.map((id) => {
    const item = world.items[id]
    if (!item) throw new Error(`Starting inventory references unknown item: ${id}`)
    return { id, state: { ...item.initialState } }
  })

  const opening: TranscriptLine[] = [
    ...(world.game?.openingArt ? [{ kind: 'system' as const, text: world.game.openingArt }] : []),
    { kind: 'system', text: startingRoom.title },
    { kind: 'narration', text: startingRoom.descriptions.firstVisit },
  ]

  return {
    schemaVersion: SCHEMA_VERSION,
    transcriptCap: world.game?.transcriptCap,
    location: world.startingRoom,
    inventory,
    roomState: { [world.startingRoom]: { visited: true } },
    flags: {},
    resolveLevel: 'steady',
    encounterState: {},
    lastNoun: null,
    pendingDisambiguation: null,
    pendingConfirmation: null,
    transcript: opening,
    endedWith: null,
  }
}

export function getLightStatus(state: GameState, world: World): LightStatus | null {
  const mechanic = lightMechanic(world)
  if (!mechanic?.enabled || mechanic.ui?.meter === false) return null

  let fallback: LightStatus | null = null
  for (const inst of state.inventory) {
    const def = world.items[inst.id]
    if (!def?.lightable) continue
    const lit = inst.state[mechanic.stateKeys.lit] === true
    const turnsLeft = lit ? getLightTurnsLeft(inst, world) : 0
    const status = {
      itemId: inst.id,
      lit,
      turnsLeft,
      maxTurns: mechanic.maxTurns,
    }
    if (lit) return status
    fallback = fallback ?? status
  }
  return fallback
}

function append(state: GameState, lines: TranscriptLine[]): GameState {
  const transcript = [...state.transcript, ...lines]
  const cap = state.transcriptCap ?? TRANSCRIPT_CAP
  return { ...state, transcript: transcript.slice(-cap) }
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

function evaluateEndings(state: GameState, world: World): GameState | null {
  if (state.endedWith) return null
  const priority = world.endingPriority ?? Object.keys(world.endings)
  for (const id of priority) {
    const ending = world.endings[id]
    if (!ending) continue
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
  result = maybeResolveDrunkState(result, world)
  const updated = evaluateEndings(result.state, world)
  if (!updated) return result
  const endingLine: TranscriptLine = updated.transcript[updated.transcript.length - 1]!
  return { state: updated, appended: [...result.appended, endingLine] }
}

const CRITICAL_VERBS = new Set(['attack'])

function isCriticalCommand(command: ParsedCommand): boolean {
  if (command.kind !== 'verb-target' && command.kind !== 'verb-target-prep') return false
  return CRITICAL_VERBS.has(command.verb)
}

function confirmationPrompt(command: ParsedCommand): string {
  if (command.kind === 'verb-target') {
    return `Are you sure you want to ${command.verb} ${command.target.raw}? Type yes to continue, or no to stop.`
  }
  if (command.kind === 'verb-target-prep') {
    return `Are you sure you want to ${command.verb} ${command.target.raw} ${command.preposition} ${command.indirect.raw}? Type yes to continue, or no to stop.`
  }
  return 'Are you sure? Type yes to continue, or no to stop.'
}

export function dispatch(state: GameState, command: ParsedCommand, world: World, confirmed = false): DispatchResult {
  if (command.kind === 'confirmation') {
    const pending = state.pendingConfirmation
    if (!pending) {
      return narrate(state, [{ kind: 'narration', text: message(world, 'nothing-to-confirm') }])
    }
    const cleared: GameState = { ...state, pendingConfirmation: null }
    if (!command.confirmed) {
      return narrate(cleared, [{ kind: 'narration', text: message(world, 'cancelled') }])
    }
    return dispatch(cleared, pending.command, world, true)
  }

  if (state.pendingConfirmation) {
    state = { ...state, pendingConfirmation: null }
  }

  // Once the game has ended, only restart/undo (handled by the UI) can clear state.
  if (state.endedWith) {
    return narrate(state, [{ kind: 'narration', text: world.game?.endedText ?? 'The story has ended. Type `restart` or `undo`.' }])
  }

  if (!confirmed && isCriticalCommand(command)) {
    const prompt = confirmationPrompt(command)
    const next: GameState = { ...state, pendingConfirmation: { command, prompt } }
    return narrate(next, [{ kind: 'narration', text: prompt }])
  }

  // Disambiguation reply: re-issue the original verb with the chosen target.
  if (command.kind === 'disambiguation') {
    const pending = state.pendingDisambiguation
    if (!pending) {
      return narrate(state, [{ kind: 'narration', text: message(world, 'nothing-to-choose') }])
    }
    const cleared: GameState = { ...state, pendingDisambiguation: null }
    return dispatch(
      cleared,
      { kind: 'verb-target', verb: pending.verb, target: { canonical: command.chosen, raw: command.chosen } },
      world,
      confirmed,
    )
  }

  if (command.kind === 'unknown') {
    const text =
      command.reason === 'unknown-verb' ? message(world, 'unknown-verb')
      : command.reason === 'unknown-noun' ? message(world, 'unknown-noun')
      : message(world, 'malformed')
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
    if (command.verb === 'listen') return withEndingCheck(narrate(state, [{ kind: 'narration', text: message(world, 'listen') }]), world)
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
    if (command.verb === 'drink') return withEndingCheck(handleDrink(stateWithNoun, command.target.canonical, world), world)
    if (command.verb === 'light') return withEndingCheck(handleLight(stateWithNoun, command.target.canonical, null, world), world)
    if (command.verb === 'extinguish') return withEndingCheck(handleExtinguish(stateWithNoun, command.target.canonical, world), world)
    if (command.verb === 'use') {
      const target = world.items[command.target.canonical]
      if (target?.lighter && !target.lightable) {
        return withEndingCheck(narrate(stateWithNoun, [{ kind: 'narration', text: message(world, 'use-lighter-with-what') }]), world)
      }
      return withEndingCheck(narrate(stateWithNoun, [{ kind: 'narration', text: message(world, 'use-unknown') }]), world)
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
      const actionResult = handleDeclarativeAction(stateWithNoun, command, world)
      if (actionResult) return withEndingCheck(actionResult, world)
      const lightResult = handleUseAsLight(stateWithNoun, command.target.canonical, command.indirect.canonical, world)
      if (lightResult) return withEndingCheck(lightResult, world)
      return withEndingCheck(narrate(stateWithNoun, [{ kind: 'narration', text: message(world, 'use-unknown') }]), world)
    }
    return withEndingCheck(narrate(stateWithNoun, [{ kind: 'narration', text: `You're not sure how to ${command.verb} that.` }]), world)
  }

  return narrate(state, [{ kind: 'narration', text: message(world, 'nothing-happens') }])
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
  if (!room) return narrate(state, [{ kind: 'narration', text: message(world, 'nowhere') }])

  const dest = room.exits[direction]
  if (!dest) {
    return narrate(state, [{ kind: 'narration', text: message(world, 'no-exit') }])
  }

  const lock = room.lockedExits?.[direction]
  if (lock) {
    const hasKey = state.inventory.some((i) => i.id === lock.requires) || !!state.flags[lock.requires]
    if (!hasKey) {
      return narrate(state, [{ kind: 'narration', text: lock.lockedNarration }])
    }
  }

  const destRoom = world.rooms[dest]
  if (!destRoom) return narrate(state, [{ kind: 'narration', text: message(world, 'unfinished-exit') }])

  const visited = !!state.roomState[dest]?.['visited']
  const description = visited ? destRoom.descriptions.revisit : destRoom.descriptions.firstVisit

  let next: GameState = { ...state, location: dest }
  next = setRoomFlag(next, dest, 'visited', true)

  if (destRoom.safe) {
    next = { ...next, resolveLevel: recoverResolve(state.resolveLevel, world) }
  }

  const lightTick = advanceLightState(next, 'move', world)
  next = lightTick.state

  const arrivalLines: TranscriptLine[] = [
    { kind: 'system', text: destRoom.title },
    { kind: 'narration', text: description },
    ...lightTick.lines,
  ]
  let result = narrate(next, arrivalLines)

  if (state.flags['drunk'] === true && dest.startsWith('drunk-')) {
    const moved = advanceDrunkTurns(result.state, world)
    if (moved.appended.length > 0) return { state: moved.state, appended: [...arrivalLines, ...moved.appended] }
    result = { state: moved.state, appended: arrivalLines }
  }

  // Trigger any encounter waiting in this room.
  const triggered = maybeTriggerEncounter(result.state, world)
  if (triggered) {
    return { state: triggered.state, appended: [...arrivalLines, ...triggered.appended] }
  }
  return result
}

function handleDrink(state: GameState, itemId: string, world: World): DispatchResult {
  const action = drunkAction(world)
  const targetItems = new Set([
    ...(action.requires?.allHeld ?? []),
    ...(action.requires?.allVisibleOrHeld ?? []),
    ...(action.consumes?.inventory ?? []),
  ])
  if (!action.verbs.includes('drink') || !targetItems.has(itemId)) {
    return narrate(state, [{ kind: 'narration', text: message(world, 'cannot-drink') }])
  }
  const requiredHeld = action.requires?.allHeld ?? [...targetItems]
  const held = requiredHeld.every((requiredId) => state.inventory.some((i) => i.id === requiredId))
  if (!held) {
    return narrate(state, [{ kind: 'narration', text: action.messages.missingRequired ?? message(world, 'need-carrying') }])
  }
  const config = action.drunkTransition ?? DEFAULT_DRUNK_ACTION.drunkTransition!
  const consumed = new Set(action.consumes?.inventory ?? [itemId])
  const dest = world.rooms[config.destinationRoom]
  const next: GameState = {
    ...state,
    location: config.destinationRoom,
    inventory: state.inventory.filter((i) => !consumed.has(i.id)),
    flags: { ...state.flags, drunk: true, drunkMoves: 0, drunkSecretFound: false },
  }
  const visited = !!next.roomState[config.destinationRoom]?.['visited']
  const withVisit = setRoomFlag(next, config.destinationRoom, 'visited', true)
  const lines: TranscriptLine[] = [
    { kind: 'narration', text: action.messages.success },
  ]
  if (dest) {
    lines.push(
      { kind: 'system', text: dest.title },
      { kind: 'narration', text: visited ? dest.descriptions.revisit : dest.descriptions.firstVisit },
    )
  }
  return narrate(withVisit, lines)
}

function maybeResolveDrunkState(result: DispatchResult, world: World): DispatchResult {
  if (result.state.flags['drunk'] !== true) return result
  if (result.state.flags['drunkSecretFound'] === true) {
    const action = drunkAction(world)
    const passed = passOutFromDrunk(
      result.state,
      world,
      action.messages.secretFoundPassOut ?? DEFAULT_DRUNK_ACTION.messages.secretFoundPassOut!,
    )
    return { state: passed.state, appended: [...result.appended, ...passed.appended] }
  }
  return result
}

function advanceDrunkTurns(state: GameState, world: World): DispatchResult {
  const action = drunkAction(world)
  const config = action.drunkTransition ?? DEFAULT_DRUNK_ACTION.drunkTransition!
  const current = typeof state.flags['drunkMoves'] === 'number' ? state.flags['drunkMoves'] : 0
  const moves = current + 1
  const next = { ...state, flags: { ...state.flags, drunkMoves: moves } }
  if (moves < config.maxMoves) return { state: next, appended: [] }
  return passOutFromDrunk(
    next,
    world,
    action.messages.tooManyMovesPassOut ?? DEFAULT_DRUNK_ACTION.messages.tooManyMovesPassOut!,
  )
}

function passOutFromDrunk(state: GameState, world: World, preface: string): DispatchResult {
  const action = drunkAction(world)
  const config = action.drunkTransition ?? DEFAULT_DRUNK_ACTION.drunkTransition!
  const resetItem = action.consumes?.inventory?.[0] ?? 'whiskey'
  const wakeRoom = world.rooms[config.wakeRoom]
  const resetRoomState = state.roomState[config.resetRoom] ?? {}
  const resetTaken = ((resetRoomState['takenItems'] ?? []) as string[]).filter((id) => id !== resetItem)
  const resetDropped = ((resetRoomState['droppedItems'] ?? []) as string[]).filter((id) => id !== resetItem)
  const next: GameState = {
    ...state,
    location: config.wakeRoom,
    inventory: state.inventory.filter((i) => i.id !== resetItem),
    flags: { ...state.flags, drunk: false, drunkMoves: 0, drunkSecretFound: false },
    roomState: {
      ...state.roomState,
      [config.resetRoom]: {
        ...resetRoomState,
        takenItems: resetTaken,
        droppedItems: resetDropped,
      },
      [config.wakeRoom]: { ...(state.roomState[config.wakeRoom] ?? {}), visited: true },
    },
  }
  const lines: TranscriptLine[] = [
    { kind: 'narration', text: preface },
    { kind: 'system', text: wakeRoom?.title ?? `[ ${config.wakeRoom} ]` },
    { kind: 'narration', text: wakeRoom?.descriptions.revisit ?? `You wake in ${config.wakeRoom}.` },
    { kind: 'narration', text: action.messages.reset ?? DEFAULT_DRUNK_ACTION.messages.reset! },
  ]
  return narrate(next, lines)
}

function handleWait(state: GameState, world: World): DispatchResult {
  const lightTick = advanceLightState(state, 'wait', world)
  return narrate(lightTick.state, [
    { kind: 'narration', text: message(world, 'time-passes') },
    ...lightTick.lines,
  ])
}

function handleLook(state: GameState, world: World): DispatchResult {
  const room = world.rooms[state.location]
  if (!room) return narrate(state, [{ kind: 'narration', text: message(world, 'see-nothing') }])
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
    return narrate(state, [{ kind: 'narration', text: message(world, 'inventory-empty') }])
  }
  const lines = state.inventory.map((inst) => {
    const item = world.items[inst.id]
    const mechanic = lightMechanic(world)
    const litSuffix = mechanic?.enabled && inst.state[mechanic.stateKeys.lit] === true ? ' (lit)' : ''
    return `  ${item?.short ?? inst.id}${litSuffix}`
  })
  return narrate(state, [
    { kind: 'narration', text: message(world, 'inventory-heading') },
    { kind: 'narration', text: lines.join('\n') },
  ])
}

function handleTake(state: GameState, itemId: string, world: World): DispatchResult {
  const item = world.items[itemId]
  if (!item) return narrate(state, [{ kind: 'narration', text: message(world, 'dont-see-here') }])
  if (!item.takeable) return narrate(state, [{ kind: 'narration', text: message(world, 'cannot-take') }])

  const itemsHere = getItemsInRoom(state, world, state.location)
  if (!itemsHere.includes(itemId)) {
    return narrate(state, [{ kind: 'narration', text: message(world, 'dont-see-here') }])
  }
  if (state.inventory.find((i) => i.id === itemId)) {
    return narrate(state, [{ kind: 'narration', text: message(world, 'already-have') }])
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
  return narrate(next, [{ kind: 'narration', text: message(world, 'taken') }])
}

function handleDrop(state: GameState, itemId: string, world: World): DispatchResult {
  if (!state.inventory.find((i) => i.id === itemId)) {
    return narrate(state, [{ kind: 'narration', text: message(world, 'dont-have') }])
  }
  const itemDef = world.items[itemId]
  const itemInst = state.inventory.find((i) => i.id === itemId) ?? null
  const mechanic = lightMechanic(world)
  if (mechanic?.enabled && itemDef?.lightable && itemInst?.state[mechanic.stateKeys.lit] === true) {
    return narrate(state, [{ kind: 'narration', text: lightMessage(world, 'dropLit', 'drop-lit') }])
  }
  let next: GameState = {
    ...state,
    inventory: state.inventory.filter((i) => i.id !== itemId),
  }
  const dropped = (next.roomState[state.location]?.['droppedItems'] ?? []) as string[]
  next = setRoomFlag(next, state.location, 'droppedItems', [...dropped, itemId])
  return narrate(next, [{ kind: 'narration', text: message(world, 'dropped') }])
}

function handleExamine(state: GameState, itemId: string, world: World): DispatchResult {
  const item = world.items[itemId]
  if (!item) return narrate(state, [{ kind: 'narration', text: message(world, 'dont-see-anything') }])
  const inventoryInst = state.inventory.find((i) => i.id === itemId) ?? null
  const visible =
    inventoryInst ||
    getItemsInRoom(state, world, state.location).includes(itemId)
  if (!visible) return narrate(state, [{ kind: 'narration', text: message(world, 'dont-see-anything') }])
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
  if (!item) return narrate(state, [{ kind: 'narration', text: message(world, 'dont-see-anything') }])
  const visible =
    state.inventory.find((i) => i.id === itemId) ||
    getItemsInRoom(state, world, state.location).includes(itemId)
  if (!visible) return narrate(state, [{ kind: 'narration', text: message(world, 'dont-see-anything') }])
  if (!item.readable || !item.readableText) {
    return narrate(state, [{ kind: 'narration', text: message(world, 'nothing-to-read') }])
  }
  return narrate(state, [{ kind: 'narration', text: item.readableText }])
}

function handleLight(state: GameState, targetId: string, instrumentId: string | null, world: World): DispatchResult {
  const mechanic = lightMechanic(world)
  if (!mechanic?.enabled) return narrate(state, [{ kind: 'narration', text: message(world, 'nothing-happens') }])

  const target = world.items[targetId]
  if (!target) return narrate(state, [{ kind: 'narration', text: message(world, 'dont-see-anything') }])
  if (target.lighter && !target.lightable) return narrate(state, [{ kind: 'narration', text: lightMessage(world, 'useLighterWithWhat', 'use-lighter-with-what') }])
  if (!target.lightable) return narrate(state, [{ kind: 'narration', text: lightMessage(world, 'cannotLight', 'cannot-light') }])
  const targetInst = state.inventory.find((i) => i.id === targetId) ?? null
  const visibleInRoom = getItemsInRoom(state, world, state.location).includes(targetId)
  if (!targetInst && !visibleInRoom) {
    return narrate(state, [{ kind: 'narration', text: message(world, 'dont-see-anything') }])
  }
  // The 'lit' state lives on the inventory instance for inventory items, or
  // (eventually) on roomState for items left in a room. For now we only
  // support lighting items the player is carrying.
  if (!targetInst) {
    return narrate(state, [{ kind: 'narration', text: message(world, 'need-carrying') }])
  }
  if (targetInst.state[mechanic.stateKeys.lit] === true) {
    return narrate(state, [{ kind: 'narration', text: lightMessage(world, 'alreadyLit', 'already-lit') }])
  }

  // Pick an instrument. If explicit, validate it; if implicit, find any.
  let lighterInst = null as typeof state.inventory[number] | null
  if (instrumentId) {
    lighterInst = state.inventory.find((i) => i.id === instrumentId) ?? null
    if (!lighterInst) return narrate(state, [{ kind: 'narration', text: message(world, 'dont-have') }])
    const lighterDef = world.items[instrumentId]
    if (!lighterDef?.lighter) return narrate(state, [{ kind: 'narration', text: lightMessage(world, 'notHelpful', 'not-helpful') }])
    if (typeof lighterInst.state['uses'] === 'number' && lighterInst.state['uses'] <= 0) {
      return narrate(state, [{ kind: 'narration', text: lightMessage(world, 'spent', 'spent') }])
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
      return narrate(state, [{ kind: 'narration', text: lightMessage(world, 'noLighter', 'no-lighter') }])
    }
  }

  // Apply state changes immutably.
  const lighterDef = world.items[lighterInst.id]!
  const lighterUsesField = typeof lighterInst.state['uses'] === 'number' ? lighterInst.state['uses'] : null
  const newLighterUses = lighterUsesField === null ? null : lighterUsesField - 1
  const newInventory = state.inventory.map((i) => {
    if (i.id === targetInst.id) return { ...i, state: { ...i.state, [mechanic.stateKeys.lit]: true, [mechanic.stateKeys.burn]: mechanic.maxTurns } }
    if (i.id === lighterInst!.id && newLighterUses !== null) return { ...i, state: { ...i.state, uses: newLighterUses } }
    return i
  })
  const lines: TranscriptLine[] = [{ kind: 'narration', text: target.litText ?? lightMessage(world, 'flameCatches', 'flame-catches') }]
  if (newLighterUses === 0) {
    lines.push({ kind: 'narration', text: lighterDef.lighterEmptyText ?? lightMessage(world, 'spent', 'spent') })
  }
  return narrate({ ...state, inventory: newInventory }, lines)
}

function handleDeclarativeAction(
  state: GameState,
  command: Extract<ParsedCommand, { kind: 'verb-target-prep' }>,
  world: World,
): DispatchResult | null {
  const action = findDeclarativeAction(command, world)
  if (!action) return null

  for (const itemId of action.requires?.allVisibleOrHeld ?? []) {
    if (!isVisibleOrHeld(state, world, itemId)) {
      return narrate(state, [{ kind: 'narration', text: action.messages.missingRequired ?? message(world, 'dont-see-anything') }])
    }
  }
  for (const itemId of action.requires?.allHeld ?? []) {
    if (!state.inventory.some((i) => i.id === itemId)) {
      return narrate(state, [{ kind: 'narration', text: action.messages.missingRequired ?? message(world, 'dont-have') }])
    }
  }

  const decrement = action.decrements
  const decremented = decrement ? state.inventory.find((i) => i.id === decrement.item) : null
  if (decrement && !decremented) {
    return narrate(state, [{ kind: 'narration', text: action.messages.missingRequired ?? message(world, 'dont-have') }])
  }
  const decrementStateValue = decrement ? decremented?.state[decrement.stateKey] : null
  const decrementedValue: number | null = typeof decrementStateValue === 'number' ? decrementStateValue : null
  if (decrementedValue !== null && decrementedValue <= 0) {
    return narrate(state, [{ kind: 'narration', text: action.messages.spent ?? message(world, 'spent') }])
  }

  const consumed = new Set(action.consumes?.inventory ?? [])
  let next: GameState = {
    ...state,
    inventory: state.inventory
      .filter((i) => !consumed.has(i.id))
      .map((i) =>
        decrement && i.id === decrement.item && decrementedValue !== null
          ? { ...i, state: { ...i.state, [decrement.stateKey]: decrementedValue - 1 } }
          : i,
      ),
    flags: { ...state.flags, ...(action.setsFlags ?? {}) },
  }

  for (const itemId of consumed) {
    next = removeVisibleRoomItem(next, world, itemId)
  }

  const lines: TranscriptLine[] = [{ kind: 'narration', text: action.messages.success }]
  if (decrementedValue === 1 && action.messages.spent) {
    lines.push({ kind: 'narration', text: action.messages.spent })
  }
  return narrate(next, lines)
}

function findDeclarativeAction(
  command: Extract<ParsedCommand, { kind: 'verb-target-prep' }>,
  world: World,
): DeclarativeAction | null {
  const commandItems = new Set([command.target.canonical, command.indirect.canonical])
  for (const action of Object.values(world.actions ?? {})) {
    if (!action.verbs.includes(command.verb)) continue
    const required = [...(action.requires?.allVisibleOrHeld ?? []), ...(action.requires?.allHeld ?? [])]
    if (required.length > 0 && required.every((itemId) => commandItems.has(itemId))) return action
  }
  return null
}

function isVisibleOrHeld(state: GameState, world: World, itemId: string): boolean {
  return state.inventory.some((i) => i.id === itemId) || getItemsInRoom(state, world, state.location).includes(itemId)
}

function removeVisibleRoomItem(state: GameState, world: World, itemId: string): GameState {
  if (!getItemsInRoom(state, world, state.location).includes(itemId)) return state
  const baseItems = world.rooms[state.location]?.items ?? []
  let next = state
  if (baseItems.includes(itemId)) {
    const taken = (next.roomState[state.location]?.['takenItems'] ?? []) as string[]
    next = setRoomFlag(next, state.location, 'takenItems', [...new Set([...taken, itemId])])
  }
  const dropped = (next.roomState[state.location]?.['droppedItems'] ?? []) as string[]
  if (dropped.includes(itemId)) {
    next = setRoomFlag(next, state.location, 'droppedItems', dropped.filter((id) => id !== itemId))
  }
  return next
}

function handleUseAsLight(state: GameState, firstId: string, secondId: string, world: World): DispatchResult | null {
  if (!lightMechanic(world)?.enabled) return null
  const first = world.items[firstId]
  const second = world.items[secondId]
  if (first?.lighter && second?.lightable) return handleLight(state, secondId, firstId, world)
  if (second?.lighter && first?.lightable) return handleLight(state, firstId, secondId, world)
  return null
}

function handleExtinguish(state: GameState, targetId: string, world: World): DispatchResult {
  const mechanic = lightMechanic(world)
  if (!mechanic?.enabled) return narrate(state, [{ kind: 'narration', text: message(world, 'nothing-happens') }])

  const target = world.items[targetId]
  if (!target) return narrate(state, [{ kind: 'narration', text: message(world, 'dont-see-anything') }])
  if (!target.lightable) return narrate(state, [{ kind: 'narration', text: lightMessage(world, 'cannotExtinguish', 'cannot-extinguish') }])
  const targetInst = state.inventory.find((i) => i.id === targetId)
  if (!targetInst) return narrate(state, [{ kind: 'narration', text: message(world, 'need-carrying') }])
  if (targetInst.state[mechanic.stateKeys.lit] !== true) {
    return narrate(state, [{ kind: 'narration', text: lightMessage(world, 'notLit', 'not-lit') }])
  }
  const newInventory = state.inventory.map((i) =>
    i.id === targetId ? { ...i, state: { ...i.state, [mechanic.stateKeys.lit]: false, [mechanic.stateKeys.burn]: 0 } } : i,
  )
  return narrate({ ...state, inventory: newInventory }, [{ kind: 'narration', text: target.extinguishedText ?? lightMessage(world, 'flameDies', 'flame-dies') }])
}

function advanceLightState(state: GameState, trigger: 'move' | 'wait', world: World): { state: GameState; lines: TranscriptLine[] } {
  const mechanic = lightMechanic(world)
  if (!mechanic?.enabled || !mechanic.burnOn.includes(trigger)) return { state, lines: [] }

  let changed = false
  const lines: TranscriptLine[] = []
  const inventory = state.inventory.map((inst) => {
    const def = world.items[inst.id]
    if (!def?.lightable || inst.state[mechanic.stateKeys.lit] !== true) return inst

    const turnsLeft = getLightTurnsLeft(inst, world)
    const nextTurns = Math.max(0, turnsLeft - 1)
    changed = true

    if (nextTurns === 0) {
      lines.push({ kind: 'narration', text: def.extinguishedText ?? lightMessage(world, 'flameDies', 'flame-dies') })
      return { ...inst, state: { ...inst.state, [mechanic.stateKeys.lit]: false, [mechanic.stateKeys.burn]: 0 } }
    }
    return { ...inst, state: { ...inst.state, [mechanic.stateKeys.burn]: nextTurns } }
  })

  return changed ? { state: { ...state, inventory }, lines } : { state, lines }
}

function getLightTurnsLeft(inst: ItemInstance, world: World): number {
  const mechanic = lightMechanic(world)
  const turns = inst.state[mechanic.stateKeys.burn]
  if (typeof turns === 'number') return Math.max(0, turns)
  return inst.state[mechanic.stateKeys.lit] === true ? mechanic.maxTurns : 0
}
