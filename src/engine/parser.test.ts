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
