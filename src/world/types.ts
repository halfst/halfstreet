// World data type definitions. World modules export plain data conforming to
// these shapes; the engine reads but never mutates them.

import type { RoomId, ItemId, EncounterId, Direction, Verb, EncounterPhase, ResolveLevel } from '../engine/types'
import type { ParserVocabulary } from '../engine/parser'

export const DEFAULT_WORLD_MESSAGES = {
  'unknown-verb': "You consider the words, but they don't fit this place.",
  'unknown-noun': "You don't see anything like that here.",
  malformed: 'You hesitate.',
  'nothing-to-confirm': 'Nothing to confirm.',
  cancelled: 'Cancelled.',
  'nothing-to-choose': 'Nothing to choose between.',
  'no-undo': 'There is no further back.',
  'use-lighter-with-what': 'Use match with what?',
  'use-unknown': "You can't think how to use that here.",
  'nothing-happens': 'Nothing happens.',
  nowhere: 'You are nowhere.',
  'no-exit': "You can't go that way.",
  'unfinished-exit': 'The way ahead is unfinished.',
  'cannot-drink': "You can't drink that.",
  'need-carrying': "You'd have to be carrying it.",
  'time-passes': 'Time passes.',
  listen: 'You listen. The house listens back.',
  'see-nothing': 'You see nothing.',
  'inventory-empty': 'You are empty-handed.',
  'inventory-heading': 'You are carrying:',
  'dont-see-here': "You don't see that here.",
  'cannot-take': "You can't take that.",
  'already-have': 'You already have it.',
  taken: 'Taken.',
  'dont-have': "You don't have that.",
  'drop-lit': 'Extinguish it first.',
  dropped: 'Dropped.',
  'dont-see-anything': "You don't see anything like that.",
  'nothing-to-read': "There's nothing to read on it.",
  'cannot-light': "You can't light that.",
  'already-lit': "It's already lit.",
  'not-helpful': "That isn't going to help.",
  spent: 'It is spent.',
  'no-lighter': 'You have nothing to light it with.',
  'cannot-extinguish': "You can't extinguish that.",
  'not-lit': "It isn't lit.",
  'flame-catches': 'It catches.',
  'flame-dies': 'The flame dies.',
} as const

export type WorldMessageKey = keyof typeof DEFAULT_WORLD_MESSAGES
export type WorldMessages = Partial<Record<WorldMessageKey, string>>

export interface GameManifest {
  id: string
  title: string
  description: string
  startingRoom: RoomId
  startingInventory: ItemId[]
  endingPriority: string[]
  transcriptCap?: number
  openingArt?: string
  helpText?: string
  endedText?: string
}

export interface UiConfig {
  pageTitle: string
  description: string
  robots: string
  themeColor: string
  footer: {
    copyright: string
    copyrightHref?: string
    buildLabel: string
    showBuild: boolean
    links: Array<{
      label: string
      href: string
    }>
  }
  features: {
    chips: boolean
    lightMeter: boolean
    typedEffect: boolean
    roomScroll: boolean
  }
}

export type LightBurnTrigger = 'move' | 'wait'
export type LightMechanicMessageKey =
  | 'useLighterWithWhat'
  | 'cannotLight'
  | 'alreadyLit'
  | 'notHelpful'
  | 'spent'
  | 'noLighter'
  | 'cannotExtinguish'
  | 'notLit'
  | 'dropLit'
  | 'flameCatches'
  | 'flameDies'

export interface LightMechanicConfig {
  enabled: boolean
  handler: 'light'
  maxTurns: number
  burnOn: LightBurnTrigger[]
  stateKeys: {
    lit: string
    burn: string
  }
  ui?: {
    meter?: boolean
    icon?: string
  }
  messages?: Partial<Record<LightMechanicMessageKey, string>>
}

export interface ResolveMechanicConfig {
  enabled: boolean
  handler: 'resolve'
  ladder: ResolveLevel[]
  wrongVerbCost: 0 | 1 | 2
  safeRooms: {
    recoverySteps: number
  }
  failure: {
    retreatAt: ResolveLevel
    afterRetreat: ResolveLevel
  }
}

export interface WorldMechanics {
  light?: LightMechanicConfig
  resolve?: ResolveMechanicConfig
}

export interface DeclarativeAction {
  id: string
  verbs: Verb[]
  handler?: 'drunk-transition'
  requires?: {
    allHeld?: ItemId[]
    allVisibleOrHeld?: ItemId[]
  }
  consumes?: {
    inventory?: ItemId[]
  }
  decrements?: {
    item: ItemId
    stateKey: string
  }
  setsFlags?: Record<string, string | boolean | number | string[]>
  drunkTransition?: {
    destinationRoom: RoomId
    maxMoves: number
    wakeRoom: RoomId
    resetRoom: RoomId
  }
  messages: {
    success: string
    spent?: string
    missingRequired?: string
    secretFoundPassOut?: string
    tooManyMovesPassOut?: string
    reset?: string
  }
}

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
  initialState: Record<string, string | boolean | number | string[]>
  /** True if the player can pick it up. */
  takeable: boolean
  /** True if `read X` should narrate the item's `## read` section. */
  readable?: boolean
  /** True if `light X` / `extinguish X` apply; toggles state.lit. */
  lightable?: boolean
  /** True if this item can light other items. */
  lighter?: boolean
  /** Optional remaining-charges counter; absent means unlimited. */
  lighterUses?: number
  /** Prose returned by `read X`. Required iff readable is true. */
  readableText?: string
  /** Prose narrated when `light X` succeeds. Falls back to "It catches." */
  litText?: string
  /** Prose narrated when `extinguish X` succeeds. Falls back to "The flame dies." */
  extinguishedText?: string
  /** Prose narrated when this item's lighterUses reaches 0. Falls back to "It is spent." */
  lighterEmptyText?: string
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
  /** Optional chip label shown by the UI instead of deriving one from ids. */
  chipLabel?: string
  /** Optional command injected by the UI chip instead of deriving one from ids. */
  chipCommand?: string
  /** Required item id in inventory (and optional state predicate). */
  requires?: { item: ItemId; state?: Record<string, string | boolean | number> }
  /** Phase to transition to, or 'resolved' / 'failed'. */
  to: EncounterPhase | 'resolved' | 'failed'
  /** Narration on this transition. */
  narration: string
  /** Resolve cost for the player on this transition (0–2). */
  resolveCost?: 0 | 1 | 2
  /** Optional transition-specific story flags. */
  setFlags?: Record<string, string | boolean | number>
}

export interface EncounterDef {
  id: EncounterId
  /** Optional parser aliases for the encounter target while it is active. */
  aliases?: string[]
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
  game?: GameManifest
  ui?: UiConfig
  parser?: ParserVocabulary
  messages?: WorldMessages
  mechanics?: WorldMechanics
  actions?: Record<string, DeclarativeAction>
  startingRoom: RoomId
  startingInventory: ItemId[]
  endingPriority?: string[]
  rooms: Record<RoomId, Room>
  items: Record<ItemId, Item>
  encounters: Record<EncounterId, EncounterDef>
  /** Story flag definitions and the endings they unlock. */
  endings: Record<string, { whenFlags: Record<string, string | boolean | number | string[]>; narration: string }>
}
