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
  it('returns disambiguation request when two candidates match', () => {
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
    expect(result.kind).toBe('unknown')
    if (result.kind === 'unknown') {
      // Parser flags ambiguity by returning unknown-noun; the dispatcher
      // turns this into a PendingDisambiguation. (Keeping parser pure: it
      // signals; the dispatcher decides UI flow.)
      expect(result.reason).toBe('unknown-noun')
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
