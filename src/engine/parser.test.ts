import { describe, it, expect } from 'vitest'
import { parse } from './parser'
import type { ParserContext } from './parser'

const emptyCtx: ParserContext = {
  knownItems: [],
  knownEncounters: [],
  visibleNouns: [],
  inventoryItemIds: [],
  lastNoun: null,
  awaitingDisambiguation: null,
}

describe('parser — verb-only commands', () => {
  it('recognizes bare "look"', () => {
    expect(parse('look', emptyCtx)).toEqual({ kind: 'verb-only', verb: 'look' })
  })

  it('recognizes bare "listen"', () => {
    expect(parse('listen', emptyCtx)).toEqual({ kind: 'verb-only', verb: 'listen' })
  })

  it('recognizes bare "inventory" and short forms', () => {
    expect(parse('inventory', emptyCtx)).toEqual({ kind: 'verb-only', verb: 'inventory' })
    expect(parse('inv', emptyCtx)).toEqual({ kind: 'verb-only', verb: 'inventory' })
    expect(parse('i', emptyCtx)).toEqual({ kind: 'verb-only', verb: 'inventory' })
  })

  it('is case-insensitive', () => {
    expect(parse('LOOK', emptyCtx)).toEqual({ kind: 'verb-only', verb: 'look' })
    expect(parse('Inv', emptyCtx)).toEqual({ kind: 'verb-only', verb: 'inventory' })
  })

  it('trims whitespace', () => {
    expect(parse('  look  ', emptyCtx)).toEqual({ kind: 'verb-only', verb: 'look' })
  })
})

describe('parser — direction shortcuts', () => {
  it('maps single-letter directions', () => {
    expect(parse('n', emptyCtx)).toEqual({ kind: 'go', direction: 'n' })
    expect(parse('s', emptyCtx)).toEqual({ kind: 'go', direction: 's' })
    expect(parse('e', emptyCtx)).toEqual({ kind: 'go', direction: 'e' })
    expect(parse('w', emptyCtx)).toEqual({ kind: 'go', direction: 'w' })
    expect(parse('u', emptyCtx)).toEqual({ kind: 'go', direction: 'u' })
    expect(parse('d', emptyCtx)).toEqual({ kind: 'go', direction: 'd' })
  })

  it('maps full direction words', () => {
    expect(parse('north', emptyCtx)).toEqual({ kind: 'go', direction: 'n' })
    expect(parse('south', emptyCtx)).toEqual({ kind: 'go', direction: 's' })
    expect(parse('go north', emptyCtx)).toEqual({ kind: 'go', direction: 'n' })
    expect(parse('go up', emptyCtx)).toEqual({ kind: 'go', direction: 'u' })
  })
})

describe('parser — meta-commands', () => {
  it('recognizes restart, undo, hint, quit, save, theme', () => {
    expect(parse('restart', emptyCtx)).toEqual({ kind: 'meta', verb: 'restart' })
    expect(parse('undo', emptyCtx)).toEqual({ kind: 'meta', verb: 'undo' })
    expect(parse('hint', emptyCtx)).toEqual({ kind: 'meta', verb: 'hint' })
    expect(parse('quit', emptyCtx)).toEqual({ kind: 'meta', verb: 'quit' })
    expect(parse('save', emptyCtx)).toEqual({ kind: 'meta', verb: 'save' })
    expect(parse('theme', emptyCtx)).toEqual({ kind: 'meta', verb: 'theme' })
  })
})

describe('parser — unknown input', () => {
  it('returns unknown for empty input', () => {
    expect(parse('', emptyCtx)).toEqual({ kind: 'unknown', raw: '', reason: 'malformed' })
  })

  it('returns unknown-verb for nonsense', () => {
    expect(parse('flibbertigibbet', emptyCtx)).toEqual({
      kind: 'unknown',
      raw: 'flibbertigibbet',
      reason: 'unknown-verb',
    })
  })
})

