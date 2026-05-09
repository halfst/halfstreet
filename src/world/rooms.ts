import type { Room } from './types'

export const rooms: Record<string, Room> = {
  foyer: {
    id: 'foyer',
    title: '[ Foyer ]',
    descriptions: {
      firstVisit:
        'You stand in the foyer of a house you do not remember entering. The door behind you has closed without sound. A folded letter lies on a small table. A hallway leads north.',
      revisit: 'The foyer. The door behind you is still closed.',
      examined:
        'A foyer with peeling paper. A small table holds nothing but the letter. The air smells of cold stone. A hallway leads north.',
    },
    exits: { n: 'hallway' },
    items: ['letter'],
    safe: true,
  },
  hallway: {
    id: 'hallway',
    title: '[ Hallway ]',
    descriptions: {
      firstVisit:
        'A long hallway, lit by nothing. An iron oil lamp sits on a side table. The foyer is south. A stair descends east.',
      revisit: 'The long hallway.',
      examined:
        'The hallway runs further than the house should be wide. The dust on the floor is undisturbed except where you have walked. The oil lamp is on the side table.',
    },
    exits: { s: 'foyer', e: 'cellar-stair' },
    items: ['lamp'],
  },
  'cellar-stair': {
    id: 'cellar-stair',
    title: '[ Cellar Stair ]',
    descriptions: {
      firstVisit:
        'The stair drops into wet stone. The hallway is west. Something at the bottom is breathing.',
      revisit: 'The stair to the cellar.',
      examined: 'The stairs are stone, slick with damp. You can hear water below, and something else.',
    },
    exits: { w: 'hallway' },
    items: [],
    encounter: 'rat',
  },
}
