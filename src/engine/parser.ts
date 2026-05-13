import type { ParsedCommand, NounRef, Verb, MetaVerb, Direction, PendingDisambiguation } from './types'

export interface ParserVocabulary {
  directions: Record<Direction, string[]>
  prepositions: string[]
  stopWords: string[]
  noTargetVerbs: Verb[]
  metaVerbs: MetaVerb[]
  verbs: Partial<Record<Verb, string[]>>
}

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
  vocabulary?: ParserVocabulary
}

export const SUPPORTED_VERBS: Verb[] = [
  'go',
  'look',
  'examine',
  'take',
  'drop',
  'use',
  'open',
  'close',
  'read',
  'light',
  'extinguish',
  'attack',
  'inventory',
  'wait',
  'hold',
  'push',
  'pull',
  'cut',
  'play',
  'listen',
  'pour',
  'drink',
]

export const SUPPORTED_META_VERBS: MetaVerb[] = ['restart', 'undo', 'hint', 'save', 'quit', 'theme']

export const DEFAULT_PARSER_VOCABULARY: ParserVocabulary = {
  directions: {
    n: ['n', 'north'],
    s: ['s', 'south'],
    e: ['e', 'east'],
    w: ['w', 'west'],
    u: ['u', 'up'],
    d: ['d', 'down'],
  },
  prepositions: ['with', 'on', 'in', 'to'],
  stopWords: ['at', 'the', 'a', 'an'],
  noTargetVerbs: ['look', 'inventory', 'wait', 'listen'],
  metaVerbs: ['restart', 'undo', 'hint', 'save', 'quit', 'theme'],
  verbs: {
    go: ['go', 'walk', 'move'],
    look: ['look', 'l'],
    examine: ['examine', 'x', 'inspect'],
    inventory: ['inventory', 'inv', 'i'],
    take: ['take', 'get', 'grab', 'pick up'],
    drop: ['drop', 'put', 'leave'],
    use: ['use', 'combine'],
    open: ['open', 'uncover'],
    close: ['close'],
    drink: ['drink', 'sip'],
    read: ['read'],
    light: ['light'],
    extinguish: ['extinguish', 'douse'],
    attack: ['attack', 'kill', 'fight', 'strike'],
    hold: ['hold', 'show'],
    push: ['push', 'press'],
    pull: ['pull'],
    cut: ['cut', 'trim'],
    play: ['play'],
    listen: ['listen'],
    pour: ['pour'],
    wait: ['wait', 'z'],
  },
}

interface CompiledVocabulary {
  directionWords: Record<string, Direction>
  metaVerbs: Record<string, MetaVerb>
  verbSynonyms: Record<string, Verb>
  multiWordVerbs: string[]
  noTargetVerbs: Set<string>
  stopWords: Set<string>
  prepositions: Set<string>
}

function normalizeAlias(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function compileVocabulary(vocabulary: ParserVocabulary): CompiledVocabulary {
  const directionWords: Record<string, Direction> = {}
  for (const [direction, aliases] of Object.entries(vocabulary.directions) as [Direction, string[]][]) {
    for (const alias of aliases) directionWords[normalizeAlias(alias)] = direction
  }

  const metaVerbs: Record<string, MetaVerb> = {}
  for (const verb of vocabulary.metaVerbs) metaVerbs[normalizeAlias(verb)] = verb

  const verbSynonyms: Record<string, Verb> = {}
  for (const [verb, aliases] of Object.entries(vocabulary.verbs) as [Verb, string[]][]) {
    for (const alias of aliases) verbSynonyms[normalizeAlias(alias)] = verb
  }

  return {
    directionWords,
    metaVerbs,
    verbSynonyms,
    multiWordVerbs: Object.keys(verbSynonyms)
      .filter((alias) => alias.includes(' '))
      .sort((a, b) => b.split(' ').length - a.split(' ').length),
    noTargetVerbs: new Set(vocabulary.noTargetVerbs),
    stopWords: new Set(vocabulary.stopWords.map(normalizeAlias)),
    prepositions: new Set(vocabulary.prepositions.map(normalizeAlias)),
  }
}

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

function matchMultiWordVerb(tokens: string[], vocabulary: CompiledVocabulary): { verb: Verb; rest: string[] } | null {
  for (const phrase of vocabulary.multiWordVerbs) {
    const phraseTokens = phrase.split(' ')
    if (tokens.length >= phraseTokens.length && tokens.slice(0, phraseTokens.length).join(' ') === phrase) {
      const verb = vocabulary.verbSynonyms[phrase]
      if (verb) return { verb, rest: tokens.slice(phraseTokens.length) }
    }
  }
  return null
}

export function parse(rawInput: string, ctx: ParserContext): ParsedCommand {
  const vocabulary = compileVocabulary(ctx.vocabulary ?? DEFAULT_PARSER_VOCABULARY)
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
  if (vocabulary.metaVerbs[head] && tokens.length === 1) {
    return { kind: 'meta', verb: vocabulary.metaVerbs[head]! }
  }

  // Direction shortcuts: "n", "north", "go n", "go north".
  if (vocabulary.directionWords[head] && tokens.length === 1) {
    return { kind: 'go', direction: vocabulary.directionWords[head]! }
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

  // Multi-word verb aliases (e.g. "pick up X").
  const twoWord = matchMultiWordVerb(tokens, vocabulary)
  let verb: Verb | undefined
  let rest: string[]
  if (twoWord) {
    verb = twoWord.verb
    rest = twoWord.rest
  } else {
    verb = vocabulary.verbSynonyms[head]
    rest = tokens.slice(1)
  }

  if (!verb) {
    return { kind: 'unknown', raw: trimmed, reason: 'unknown-verb' }
  }

  if (verb === 'go' && rest.length === 1) {
    const dir = vocabulary.directionWords[rest[0]!]
    if (dir) return { kind: 'go', direction: dir }
  }

  // Strip leading stop-words from the noun phrase (e.g. "at", "the", "a", "an").
  while (rest.length > 0 && vocabulary.stopWords.has(rest[0]!)) {
    rest = rest.slice(1)
  }

  if (rest.length === 0) {
    if (vocabulary.noTargetVerbs.has(verb)) {
      return { kind: 'verb-only', verb: verb as 'look' | 'inventory' | 'wait' | 'listen' }
    }
    return { kind: 'unknown', raw: trimmed, reason: 'malformed' }
  }

  // Detect a preposition splitting target | indirect.
  const prepIdx = rest.findIndex((tok) => vocabulary.prepositions.has(tok))
  if (prepIdx > 0 && prepIdx < rest.length - 1) {
    const targetTokens = rest.slice(0, prepIdx)
    const prep = rest[prepIdx]!
    let indirectTokens = rest.slice(prepIdx + 1)
    // Strip stop-words at the head of the indirect phrase too ("on the table").
    while (indirectTokens.length > 0 && vocabulary.stopWords.has(indirectTokens[0]!)) {
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
