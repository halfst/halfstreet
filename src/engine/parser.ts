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
  cut: 'cut', trim: 'cut',
  play: 'play',
  listen: 'listen',
  pour: 'pour',
  uncover: 'open',
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
const VERB_ONLY_VERBS = new Set<string>(['look', 'inventory', 'wait', 'listen'])

/** Two-word verb prefixes (e.g. "pick up X"). */
const TWO_WORD_VERBS = ['pick up']

/** Leading stop-words stripped from the noun phrase before matching. */
const STOP_WORDS = new Set(['at', 'the', 'a', 'an'])

const PREPOSITIONS = new Set(['with', 'on', 'in', 'to'])

function resolveNoun(rawTokens: string[], ctx: ParserContext): { id: string; alias: string } | null {
  const phrase = rawTokens.join(' ')
  if (phrase === 'it' && ctx.lastNoun) {
    return { id: ctx.lastNoun.canonical, alias: 'it' }
  }
  for (const noun of ctx.visibleNouns) {
    for (const alias of noun.aliases) {
      if (alias === phrase) return { id: noun.id, alias }
    }
  }
  for (const itemId of ctx.inventoryItemIds) {
    if (itemId === phrase) return { id: itemId, alias: phrase }
  }
  return null
}

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

  if (tokens.length === 1 && ['yes', 'y'].includes(head)) {
    return { kind: 'confirmation', confirmed: true }
  }
  if (tokens.length === 1 && head === 'no') {
    return { kind: 'confirmation', confirmed: false }
  }

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
      return { kind: 'verb-only', verb: verb as 'look' | 'inventory' | 'wait' | 'listen' }
    }
    return { kind: 'unknown', raw: trimmed, reason: 'malformed' }
  }

  // Detect a preposition splitting target | indirect.
  const prepIdx = rest.findIndex((tok) => PREPOSITIONS.has(tok))
  if (prepIdx > 0 && prepIdx < rest.length - 1) {
    const targetTokens = rest.slice(0, prepIdx)
    const prep = rest[prepIdx]!
    let indirectTokens = rest.slice(prepIdx + 1)
    // Strip stop-words at the head of the indirect phrase too ("on the table").
    while (indirectTokens.length > 0 && STOP_WORDS.has(indirectTokens[0]!)) {
      indirectTokens = indirectTokens.slice(1)
    }
    if (indirectTokens.length > 0) {
      const target = resolveNoun(targetTokens, ctx)
      const indirect = resolveNoun(indirectTokens, ctx)
      if (target && indirect) {
        return {
          kind: 'verb-target-prep',
          verb,
          target: { canonical: target.id, raw: target.alias },
          preposition: prep,
          indirect: { canonical: indirect.id, raw: indirect.alias },
        }
      }
      // Either side failed to resolve → fall through to unknown-noun below.
      return { kind: 'unknown', raw: trimmed, reason: 'unknown-noun' }
    }
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

  // Multiple candidates → ambiguous. Dedupe by id; if only one distinct id
  // remains, two aliases of the same item matched — not truly ambiguous.
  if (candidates.length > 1) {
    const uniqueIds = [...new Set(candidates.map((c) => c.id))]
    if (uniqueIds.length === 1) {
      // Two aliases of the same item — not actually ambiguous.
      const id = uniqueIds[0]!
      return { kind: 'verb-target', verb, target: { canonical: id, raw: candidates[0]!.alias } }
    }
    return { kind: 'ambiguous', verb, rawNoun: targetRaw, candidates: uniqueIds }
  }

  const target = candidates[0]!
  return {
    kind: 'verb-target',
    verb,
    target: { canonical: target.id, raw: target.alias },
  }
}
