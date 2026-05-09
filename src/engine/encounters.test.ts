import { describe, it, expect } from 'vitest'
import { dispatch, initialStateFor } from './dispatcher'
import type { World } from '../world/types'

const world: World = {
  startingRoom: 'foyer',
  startingInventory: ['mirror'],
  rooms: {
    foyer: {
      id: 'foyer',
      title: '[ Foyer ]',
      descriptions: { firstVisit: 'Foyer.', revisit: 'Foyer.', examined: 'Foyer.' },
      exits: { n: 'stair' },
      items: [],
      safe: true,
    },
    stair: {
      id: 'stair',
      title: '[ Cellar Stair ]',
      descriptions: { firstVisit: 'Stair.', revisit: 'Stair.', examined: 'Stair.' },
      exits: { s: 'foyer', d: 'cellar' },
      items: [],
      encounter: 'revenant',
    },
    cellar: {
      id: 'cellar',
      title: '[ Cellar ]',
      descriptions: { firstVisit: 'Cellar.', revisit: 'Cellar.', examined: 'Cellar.' },
      exits: { u: 'stair' },
      items: [],
    },
  },
  items: {
    mirror: { id: 'mirror', names: ['mirror', 'tarnished mirror'], short: 'a tarnished mirror', long: 'A small mirror, tarnished black.', initialState: {}, takeable: true },
    sword: { id: 'sword', names: ['sword', 'cane sword'], short: 'a cane sword', long: 'A slim cane sword.', initialState: {}, takeable: true },
  },
  encounters: {
    revenant: {
      id: 'revenant',
      startsIn: 'stair',
      initialPhase: 'wary',
      phases: {
        wary: {
          description: 'A revenant rises from the wet stone.',
          transitions: [
            { verb: 'attack', target: 'revenant', narration: 'Your blade passes through.', to: 'shaken', resolveCost: 1 },
            { verb: 'examine', target: 'revenant', narration: 'There is a tarnish around its eyes.', to: 'wary' },
            { verb: 'hold', target: 'revenant', requires: { item: 'mirror' }, narration: 'It looks into the silver.', to: 'resolved' },
          ],
        },
        shaken: {
          description: 'The revenant comes closer.',
          transitions: [
            { verb: 'hold', target: 'revenant', requires: { item: 'mirror' }, narration: 'It looks. It remembers.', to: 'resolved' },
          ],
        },
      },
      onResolved: { setFlags: { revenantLaid: true } },
      onFailed: { narration: 'You stagger back.', retreatTo: 'foyer' },
      defaultWrongVerbNarration: 'The revenant does not seem to notice.',
    },
  },
  endings: {
    true:  { whenFlags: { _never: true }, narration: '' },
    wrong: { whenFlags: { _never: true }, narration: '' },
    bad:   { whenFlags: { _never: true }, narration: '' },
  },
}

describe('encounters — phase advancement', () => {
  it('triggers an encounter on entering its room', () => {
    let s = initialStateFor(world)
    const r = dispatch(s, { kind: 'go', direction: 'n' }, world)
    expect(r.state.encounterState['revenant']).toBe('wary')
    expect(r.appended.some((l) => l.text.includes('revenant rises'))).toBe(true)
  })

  it('right verb resolves the encounter', () => {
    let s = initialStateFor(world)
    s = dispatch(s, { kind: 'go', direction: 'n' }, world).state
    const r = dispatch(s, { kind: 'verb-target', verb: 'hold', target: { canonical: 'revenant', raw: 'revenant' } }, world)
    expect(r.state.encounterState['revenant']).toBeUndefined()
    expect(r.state.flags['revenantLaid']).toBe(true)
    expect(r.appended.some((l) => l.text.includes('looks into the silver'))).toBe(true)
  })

  it('wrong verb costs resolve and surfaces a clue', () => {
    let s = initialStateFor(world)
    s = dispatch(s, { kind: 'go', direction: 'n' }, world).state
    const r = dispatch(s, { kind: 'verb-target', verb: 'attack', target: { canonical: 'revenant', raw: 'revenant' } }, world)
    expect(r.state.resolveLevel).toBe('shaken')
    expect(r.state.encounterState['revenant']).toBe('shaken')
  })

  it('falls back to defaultWrongVerbNarration for unrecognized verbs', () => {
    let s = initialStateFor(world)
    s = dispatch(s, { kind: 'go', direction: 'n' }, world).state
    const r = dispatch(s, { kind: 'verb-target', verb: 'push', target: { canonical: 'revenant', raw: 'revenant' } }, world)
    expect(r.appended.some((l) => l.text.includes('does not seem to notice'))).toBe(true)
  })

  it('retreats to safe room when resolve runs out', () => {
    let s = initialStateFor(world)
    s = dispatch(s, { kind: 'go', direction: 'n' }, world).state
    // Force resolve to 'returning' so the next failure retreats.
    s = { ...s, resolveLevel: 'returning' }
    const r = dispatch(s, { kind: 'verb-target', verb: 'attack', target: { canonical: 'revenant', raw: 'revenant' } }, world)
    expect(r.state.location).toBe('foyer')
    expect(r.appended.some((l) => l.text.includes('stagger back'))).toBe(true)
  })

  it('safe room entry regenerates resolve', () => {
    let s = initialStateFor(world)
    s = { ...s, resolveLevel: 'shaken' }
    s = dispatch(s, { kind: 'go', direction: 'n' }, world).state
    s = dispatch(s, { kind: 'go', direction: 's' }, world).state
    expect(s.resolveLevel).toBe('steady')
  })
})
