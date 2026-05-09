import matter from 'gray-matter'
import type { Room, RoomDescriptions, Item } from './types'
import type { Direction } from '../engine/types'
import { roomFrontmatterSchema, itemFrontmatterSchema } from './schema'

const WIKILINK = /^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/

function stripWikilink(value: unknown): unknown {
  if (typeof value === 'string') {
    const m = value.match(WIKILINK)
    return m ? m[1] : value
  }
  if (Array.isArray(value)) return value.map(stripWikilink)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = stripWikilink(v)
    return out
  }
  return value
}

function splitSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {}
  // Section names use only [A-Za-z0-9_-]; headers with spaces or dots are silently skipped.
  const re = /^##\s+([\w-]+)\s*$/gm
  const matches = [...body.matchAll(re)]
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!
    const key = m[1]!
    const start = m.index! + m[0]!.length
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : body.length
    sections[key] = body.slice(start, end).trim()
  }
  return sections
}

const DIRS: Direction[] = ['n', 's', 'e', 'w', 'u', 'd']
const DIR_KEYS: Record<Direction, { exit: string; requires: string; locked: string }> = {
  n: { exit: 'exitN', requires: 'exitNRequires', locked: 'exitNLockedText' },
  s: { exit: 'exitS', requires: 'exitSRequires', locked: 'exitSLockedText' },
  e: { exit: 'exitE', requires: 'exitERequires', locked: 'exitELockedText' },
  w: { exit: 'exitW', requires: 'exitWRequires', locked: 'exitWLockedText' },
  u: { exit: 'exitU', requires: 'exitURequires', locked: 'exitULockedText' },
  d: { exit: 'exitD', requires: 'exitDRequires', locked: 'exitDLockedText' },
}

const REQUIRED_ROOM_SECTIONS = ['first-visit', 'revisit', 'examined'] as const

export function parseRoom(raw: string, sourcePath: string): Room {
  const parsed = matter(raw)
  const frontmatter = stripWikilink(parsed.data) as Record<string, unknown>
  const fm = roomFrontmatterSchema.parse(frontmatter)

  const sections = splitSections(parsed.content)
  for (const key of REQUIRED_ROOM_SECTIONS) {
    if (!(key in sections)) {
      throw new Error(`${sourcePath}: missing required section "## ${key}"`)
    }
  }

  const descriptions: RoomDescriptions = {
    firstVisit: sections['first-visit']!,
    revisit: sections['revisit']!,
    examined: sections['examined']!,
  }

  const exits: Partial<Record<Direction, string>> = {}
  const lockedExits: NonNullable<Room['lockedExits']> = {}
  for (const dir of DIRS) {
    const keys = DIR_KEYS[dir]
    const dest = (fm as Record<string, unknown>)[keys.exit] as string | null
    if (dest !== null && dest !== undefined) {
      exits[dir] = dest
      const req = (fm as Record<string, unknown>)[keys.requires] as string | undefined
      const locked = (fm as Record<string, unknown>)[keys.locked] as string | undefined
      if (req !== undefined && locked === undefined) {
        throw new Error(`${sourcePath}: ${keys.requires} is set but ${keys.locked} is missing`)
      }
      if (locked !== undefined && req === undefined) {
        throw new Error(`${sourcePath}: ${keys.locked} is set but ${keys.requires} is missing`)
      }
      if (req !== undefined && locked !== undefined) {
        lockedExits[dir] = { requires: req, lockedNarration: locked }
      }
    }
  }

  const room: Room = {
    id: fm.id,
    title: fm.title,
    descriptions,
    exits,
    items: fm.items,
  }
  if (Object.keys(lockedExits).length > 0) room.lockedExits = lockedExits
  if (fm.encounter) room.encounter = fm.encounter
  if (fm.safe) room.safe = fm.safe
  return room
}

export function parseItem(raw: string, sourcePath: string): Item {
  const parsed = matter(raw)
  const frontmatter = stripWikilink(parsed.data) as Record<string, unknown>
  const fm = itemFrontmatterSchema.parse(frontmatter)
  const long = parsed.content.trim()
  if (long.length === 0) {
    throw new Error(`${sourcePath}: empty long description`)
  }
  return {
    id: fm.id,
    names: fm.names,
    short: fm.short,
    long,
    initialState: fm.initialState,
    takeable: fm.takeable,
  }
}