describe('parser — verb + target', () => {
  it('recognizes slice-two encounter verbs', () => {
    const ctx: ParserContext = {
      knownItems: [],
      knownEncounters: ['piano-echo', 'covered-cage'],
      visibleNouns: [
        { id: 'piano-echo', aliases: ['piano', 'note'] },
        { id: 'covered-cage', aliases: ['cage'] },
      ],
      inventoryItemIds: [],
      lastNoun: null,
      awaitingDisambiguation: null,
    }
    expect(parse('play note', ctx)).toEqual({
      kind: 'verb-target',
      verb: 'play',
      target: { canonical: 'piano-echo', raw: 'note' },
    })
    expect(parse('uncover cage', ctx)).toEqual({
      kind: 'verb-target',
      verb: 'open',
      target: { canonical: 'covered-cage', raw: 'cage' },
    })
  })

  it('recognizes pour commands with an indirect target', () => {
    const ctx: ParserContext = {
      knownItems: ['silver-vial'],
      knownEncounters: ['basilisk'],
      visibleNouns: [{ id: 'basilisk', aliases: ['basilisk'] }],
      inventoryItemIds: ['silver-vial'],
      lastNoun: null,
      awaitingDisambiguation: null,
    }
    expect(parse('pour silver-vial on basilisk', ctx)).toEqual({
      kind: 'verb-target-prep',
      verb: 'pour',
      target: { canonical: 'silver-vial', raw: 'silver-vial' },
      preposition: 'on',
      indirect: { canonical: 'basilisk', raw: 'basilisk' },
    })
  })

  it('resolves a single visible noun', () => {
    const ctx: ParserContext = {
      knownItems: ['torch'],
      knownEncounters: [],
      visibleNouns: [{ id: 'torch', aliases: ['torch', 'lamp'] }],
      inventoryItemIds: [],
      lastNoun: null,
      awaitingDisambiguation: null,
    }
    expect(parse('take torch', ctx)).toEqual({
      kind: 'verb-target',
      verb: 'take',
      target: { canonical: 'torch', raw: 'torch' },
    })
  })

  it('matches multi-word object names', () => {
    const ctx: ParserContext = {
      knownItems: ['brass-key'],
      knownEncounters: [],
      visibleNouns: [{ id: 'brass-key', aliases: ['brass key', 'key'] }],
      inventoryItemIds: [],
      lastNoun: null,
      awaitingDisambiguation: null,
    }
    expect(parse('take brass key', ctx)).toEqual({
      kind: 'verb-target',
      verb: 'take',
      target: { canonical: 'brass-key', raw: 'brass key' },
    })
  })

  it('matches by alias', () => {
    const ctx: ParserContext = {
      knownItems: ['torch'],
      knownEncounters: [],
      visibleNouns: [{ id: 'torch', aliases: ['torch', 'lamp'] }],
      inventoryItemIds: [],
      lastNoun: null,
      awaitingDisambiguation: null,
    }
    expect(parse('take lamp', ctx)).toEqual({
      kind: 'verb-target',
      verb: 'take',
      target: { canonical: 'torch', raw: 'lamp' },
    })
  })

  it('returns unknown-noun for noun not in scope', () => {
    const ctx: ParserContext = {
      knownItems: ['torch'],
      knownEncounters: [],
      visibleNouns: [],
      inventoryItemIds: [],
      lastNoun: null,
      awaitingDisambiguation: null,
    }
    expect(parse('take torch', ctx)).toEqual({
      kind: 'unknown',
      raw: 'take torch',
      reason: 'unknown-noun',
    })
  })

  it('checks inventory for noun resolution', () => {
    const ctx: ParserContext = {
      knownItems: ['torch'],
      knownEncounters: [],
      visibleNouns: [],
      inventoryItemIds: ['torch'],
      lastNoun: null,
      awaitingDisambiguation: null,
    }
    expect(parse('drop torch', ctx)).toEqual({
      kind: 'verb-target',
      verb: 'drop',
      target: { canonical: 'torch', raw: 'torch' },
    })
  })
})

describe('parser — disambiguation', () => {
  it('returns ambiguous when two candidates match', () => {
    const ctx: ParserContext = {
      knownItems: ['brass-key', 'iron-key'],
      knownEncounters: [],
      visibleNouns: [
        { id: 'brass-key', aliases: ['brass key', 'key'] },
        { id: 'iron-key', aliases: ['iron key', 'key'] },
      ],
      inventoryItemIds: [],
      lastNoun: null,
      awaitingDisambiguation: null,
    }
    const result = parse('take key', ctx)
    expect(result.kind).toBe('ambiguous')
    if (result.kind === 'ambiguous') {
      expect(result.verb).toBe('take')
      expect(result.rawNoun).toBe('key')
      expect(result.candidates).toEqual(['brass-key', 'iron-key'])
    }
  })

  it('disambiguation reply resolves the pending choice', () => {
    const ctx: ParserContext = {
      knownItems: ['brass-key', 'iron-key'],
      knownEncounters: [],
      visibleNouns: [
        { id: 'brass-key', aliases: ['brass key', 'key'] },
        { id: 'iron-key', aliases: ['iron key', 'key'] },
      ],
      inventoryItemIds: [],
      lastNoun: null,
      awaitingDisambiguation: {
        verb: 'take',
        candidates: ['brass-key', 'iron-key'],
        prompt: 'Which key — the brass key or the iron key?',
      },
    }
    expect(parse('brass', ctx)).toEqual({ kind: 'disambiguation', chosen: 'brass-key' })
    expect(parse('iron', ctx)).toEqual({ kind: 'disambiguation', chosen: 'iron-key' })
  })
})

describe('parser — pronouns', () => {
  it('resolves "it" to lastNoun', () => {
    const ctx: ParserContext = {
      knownItems: ['torch'],
      knownEncounters: [],
      visibleNouns: [{ id: 'torch', aliases: ['torch'] }],
      inventoryItemIds: [],
      lastNoun: { canonical: 'torch', raw: 'torch' },
      awaitingDisambiguation: null,
    }
    expect(parse('examine it', ctx)).toEqual({
      kind: 'verb-target',
      verb: 'examine',
      target: { canonical: 'torch', raw: 'it' },
    })
  })

  it('returns unknown-noun for "it" with no lastNoun', () => {
    const ctx: ParserContext = {
      knownItems: ['torch'],
      knownEncounters: [],
      visibleNouns: [{ id: 'torch', aliases: ['torch'] }],
      inventoryItemIds: [],
      lastNoun: null,
      awaitingDisambiguation: null,
    }
    const result = parse('examine it', ctx)
    expect(result.kind).toBe('unknown')
  })
})

