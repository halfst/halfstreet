// Engine type definitions. No runtime code — these shapes are the contract
// between the world data, the engine, and the UI.

export type RoomId = string
export type ItemId = string
export type EncounterId = string
export type Direction = 'n' | 's' | 'e' | 'w' | 'u' | 'd'

export type Verb =
  | 'go' | 'look' | 'examine' | 'take' | 'drop' | 'use' | 'open' | 'close'
  | 'read' | 'light' | 'extinguish' | 'attack' | 'inventory' | 'wait'
  | 'hold' | 'push' | 'pull' | 'cut' | 'play' | 'listen' | 'pour' | 'drink'

export type MetaVerb = 'restart' | 'undo' | 'hint' | 'save' | 'quit' | 'theme'

export interface NounRef {
  /** Canonical noun (matches an ItemId, EncounterId, or a directional/world noun). */
  canonical: string
  /** The raw token(s) the player typed, for narration. */
  raw: string
}

export type ParsedCommand =
  | { kind: 'confirmation'; confirmed: boolean }
  | { kind: 'verb-only'; verb: Verb | 'look' | 'inventory' | 'wait' | 'listen' }
  | { kind: 'verb-target'; verb: Verb; target: NounRef }
  | { kind: 'verb-target-prep'; verb: Verb; target: NounRef; preposition: string; indirect: NounRef }
  | { kind: 'ambiguous'; verb: Verb; rawNoun: string; candidates: string[] }
  | { kind: 'go'; direction: Direction }
  | { kind: 'meta'; verb: MetaVerb }
  | { kind: 'disambiguation'; chosen: string }
  | { kind: 'unknown'; raw: string; reason: 'unknown-verb' | 'unknown-noun' | 'malformed' }

export type ResolveLevel = 'steady' | 'shaken' | 'reeling' | 'returning'

export interface ItemInstance {
  id: ItemId
  /** Per-instance state: lit/unlit, broken/whole, etc. */
  state: Record<string, string | boolean | number | string[]>
}

export type EncounterPhase = string  // phase names are encounter-specific
export type EndingId = 'true' | 'wrong' | 'bad' | 'replacement' | 'mercy'

export interface TranscriptLine {
  kind: 'narration' | 'player' | 'system' | 'ending'
  text: string
}

export interface PendingDisambiguation {
  verb: Verb
  candidates: string[]   // canonical noun ids the player must choose between
  prompt: string
}

export interface PendingConfirmation {
  command: ParsedCommand
  prompt: string
}

export interface GameState {
  schemaVersion: number
  location: RoomId
  inventory: ItemInstance[]
  /** Per-room state: visited, items dropped, descriptive flags. */
  roomState: Record<RoomId, Record<string, string | boolean | number | string[]>>
  /** Story-wide flags (e.g. 'gateOpened', 'mirrorTarnished'). */
  flags: Record<string, string | boolean | number | string[]>
  resolveLevel: ResolveLevel
  /** Active encounter phase by encounter id, or null if no encounter is mid-flight. */
  encounterState: Record<EncounterId, EncounterPhase>
  /** Last referenced noun, for pronoun resolution. */
  lastNoun: NounRef | null
  /** Pending multi-word disambiguation, set when the parser cannot decide. */
  pendingDisambiguation: PendingDisambiguation | null
  /** Pending confirmation for dangerous/game-changing commands. */
  pendingConfirmation: PendingConfirmation | null
  /** Capped at 200 entries; older entries are dropped on append. */
  transcript: TranscriptLine[]
  /** Set true when the player has reached an ending. UI shows ending screen. */
  endedWith: EndingId | null
}

export interface DispatchResult {
  state: GameState
  /** Lines to append to the transcript (already added to state.transcript). */
  appended: TranscriptLine[]
}

export const SCHEMA_VERSION = 1
export const TRANSCRIPT_CAP = 200
export const RESOLVE_LEVELS: ResolveLevel[] = ['steady', 'shaken', 'reeling', 'returning']
