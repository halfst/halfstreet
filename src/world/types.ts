// World data type definitions. World modules export plain data conforming to
// these shapes; the engine reads but never mutates them.

import type { RoomId, ItemId, EncounterId, Direction, Verb, EncounterPhase } from '../engine/types'

export interface RoomDescriptions {
  /** Shown the first time the player enters this room. */
  firstVisit: string
  /** Shown on subsequent entries. */
  revisit: string
  /** Shown when the player types `look` (richer detail). */
  examined: string
}

export interface Room {
  id: RoomId
  title: string                       // e.g. "[ Foyer ]"
  descriptions: RoomDescriptions
  /** Direction → destination room id. Locked exits are listed in `lockedExits`. */
  exits: Partial<Record<Direction, RoomId>>
  /** Direction → unlock condition (item id or flag name). */
  lockedExits?: Partial<Record<Direction, { requires: ItemId | string; lockedNarration: string }>>
  /** Items that start in this room. Items the player drops are tracked in roomState. */
  items: ItemId[]
  /** Encounter that triggers when this room is entered, or null. */
  encounter?: EncounterId
  /** Optional "safe" flag: entering a safe room regenerates one resolve step. */
  safe?: boolean
}

export interface Item {
  id: ItemId
  /** Canonical name and any aliases for the parser. */
  names: string[]
  /** Short description shown in inventory. */
  short: string
  /** Long description shown when examined. */
  long: string
  /** Initial per-instance state (e.g. `{ lit: false }`). */
  initialState: Record<string, string | boolean | number>
  /** True if the player can pick it up. */
  takeable: boolean
}

export interface EncounterPhaseDef {
  /** Description shown each turn while in this phase. */
  description: string
  transitions: EncounterTransition[]
}

export interface EncounterTransition {
  verb: Verb
  /** Required target noun id, or '*' for any target, or undefined for verb-only. */
  target?: ItemId | EncounterId | '*'
  /** Required item id in inventory (and optional state predicate). */
  requires?: { item: ItemId; state?: Record<string, string | boolean | number> }
  /** Phase to transition to, or 'resolved' / 'failed'. */
  to: EncounterPhase | 'resolved' | 'failed'
  /** Narration on this transition. */
  narration: string
  /** Resolve cost for the player on this transition (0–2). */
  resolveCost?: 0 | 1 | 2
}

export interface EncounterDef {
  id: EncounterId
  startsIn: RoomId
  initialPhase: EncounterPhase
  phases: Record<EncounterPhase, EncounterPhaseDef>
  /** Effects on resolution (set flags, unlock exits). */
  onResolved?: { setFlags?: Record<string, string | boolean | number>; unlockExits?: { room: RoomId; direction: Direction }[] }
  /** What happens at 'failed' (e.g. retreat to previous safe room). */
  onFailed?: { narration: string; retreatTo: RoomId }
  /** Default narration for wrong-verb attempts not matching any transition. */
  defaultWrongVerbNarration?: string
}

export interface World {
  startingRoom: RoomId
  startingInventory: ItemId[]
  rooms: Record<RoomId, Room>
  items: Record<ItemId, Item>
  encounters: Record<EncounterId, EncounterDef>
  /** Story flag definitions and the endings they unlock. */
  endings: {
    true: { whenFlags: Record<string, string | boolean | number>; narration: string }
    wrong: { whenFlags: Record<string, string | boolean | number>; narration: string }
    bad: { whenFlags: Record<string, string | boolean | number>; narration: string }
  }
}
