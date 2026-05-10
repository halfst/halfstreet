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
  'window-guest': {
    id: 'window-guest',
    aliases: ['guest', 'window guest', 'curtains', 'curtain', 'window'],
    startsIn: 'dining-room',
    initialPhase: 'standing-outside',
    phases: {
      'standing-outside': {
        description: narration('window-guest', 'standing-outside'),
        transitions: [
          {
            verb: 'close',
            target: 'window-guest',
            narration: narration('window-guest', 'close-window-guest-resolved'),
            to: 'resolved',
          },
        ],
      },
    },
    onResolved: { setFlags: { curtainsClosed: true } },
    onFailed: { narration: narration('window-guest', 'failed'), retreatTo: 'hallway' },
    defaultWrongVerbNarration: narration('window-guest', 'wrong-verb'),
  },
  'ivy-figure': {
    id: 'ivy-figure',
    aliases: ['ivy figure', 'figure', 'ivy', 'vines', 'vine'],
    startsIn: 'conservatory',
    initialPhase: 'hidden',
    phases: {
      hidden: {
        description: narration('ivy-figure', 'hidden'),
        transitions: [
          {
            verb: 'cut',
            target: 'ivy-figure',
            requires: { item: 'pruning-shears' },
            narration: narration('ivy-figure', 'cut-ivy-figure-resolved'),
            to: 'resolved',
          },
          {
            verb: 'use',
            target: 'ivy-figure',
            requires: { item: 'pruning-shears' },
            narration: narration('ivy-figure', 'cut-ivy-figure-resolved'),
            to: 'resolved',
          },
        ],
      },
    },
    onResolved: { setFlags: { conservatoryVinesCut: true } },
    onFailed: { narration: narration('ivy-figure', 'failed'), retreatTo: 'dining-room' },
    defaultWrongVerbNarration: narration('ivy-figure', 'wrong-verb'),
  },
  'covered-cage': {
    id: 'covered-cage',
    aliases: ['covered cage', 'cage', 'birdcage', 'cloth'],
    startsIn: 'smoking-room',
    initialPhase: 'rustling',
    phases: {
      rustling: {
        description: narration('covered-cage', 'rustling'),
        transitions: [
          {
            verb: 'open',
            target: 'covered-cage',
            narration: narration('covered-cage', 'open-covered-cage-resolved'),
            to: 'resolved',
          },
        ],
      },
    },
    onResolved: { setFlags: { cageUncovered: true } },
    onFailed: { narration: narration('covered-cage', 'failed'), retreatTo: 'hallway' },
    defaultWrongVerbNarration: narration('covered-cage', 'wrong-verb'),
  },
  'piano-echo': {
    id: 'piano-echo',
    aliases: ['piano echo', 'piano', 'note', 'key'],
    startsIn: 'music-room',
    initialPhase: 'listening',
    phases: {
      listening: {
        description: narration('piano-echo', 'listening'),
        transitions: [
          {
            verb: 'play',
            target: 'piano-echo',
            narration: narration('piano-echo', 'play-piano-echo-resolved'),
            to: 'resolved',
          },
        ],
      },
    },
    onResolved: { setFlags: { musicSolved: true } },
    onFailed: { narration: narration('piano-echo', 'failed'), retreatTo: 'hallway' },
    defaultWrongVerbNarration: narration('piano-echo', 'wrong-verb'),
  },
  'breathing-wall': {
    id: 'breathing-wall',
    aliases: ['breathing wall', 'wall', 'walls', 'breathing'],
    startsIn: 'servants-passage',
    initialPhase: 'audible',
    phases: {
      audible: {
        description: narration('breathing-wall', 'audible'),
        transitions: [
          {
            verb: 'wait',
            narration: narration('breathing-wall', 'wait-resolved'),
            to: 'resolved',
          },
        ],
      },
    },
    onResolved: { setFlags: { breathingWallPassed: true } },
    onFailed: { narration: narration('breathing-wall', 'failed'), retreatTo: 'music-room' },
    defaultWrongVerbNarration: narration('breathing-wall', 'wrong-verb'),
  },
  'linen-shape': {
    id: 'linen-shape',
    aliases: ['linen shape', 'shape', 'sheet', 'sheets', 'linen'],
    startsIn: 'laundry',
    initialPhase: 'hanging',
    phases: {
      hanging: {
        description: narration('linen-shape', 'hanging'),
        transitions: [
          {
            verb: 'wait',
            narration: narration('linen-shape', 'wait-resolved'),
            to: 'resolved',
          },
        ],
      },
    },
    onResolved: { setFlags: { linenShapeEmpty: true } },
    onFailed: { narration: narration('linen-shape', 'failed'), retreatTo: 'servants-passage' },
    defaultWrongVerbNarration: narration('linen-shape', 'wrong-verb'),
  },
}
