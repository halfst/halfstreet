import { describe, it, expect } from 'vitest'
import { computeChips } from './chips'
import { world } from '../world'
import { initialStateFor } from '../engine/dispatcher'
import { dispatch } from '../engine/dispatcher'

describe('computeChips — sample world', () => {
  it('shows valid exits as direction chips with the dim flag for invalid ones', () => {
    const s = initialStateFor(world)
    const chips = computeChips(s, world)
    const directions = chips.filter((c) => c.kind === 'direction')
    expect(directions.find((c) => c.label.includes('N'))?.disabled).toBe(false)
    expect(directions.find((c) => c.label.includes('S'))?.disabled).toBe(true)
  })

  it('adds TAKE chips for visible takeable items', () => {
    let s = initialStateFor(world)
    s = dispatch(s, { kind: 'go', direction: 'n' }, world).state
    s = dispatch(s, { kind: 'go', direction: 'n' }, world).state
    const chips = computeChips(s, world)
    expect(chips.find((c) => c.kind === 'item' && c.command === 'take lamp')).toBeTruthy()
  })

  it('removes TAKE chip after item is taken', () => {
    let s = initialStateFor(world)
    s = dispatch(s, { kind: 'go', direction: 'n' }, world).state
    s = dispatch(s, { kind: 'go', direction: 'n' }, world).state
    s = dispatch(s, { kind: 'verb-target', verb: 'take', target: { canonical: 'lamp', raw: 'lamp' } }, world).state
    const chips = computeChips(s, world)
    expect(chips.find((c) => c.command === 'take lamp')).toBeUndefined()
  })

  it('adds an encounter verb chip when an encounter is active', () => {
    let s = initialStateFor(world)
    s = dispatch(s, { kind: 'go', direction: 'n' }, world).state
    s = dispatch(s, { kind: 'go', direction: 'n' }, world).state
    s = dispatch(s, { kind: 'go', direction: 'e' }, world).state
    const chips = computeChips(s, world)
    expect(chips.find((c) => c.kind === 'encounter' && c.label === 'ATTACK RAT' && c.command === 'attack rat')).toBeTruthy()
  })

  it('always includes LOOK, INV, USE, WAIT, and HELP', () => {
    const s = initialStateFor(world)
    const chips = computeChips(s, world)
    expect(chips.find((c) => c.command === 'look')).toBeTruthy()
    expect(chips.find((c) => c.command === 'inventory')).toBeTruthy()
    expect(chips.find((c) => c.label === 'USE' && c.command === 'use ')).toBeTruthy()
    expect(chips.find((c) => c.command === 'wait')).toBeTruthy()
    expect(chips.find((c) => c.command === 'help')).toBeTruthy()
  })

  it('shows only confirmation chips while a dangerous command is pending', () => {
    const s = {
      ...initialStateFor(world),
      pendingConfirmation: {
        command: { kind: 'verb-target' as const, verb: 'attack' as const, target: { canonical: 'rat', raw: 'rat' } },
        prompt: 'Are you sure?',
      },
    }
    const chips = computeChips(s, world)
    expect(chips).toEqual([
      { kind: 'meta', label: 'YES', command: 'yes', disabled: false },
      { kind: 'meta', label: 'NO', command: 'no', disabled: false },
    ])
  })
})
