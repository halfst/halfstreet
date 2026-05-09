import type { EncounterDef } from './types'
import { narration } from './loader'

export const encounters: Record<string, EncounterDef> = {
  rat: {
    id: 'rat',
    startsIn: 'cellar-stair',
    initialPhase: 'lurking',
    phases: {
      lurking: {
        description: narration('rat', 'lurking'),
        transitions: [
          {
            verb: 'attack',
            target: 'rat',
            narration: narration('rat', 'attack-rat-resolved'),
            to: 'resolved',
          },
          {
            verb: 'wait',
            narration: narration('rat', 'wait-stays'),
            to: 'lurking',
          },
        ],
      },
    },
    onResolved: { setFlags: { ratGone: true } },
    defaultWrongVerbNarration: 'The rat watches.',
  },
}