describe('stop-word stripping', () => {
  const ctx: ParserContext = {
    knownItems: ['lamp'],
    knownEncounters: [],
    visibleNouns: [{ id: 'lamp', aliases: ['lamp', 'oil lamp'] }],
    inventoryItemIds: [],
    lastNoun: null,
    awaitingDisambiguation: null,
  }

  it('strips a leading "at" from the noun phrase', () => {
    const cmd = parse('look at lamp', ctx)
    expect(cmd).toEqual({
      kind: 'verb-target',
      verb: 'look',
      target: { canonical: 'lamp', raw: 'lamp' },
    })
  })

  it('strips a leading "the"', () => {
    const cmd = parse('examine the lamp', ctx)
    expect(cmd.kind).toBe('verb-target')
  })

  it('strips "a" and "an"', () => {
    expect(parse('take a lamp', ctx).kind).toBe('verb-target')
    expect(parse('take an oil lamp', ctx).kind).toBe('verb-target')
  })

  it('does not strip stop-words mid-phrase', () => {
    // 'oil lamp' is the alias; 'oil at lamp' is not. Stop-words only strip from
    // the head of the noun phrase, not anywhere in the middle.
    const cmd = parse('take oil lamp', ctx)
    expect(cmd.kind).toBe('verb-target')
  })
})

describe('ambiguous noun', () => {
  const ctx: ParserContext = {
    knownItems: ['iron-key', 'brass-key'],
    knownEncounters: [],
    visibleNouns: [
      { id: 'iron-key', aliases: ['key', 'iron key'] },
      { id: 'brass-key', aliases: ['key', 'brass key'] },
    ],
    inventoryItemIds: [],
    lastNoun: null,
    awaitingDisambiguation: null,
  }

  it('returns ambiguous when two aliases match the same noun phrase', () => {
    const cmd = parse('take key', ctx)
    expect(cmd).toEqual({
      kind: 'ambiguous',
      verb: 'take',
      rawNoun: 'key',
      candidates: ['iron-key', 'brass-key'],
    })
  })

  it('still returns verb-target when the phrase is unambiguous', () => {
    const cmd = parse('take iron key', ctx)
    expect(cmd.kind).toBe('verb-target')
    if (cmd.kind === 'verb-target') expect(cmd.target.canonical).toBe('iron-key')
  })
})

describe('verb-target-prep with "with"', () => {
  const ctx: ParserContext = {
    knownItems: ['lamp', 'matches'],
    knownEncounters: [],
    visibleNouns: [
      { id: 'lamp', aliases: ['lamp'] },
      { id: 'matches', aliases: ['matches', 'match', 'matchbook'] },
    ],
    inventoryItemIds: ['matches'],
    lastNoun: null,
    awaitingDisambiguation: null,
  }

  it('parses "light lamp with matches" into verb-target-prep', () => {
    const cmd = parse('light lamp with matches', ctx)
    expect(cmd).toEqual({
      kind: 'verb-target-prep',
      verb: 'light',
      target: { canonical: 'lamp', raw: 'lamp' },
      preposition: 'with',
      indirect: { canonical: 'matches', raw: 'matches' },
    })
  })

  it('parses singular "match" aliases', () => {
    const cmd = parse('use match with lamp', ctx)
    expect(cmd).toEqual({
      kind: 'verb-target-prep',
      verb: 'use',
      target: { canonical: 'matches', raw: 'match' },
      preposition: 'with',
      indirect: { canonical: 'lamp', raw: 'lamp' },
    })
  })

  it('parses "use shears on vines" into verb-target-prep', () => {
    const localCtx: ParserContext = {
      knownItems: ['shears', 'ivy-figure'],
      knownEncounters: [],
      visibleNouns: [
        { id: 'shears', aliases: ['shears'] },
        { id: 'ivy-figure', aliases: ['vines', 'ivy'] },
      ],
      inventoryItemIds: ['shears'],
      lastNoun: null,
      awaitingDisambiguation: null,
    }
    const cmd = parse('use shears on vines', localCtx)
    expect(cmd).toEqual({
      kind: 'verb-target-prep',
      verb: 'use',
      target: { canonical: 'shears', raw: 'shears' },
      preposition: 'on',
      indirect: { canonical: 'ivy-figure', raw: 'vines' },
    })
  })

  it('still parses verb-target when no preposition is present', () => {
    const cmd = parse('take lamp', ctx)
    expect(cmd.kind).toBe('verb-target')
  })

  it('falls back to unknown-noun when one side fails to resolve', () => {
    const cmd = parse('light lamp with feathers', ctx)
    expect(cmd).toEqual({ kind: 'unknown', raw: 'light lamp with feathers', reason: 'unknown-noun' })
  })
})
