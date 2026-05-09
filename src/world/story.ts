import type { World } from './types'

export const endings: World['endings'] = {
  true: {
    whenFlags: { ratGone: true },
    narration:
      'You stand at the top of the stair. The thing below has settled. The door behind you opens, and outside, finally, is morning.',
  },
  wrong: {
    whenFlags: {},
    narration: '',  // unreachable in sample world
  },
  bad: {
    whenFlags: {},
    narration: '',  // unreachable in sample world
  },
}
