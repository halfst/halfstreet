import type { ParsedCommand, NounRef, Verb, MetaVerb, Direction, PendingDisambiguation } from './types'

export interface ParserContext {
  /** All item ids that exist in the world (for noun matching). */
  knownItems: string[]
  /** All encounter ids that exist in the world. */
  knownEncounters: string[]
  /** Nouns currently visible in this room (items + encounter targets). */
  visibleNouns: { id: string; aliases: string[] }[]
  /** Inventory item ids. */
  inventoryItemIds: string[]
  lastNoun: NounRef | null
  awaitingDisambiguation: PendingDisambiguation | null
}

/** Verb synonym table: each entry maps an alias to the canonical Verb. */
const VERB_SYNONYMS: Record<string, Verb> = {
  // movement
  go: 'go', walk: 'go', move: 'go',
  // perception
  look: 'look', l: 'look',
  examine: 'examine', x: 'examine', inspect: 'examine',
  // inventory
  inventory: 'inventory', inv: 'inventory', i: 'inventory',
  // manipulation
  take: 'take', get: 'take', grab: 'take', 'pick up': 'take',
  drop: 'drop', put: 'drop', leave: 'drop',
  use: 'use', combine: 'use',
  open: 'open', close: 'close',
  read: 'read', light: 'light', extinguish: 'extinguish', douse: 'extinguish',
  attack: 'attack', kill: 'attack', fight: 'attack', strike: 'attack',
  hold: 'hold', show: 'hold',
  push: 'push', press: 'push',
  pull: 'pull',
  wait: 'wait', z: 'wait',
}

const DIRECTION_WORDS: Record<string, Direction> = {
  n: 'n', north: 'n',
  s: 's', south: 's',
  e: 'e', east: 'e',
  w: 'w', west: 'w',
  u: 'u', up: 'u',
  d: 'd', down: 'd',
}

const META_VERBS: Record<string, MetaVerb> = {
  restart: 'restart',
  undo: 'undo',
  hint: 'hint',
  save: 'save',
  quit: 'quit',
  theme: 'theme',
}

/** Verbs that legally take no target. */
const VERB_ONLY_VERBS = new Set<string>(['look', 'inventory', 'wait'])

/** Two-word verb prefixes (e.g. "pick up X"). */
const TWO_WORD_VERBS = ['pick up']

/** Leading stop-words stripped from the noun phrase before matching. */
const STOP_WORDS = new Set(['at', 'the', 'a', 'an'])

function tokenize(input: string): string[] {
  return input.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function matchTwoWordVerb(tokens: string[]): { verb: Verb; rest: string[] } | null {
  if (tokens.length < 2) return null
  const head = tokens.slice(0, 2).join(' ')
  for (const phrase of TWO_WORD_VERBS) {
    if (phrase === head) {
      const verb = VERB_SYNONYMS[phrase]
      if (verb) return { verb, rest: tokens.slice(2) }
    }
  }
  return null
}

export function parse(rawInput: string, ctx: ParserContext): ParsedCommand {
  const trimmed = rawInput.trim()
  if (!trimmed) return { kind: 'unknown', raw: '', reason: 'malformed' }

  const tokens = tokenize(trimmed)
  const head = tokens[0]!

  // Meta-commands take precedence (single-word).
  if (META_VERBS[head] && tokens.length === 1) {
    return { kind: 'meta', verb: META_VERBS[head]! }
  }

  // Direction shortcuts: "n", "north", "go n", "go north".
  if (DIRECTION_WORDS[head] && tokens.length === 1) {
    return { kind: 'go', direction: DIRECTION_WORDS[head]! }
  }
  if (head === 'go' && tokens.length === 2) {
    const dir = DIRECTION_WORDS[tokens[1]!]
    if (dir) return { kind: 'go', direction: dir }
  }

  // Disambiguation reply: a single-word answer matching one of the candidates.
  // Must be checked before verb resolution so "brass" / "iron" etc. are caught.
  if (ctx.awaitingDisambiguation && tokens.length === 1) {
    const choice = tokens[0]!
    for (const candidateId of ctx.awaitingDisambiguation.candidates) {
      // Match if the choice is a substring of any alias or the id itself.
      const candidate = ctx.visibleNouns.find((n) => n.id === candidateId)
      const aliases = candidate?.aliases ?? [candidateId]
      if (aliases.some((a) => a.toLowerCase().includes(choice))) {
        return { kind: 'disambiguation', chosen: candidateId }
      }
    }
  }

  // Two-word verb (e.g. "pick up X").
  const twoWord = matchTwoWordVerb(tokens)
  let verb: Verb | undefined
  let rest: string[]
  if (twoWord) {
    verb = twoWord.verb
    rest = twoWord.rest
  } else {
    verb = VERB_SYNONYMS[head]
    rest = tokens.slice(1)
  }

  if (!verb) {
    return { kind: 'unknown', raw: trimmed, reason: 'unknown-verb' }
  }

  // Strip leading stop-words from the noun phrase (e.g. "at", "the", "a", "an").
  while (rest.length > 0 && STOP_WORDS.has(rest[0]!)) {
    rest = rest.slice(1)
  }

  if (rest.length === 0) {
    if (VERB_ONLY_VERBS.has(verb)) {
      return { kind: 'verb-only', verb: verb as 'look' | 'inventory' | 'wait' }
    }
    return { kind: 'unknown', raw: trimmed, reason: 'malformed' }
  }

  // Pronoun resolution: "it" maps to lastNoun.
  if (rest.length === 1 && rest[0] === 'it') {
    if (!ctx.lastNoun) {
      return { kind: 'unknown', raw: trimmed, reason: 'unknown-noun' }
    }
    return {
      kind: 'verb-target',
      verb,
      target: { canonical: ctx.lastNoun.canonical, raw: 'it' },
    }
  }

  // Multi-word noun matching: try the longest possible suffix first.
  const targetRaw = rest.join(' ')
  const candidates: { id: string; alias: string }[] = []
  for (const noun of ctx.visibleNouns) {
    for (const alias of noun.aliases) {
      if (alias === targetRaw) candidates.push({ id: noun.id, alias })
    }
  }

  // Also check inventory items (id used directly as alias).
  if (candidates.length === 0) {
    for (const itemId of ctx.inventoryItemIds) {
      if (itemId === targetRaw) candidates.push({ id: itemId, alias: targetRaw })
    }
  }

  if (candidates.length === 0) {
    return { kind: 'unknown', raw: trimmed, reason: 'unknown-noun' }
  }

  // Multiple candidates → ambiguous. Parser signals; the dispatcher records the
  // PendingDisambiguation in state so the next turn's input is interpreted as
  // a disambiguation reply.
  if (candidates.length > 1) {
    return { kind: 'unknown', raw: trimmed, reason: 'unknown-noun' }
  }

  const target = candidates[0]!
  return {
    kind: 'verb-target',
    verb,
    target: { canonical: target.id, raw: target.alias },
  }
}
