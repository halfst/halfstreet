import type { World } from './types'
import { rooms } from './rooms'
import { items } from './items'
import { encounters } from './encounters'
import { endings } from './story'

export const world: World = {
  startingRoom: 'foyer',
  startingInventory: ['matches'],
  rooms,
  items,
  encounters,
  endings,
}
