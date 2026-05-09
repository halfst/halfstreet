import type { EncounterDef } from './types'

export const encounters: Record<string, EncounterDef> = {
  rat: {
    id: 'rat',
    startsIn: 'cellar-stair',
    initialPhase: 'lurking',
    phases: {
      lurking: {
        description: 'A heavy rat watches you from the third step. Its eyes catch the light.',
        transitions: [
          {
            verb: 'attack',
            target: 'rat',
            narration: 'You stamp. The rat squeals and is gone into the dark.',
            to: 'resolved',
          },
          {
            verb: 'wait',
            narration: 'The rat does not move. Neither do you.',
            to: 'lurking',
          },
        ],
      },
    },
    onResolved: { setFlags: { ratGone: true } },
    defaultWrongVerbNarration: 'The rat watches.',
  },
}
