import type { World } from '../world/types'
import type { GameState, ParsedCommand, DispatchResult, TranscriptLine, ResolveLevel } from './types'
import { TRANSCRIPT_CAP, RESOLVE_LEVELS } from './types'

function append(state: GameState, lines: TranscriptLine[]): GameState {
  const transcript = [...state.transcript, ...lines]
  return { ...state, transcript: transcript.slice(-TRANSCRIPT_CAP) }
}

function narrate(state: GameState, lines: TranscriptLine[]): DispatchResult {
  return { state: append(state, lines), appended: lines }
}

/** Returns the encounter id active in the current room, or null. */
export function activeEncounterId(state: GameState, world: World): string | null {
  const roomEncounter = world.rooms[state.location]?.encounter
  if (!roomEncounter) return null
  const phase = state.encounterState[roomEncounter]
  if (!phase) return null
  return roomEncounter
}

/** Triggers a fresh encounter when the player enters its starting room. */
export function maybeTriggerEncounter(state: GameState, world: World): DispatchResult | null {
  const roomEncounter = world.rooms[state.location]?.encounter
  if (!roomEncounter) return null
  const def = world.encounters[roomEncounter]
  if (!def) return null
  if (state.encounterState[roomEncounter]) return null  // already active or resolved
  if (state.flags[`${roomEncounter}.resolved`]) return null  // already done

  const next: GameState = {
    ...state,
    encounterState: { ...state.encounterState, [roomEncounter]: def.initialPhase },
  }
  const phase = def.phases[def.initialPhase]
  if (!phase) return null
  return narrate(next, [{ kind: 'narration', text: phase.description }])
}

function bumpResolve(level: ResolveLevel, cost: 0 | 1 | 2 | undefined): ResolveLevel {
  if (!cost) return level
  const idx = RESOLVE_LEVELS.indexOf(level)
  const newIdx = Math.min(RESOLVE_LEVELS.length - 1, idx + cost)
  return RESOLVE_LEVELS[newIdx]!
}

export interface EncounterResolution {
  state: GameState
  lines: TranscriptLine[]
  /** True if the encounter consumed the verb and the dispatcher should not handle it further. */
  consumed: boolean
}

/** Try to apply a verb against the active encounter. Returns null if no encounter is active. */
export function applyVerbToEncounter(
  state: GameState,
  command: ParsedCommand,
  world: World,
): EncounterResolution | null {
  const encId = activeEncounterId(state, world)
  if (!encId) return null
  const def = world.encounters[encId]
  if (!def) return null
  const currentPhase = state.encounterState[encId]!
  const phaseDef = def.phases[currentPhase]
  if (!phaseDef) return null

  // Only verb-target and verb-only commands engage with encounters.
  let verb: string | null = null
  let targetId: string | null = null
  if (command.kind === 'verb-target') {
    verb = command.verb
    targetId = command.target.canonical
  } else if (command.kind === 'verb-only' && command.verb !== 'inventory' && command.verb !== 'wait') {
    verb = command.verb
  } else {
    return null
  }

  // Find a matching transition.
  const transition = phaseDef.transitions.find((t) => {
    if (t.verb !== verb) return false
    if (t.target && t.target !== '*' && t.target !== targetId) return false
    if (t.requires) {
      const inst = state.inventory.find((i) => i.id === t.requires!.item)
      if (!inst) return false
      if (t.requires.state) {
        for (const [k, v] of Object.entries(t.requires.state)) {
          if (inst.state[k] !== v) return false
        }
      }
    }
    return true
  })

  if (!transition) {
    // Wrong verb — apply default narration and resolve cost.
    if (!verb || (targetId !== null && targetId !== encId)) return null  // verb is unrelated to this encounter
    const newResolve = bumpResolve(state.resolveLevel, 1)
    if (state.resolveLevel === 'returning') {
      // Retreat.
      const retreat = def.onFailed
      if (retreat) {
        const next: GameState = { ...state, location: retreat.retreatTo, resolveLevel: 'shaken' }
        const dest = world.rooms[retreat.retreatTo]
        const lines: TranscriptLine[] = [
          { kind: 'narration', text: retreat.narration },
          ...(dest ? [{ kind: 'system' as const, text: dest.title }, { kind: 'narration' as const, text: dest.descriptions.revisit }] : []),
        ]
        return { state: append(next, lines), lines, consumed: true }
      }
    }
    const next: GameState = { ...state, resolveLevel: newResolve }
    const lines: TranscriptLine[] = [
      { kind: 'narration', text: def.defaultWrongVerbNarration ?? 'That has no effect.' },
    ]
    return { state: append(next, lines), lines, consumed: true }
  }

  // Right verb — but if it has a resolve cost and player is already at 'returning', retreat.
  if (transition.resolveCost && transition.resolveCost > 0 && state.resolveLevel === 'returning') {
    const retreat = def.onFailed
    if (retreat) {
      const next: GameState = { ...state, location: retreat.retreatTo, resolveLevel: 'shaken' }
      const dest = world.rooms[retreat.retreatTo]
      const lines: TranscriptLine[] = [
        { kind: 'narration', text: transition.narration },
        { kind: 'narration', text: retreat.narration },
        ...(dest ? [{ kind: 'system' as const, text: dest.title }, { kind: 'narration' as const, text: dest.descriptions.revisit }] : []),
      ]
      return { state: append(next, lines), lines, consumed: true }
    }
  }

  // Right verb — narrate and transition.
  let next: GameState = { ...state }
  if (transition.resolveCost) {
    next = { ...next, resolveLevel: bumpResolve(next.resolveLevel, transition.resolveCost) }
  }

  if (transition.to === 'resolved') {
    const newEncState = { ...next.encounterState }
    delete newEncState[encId]
    let resolvedFlags = { ...next.flags, [`${encId}.resolved`]: true }
    if (def.onResolved?.setFlags) resolvedFlags = { ...resolvedFlags, ...def.onResolved.setFlags }
    next = { ...next, encounterState: newEncState, flags: resolvedFlags }
  } else if (transition.to === 'failed') {
    const retreat = def.onFailed
    if (retreat) {
      const dest = world.rooms[retreat.retreatTo]
      const newEncState = { ...next.encounterState }
      delete newEncState[encId]
      next = { ...next, location: retreat.retreatTo, encounterState: newEncState, resolveLevel: 'shaken' }
      const lines: TranscriptLine[] = [
        { kind: 'narration', text: transition.narration },
        { kind: 'narration', text: retreat.narration },
        ...(dest ? [{ kind: 'system' as const, text: dest.title }, { kind: 'narration' as const, text: dest.descriptions.revisit }] : []),
      ]
      return { state: append(next, lines), lines, consumed: true }
    }
  } else {
    next = { ...next, encounterState: { ...next.encounterState, [encId]: transition.to } }
  }

  const lines: TranscriptLine[] = [{ kind: 'narration', text: transition.narration }]
  return { state: append(next, lines), lines, consumed: true }
}
