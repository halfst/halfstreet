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
            chipLabel: 'ATTACK RAT',
            chipCommand: 'attack rat',
            narration: narration('rat', 'attack-rat-resolved'),
            to: 'resolved',
          },
          {
            verb: 'wait',
            chipLabel: 'WAIT',
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
            chipLabel: 'CLOSE CURTAINS',
            chipCommand: 'close curtains',
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
            chipLabel: 'CUT VINES',
            chipCommand: 'cut vines',
            requires: { item: 'pruning-shears' },
            narration: narration('ivy-figure', 'cut-ivy-figure-resolved'),
            to: 'resolved',
          },
          {
            verb: 'use',
            target: 'ivy-figure',
            chipLabel: 'USE SHEARS',
            chipCommand: 'use vines with shears',
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
            chipLabel: 'UNCOVER CAGE',
            chipCommand: 'uncover cage',
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
            chipLabel: 'PLAY NOTE',
            chipCommand: 'play note',
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
            chipLabel: 'WAIT',
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
            chipLabel: 'WAIT',
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
  'stair-sleeper': {
    id: 'stair-sleeper',
    aliases: ['stair sleeper', 'sleeper', 'figure', 'person', 'body'],
    startsIn: 'stair-up',
    initialPhase: 'seated',
    phases: {
      seated: {
        description: narration('stair-sleeper', 'seated'),
        transitions: [
          {
            verb: 'wait',
            chipLabel: 'WAIT',
            narration: narration('stair-sleeper', 'wait-resolved'),
            to: 'resolved',
          },
        ],
      },
    },
    onResolved: { setFlags: { hallwayShifted: true } },
    onFailed: { narration: narration('stair-sleeper', 'failed'), retreatTo: 'parlor' },
    defaultWrongVerbNarration: narration('stair-sleeper', 'wrong-verb'),
  },
  'garden-procession': {
    id: 'garden-procession',
    aliases: ['garden procession', 'procession', 'lanterns', 'lantern', 'lights', 'hedge'],
    startsIn: 'garden',
    initialPhase: 'passing',
    phases: {
      passing: {
        description: narration('garden-procession', 'passing'),
        transitions: [
          {
            verb: 'wait',
            chipLabel: 'WAIT',
            narration: narration('garden-procession', 'wait-resolved'),
            to: 'resolved',
          },
        ],
      },
    },
    onResolved: { setFlags: { gardenQuiet: true } },
    onFailed: { narration: narration('garden-procession', 'failed'), retreatTo: 'back-door' },
    defaultWrongVerbNarration: narration('garden-procession', 'wrong-verb'),
  },
  'child-beneath-well': {
    id: 'child-beneath-well',
    aliases: ['child', 'well child', 'child beneath well', 'barefoot child'],
    startsIn: 'well-shaft',
    initialPhase: 'climbing',
    phases: {
      climbing: {
        description: narration('child-beneath-well', 'climbing'),
        transitions: [
          {
            verb: 'hold',
            target: 'toy-dog',
            chipLabel: 'SHOW DOG',
            chipCommand: 'hold dog',
            requires: { item: 'toy-dog' },
            narration: narration('child-beneath-well', 'hold-toy-dog-resolved'),
            to: 'resolved',
          },
          {
            verb: 'wait',
            chipLabel: 'WAIT',
            narration: narration('child-beneath-well', 'wait-resolved'),
            to: 'resolved',
          },
        ],
      },
    },
    onResolved: { setFlags: { childPassedWell: true } },
    onFailed: { narration: narration('child-beneath-well', 'failed'), retreatTo: 'well' },
    defaultWrongVerbNarration: narration('child-beneath-well', 'wrong-verb'),
  },
  'bone-keeper': {
    id: 'bone-keeper',
    aliases: ['bone keeper', 'keeper', 'hands', 'bones', 'ribs'],
    startsIn: 'ossuary',
    initialPhase: 'arranging',
    phases: {
      arranging: {
        description: narration('bone-keeper', 'arranging'),
        transitions: [
          {
            verb: 'drop',
            target: 'burial-ring',
            chipLabel: 'LEAVE RING',
            chipCommand: 'leave ring',
            requires: { item: 'burial-ring' },
            narration: narration('bone-keeper', 'leave-burial-ring-resolved'),
            to: 'resolved',
          },
        ],
      },
    },
    onResolved: { setFlags: { burialRingPlaced: true } },
    onFailed: { narration: narration('bone-keeper', 'failed'), retreatTo: 'tunnel' },
    defaultWrongVerbNarration: narration('bone-keeper', 'wrong-verb'),
  },
  reflection: {
    id: 'reflection',
    aliases: ['reflection', 'water', 'black water', 'face', 'reflected figure'],
    startsIn: 'flooded-passage',
    initialPhase: 'following',
    phases: {
      following: {
        description: narration('reflection', 'following'),
        transitions: [
          {
            verb: 'use',
            target: 'reflection',
            chipLabel: 'USE SHEET',
            chipCommand: 'use water with sheet',
            requires: { item: 'damp-sheet' },
            narration: narration('reflection', 'obscure-water-resolved'),
            to: 'resolved',
          },
        ],
      },
    },
    onResolved: { setFlags: { reflectionObscured: true } },
    onFailed: { narration: narration('reflection', 'failed'), retreatTo: 'ossuary' },
    defaultWrongVerbNarration: narration('reflection', 'wrong-verb'),
  },
  'root-movement': {
    id: 'root-movement',
    aliases: ['root movement', 'roots', 'root', 'opening'],
    startsIn: 'root-chamber',
    initialPhase: 'shifting',
    phases: {
      shifting: {
        description: narration('root-movement', 'shifting'),
        transitions: [
          {
            verb: 'listen',
            chipLabel: 'LISTEN',
            chipCommand: 'listen',
            narration: narration('root-movement', 'listen-resolved'),
            to: 'resolved',
          },
        ],
      },
    },
    onResolved: { setFlags: { rootsListenedTo: true } },
    onFailed: { narration: narration('root-movement', 'failed'), retreatTo: 'flooded-passage' },
    defaultWrongVerbNarration: narration('root-movement', 'wrong-verb'),
  },
  'portrait-woman': {
    id: 'portrait-woman',
    aliases: ['portrait woman', 'woman', 'portrait', 'portraits', 'veil', 'funeral veil'],
    startsIn: 'burial-gallery',
    initialPhase: 'watching',
    phases: {
      watching: {
        description: narration('portrait-woman', 'watching'),
        transitions: [
          {
            verb: 'examine',
            target: 'portrait-woman',
            chipLabel: 'EXAMINE PORTRAITS',
            chipCommand: 'examine portraits',
            narration: narration('portrait-woman', 'examine-portraits-resolved'),
            to: 'resolved',
          },
        ],
      },
    },
    onResolved: { setFlags: { familyResemblanceSeen: true } },
    onFailed: { narration: narration('portrait-woman', 'failed'), retreatTo: 'root-chamber' },
    defaultWrongVerbNarration: narration('portrait-woman', 'wrong-verb'),
  },
  basilisk: {
    id: 'basilisk',
    aliases: ['basilisk', 'creature', 'eye', 'altar', 'coil'],
    startsIn: 'chapel',
    initialPhase: 'sleeping',
    phases: {
      sleeping: {
        description: narration('basilisk', 'sleeping'),
        transitions: [
          {
            verb: 'pour',
            target: 'silver-vial',
            chipLabel: 'POUR VIAL',
            chipCommand: 'pour vial on basilisk',
            requires: { item: 'silver-vial' },
            narration: narration('basilisk', 'pour-vial-resolved'),
            to: 'resolved',
          },
          {
            verb: 'use',
            target: 'basilisk',
            chipLabel: 'USE VIAL',
            chipCommand: 'use basilisk with vial',
            requires: { item: 'silver-vial' },
            narration: narration('basilisk', 'pour-vial-resolved'),
            to: 'resolved',
          },
        ],
      },
    },
    onResolved: { setFlags: { basiliskSpared: true } },
    onFailed: { narration: narration('basilisk', 'failed'), retreatTo: 'vault' },
    defaultWrongVerbNarration: narration('basilisk', 'wrong-verb'),
  },
}
