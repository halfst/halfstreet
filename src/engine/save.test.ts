import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveState, loadState, clearSave, SAVE_KEY } from './save'
import type { GameState, TranscriptLine } from './types'
import { SCHEMA_VERSION, TRANSCRIPT_CAP } from './types'

const baseState = (overrides: Partial<GameState> = {}): GameState => ({
  schemaVersion: SCHEMA_VERSION,
  location: 'foyer',
  inventory: [],
  roomState: {},
  flags: {},
  resolveLevel: 'steady',
  encounterState: {},
  lastNoun: null,
  pendingDisambiguation: null,
  transcript: [],
  endedWith: null,
  ...overrides,
})

describe('save — round trip', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k]! : null),
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
  })

  it('round-trips an identical state', () => {
    const s = baseState({ location: 'cellar', flags: { gateOpened: true } })
    saveState(s)
    expect(loadState()).toEqual(s)
  })

  it('returns null when nothing is saved', () => {
    expect(loadState()).toBeNull()
  })

  it('returns null and clears the slot on schema mismatch', () => {
    store[SAVE_KEY] = JSON.stringify({ ...baseState(), schemaVersion: SCHEMA_VERSION + 99 })
    expect(loadState()).toBeNull()
    expect(store[SAVE_KEY]).toBeUndefined()
  })

  it('returns null and clears the slot on malformed JSON', () => {
    store[SAVE_KEY] = 'not-json'
    expect(loadState()).toBeNull()
    expect(store[SAVE_KEY]).toBeUndefined()
  })

  it('truncates transcript to TRANSCRIPT_CAP on save', () => {
    const long: TranscriptLine[] = Array.from({ length: TRANSCRIPT_CAP + 50 }, (_, i) => ({
      kind: 'narration',
      text: `line ${i}`,
    }))
    saveState(baseState({ transcript: long }))
    const loaded = loadState()
    expect(loaded?.transcript).toHaveLength(TRANSCRIPT_CAP)
    // Keeps the most recent lines (the tail).
    expect(loaded?.transcript[0]?.text).toBe(`line ${50}`)
    expect(loaded?.transcript[TRANSCRIPT_CAP - 1]?.text).toBe(`line ${TRANSCRIPT_CAP + 49}`)
  })
})

describe('save — clear', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = { [SAVE_KEY]: JSON.stringify(baseState()) }
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k]! : null),
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
  })

  it('removes the save slot', () => {
    clearSave()
    expect(store[SAVE_KEY]).toBeUndefined()
    expect(loadState()).toBeNull()
  })
})
