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
    const s = initialStateFor(world)
    const chips = computeChips(s, world)
    expect(chips.find((c) => c.kind === 'item' && c.command === 'take letter')).toBeTruthy()
  })

  it('adds an encounter verb chip when an encounter is active', () => {
    let s = initialStateFor(world)
    s = dispatch(s, { kind: 'go', direction: 'n' }, world).state
    s = dispatch(s, { kind: 'go', direction: 'e' }, world).state
    const chips = computeChips(s, world)
    expect(chips.find((c) => c.kind === 'encounter' && c.command.includes('rat'))).toBeTruthy()
  })

  it('always includes LOOK and INV', () => {
    const s = initialStateFor(world)
    const chips = computeChips(s, world)
    expect(chips.find((c) => c.command === 'look')).toBeTruthy()
    expect(chips.find((c) => c.command === 'inventory')).toBeTruthy()
  })
})
