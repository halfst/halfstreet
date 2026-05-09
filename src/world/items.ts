import type { Item } from './types'

export const items: Record<string, Item> = {
  matches: {
    id: 'matches',
    names: ['matches', 'safety matches', 'box'],
    short: 'a box of safety matches',
    long: 'A small cardboard box of safety matches. Half-full.',
    initialState: {},
    takeable: true,
  },
  lamp: {
    id: 'lamp',
    names: ['lamp', 'oil lamp', 'torch'],
    short: 'an oil lamp',
    long: 'An iron oil lamp with a glass chimney. Currently unlit.',
    initialState: { lit: false },
    takeable: true,
  },
  letter: {
    id: 'letter',
    names: ['letter', 'folded letter', 'paper'],
    short: 'a folded letter',
    long: 'A folded letter on yellowed paper. The hand is unfamiliar. It reads: "Come at once. The thing in the cellar is waking."',
    initialState: {},
    takeable: true,
  },
}
