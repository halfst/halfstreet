import type { World } from '../world/types'
import type { GameState, Direction } from '../engine/types'
import { getItemsInRoom } from '../engine/dispatcher'

export type ChipKind = 'direction' | 'item' | 'encounter' | 'meta'

export interface Chip {
  kind: ChipKind
  label: string
  command: string   // the literal string to inject as input
  disabled: boolean
}

const DIRECTION_LABELS: Record<Direction, string> = {
  n: '↑ N', s: '↓ S', e: '→ E', w: '← W', u: '↑ U', d: '↓ D',
}

export function computeChips(state: GameState, world: World): Chip[] {
  const out: Chip[] = []
  const room = world.rooms[state.location]
  if (!room) return out

  // Direction chips: enabled if exit exists, dimmed otherwise.
  const dirs: Direction[] = ['n', 's', 'e', 'w', 'u', 'd']
  for (const d of dirs) {
    const present = !!room.exits[d]
    if (present || ['n', 's', 'e', 'w'].includes(d)) {
      out.push({
        kind: 'direction',
        label: DIRECTION_LABELS[d],
        command: d,
        disabled: !present,
      })
    }
  }

  // Item chips: TAKE for visible items (dynamic list excludes taken items).
  for (const itemId of getItemsInRoom(state, world, state.location)) {
    const item = world.items[itemId]
    if (!item || !item.takeable) continue
    if (state.inventory.find((inst) => inst.id === itemId)) continue  // already held
    out.push({
      kind: 'item',
      label: `TAKE ${item.names[0]?.toUpperCase() ?? itemId.toUpperCase()}`,
      command: `take ${item.names[0] ?? itemId}`,
      disabled: false,
    })
  }

  // Encounter chips: surface the verbs from the current phase as suggestions.
  if (room.encounter && state.encounterState[room.encounter]) {
    const def = world.encounters[room.encounter]
    const phase = def?.phases[state.encounterState[room.encounter]!]
    if (def && phase) {
      for (const t of phase.transitions) {
        const targetLabel = t.target && t.target !== '*' ? ` ${t.target.replace(/-/g, ' ').toUpperCase()}` : ''
        const command = t.target && t.target !== '*' ? `${t.verb} ${t.target.replace(/-/g, ' ')}` : t.verb
        out.push({
          kind: 'encounter',
          label: t.chipLabel ?? `${t.verb.toUpperCase()}${targetLabel}`,
          command: t.chipCommand ?? command,
          disabled: false,
        })
      }
    }
  }

  // Persistent meta chips.
  out.push({ kind: 'meta', label: 'LOOK', command: 'look', disabled: false })
  out.push({ kind: 'meta', label: 'INV', command: 'inventory', disabled: false })
  out.push({ kind: 'meta', label: 'USE', command: 'use ', disabled: false })
  out.push({ kind: 'meta', label: 'HELP', command: 'help', disabled: false })

  return out
}
