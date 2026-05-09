import { parse as parseYaml } from 'yaml'

interface ParsedFile {
  data: Record<string, unknown>
  content: string
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

function matter(raw: string): ParsedFile {
  const match = raw.match(FRONTMATTER_RE)
  if (!match) {
    return { data: {}, content: raw }
  }
  const yamlSrc = match[1] ?? ''
  const content = match[2] ?? ''
  const parsed = parseYaml(yamlSrc)
  const data = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
  return { data, content }
}
import type { Room, RoomDescriptions, Item } from './types'
import type { Direction } from '../engine/types'
import { roomFrontmatterSchema, itemFrontmatterSchema, endingFrontmatterSchema, encounterFrontmatterSchema } from './schema'

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
  // First pass: detect ANY ## line that doesn't match the strict pattern.
  // Section names use only [a-zA-Z0-9_-]; headers with spaces or other characters
  // would silently fail without this check.
  const looseHeader = /^##[ \t]+(.+?)[ \t]*$/gm
  const strictHeader = /^([\w-]+)$/
  for (const m of body.matchAll(looseHeader)) {
    const headerText = m[1]!
    if (!strictHeader.test(headerText)) {
      throw new Error(
        `invalid section header "## ${headerText}": section names must contain only letters, digits, hyphens, and underscores`,
      )
    }
  }
  // Second pass: extract sections (re-runs strict regex; same result as before).
  const re = /^##\s+([\w-]+)\s*$/gm
  const matches = [...body.matchAll(re)]
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!
    const key = m[1]!
    const start = m.index! + m[0].length
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

export interface ParsedEnding {
  id: 'true' | 'wrong' | 'bad'
  ending: { whenFlags: Record<string, string | boolean | number>; narration: string }
}

export function parseEnding(raw: string, _sourcePath: string): ParsedEnding {
  const parsed = matter(raw)
  // YAML parses bare `true` as boolean; coerce id to string before schema validation.
  const data = { ...parsed.data, id: String(parsed.data.id) }
  const fm = endingFrontmatterSchema.parse(data)
  return {
    id: fm.id,
    ending: { whenFlags: fm.whenFlags, narration: parsed.content.trim() },
  }
}

export interface ParsedEncounterNarration {
  id: string
  startsIn: string
  initialPhase: string
  narrations: Record<string, string>
}

export function parseEncounterNarration(raw: string, sourcePath: string): ParsedEncounterNarration {
  const parsed = matter(raw)
  const frontmatter = stripWikilink(parsed.data) as Record<string, unknown>
  const fm = encounterFrontmatterSchema.parse(frontmatter)
  const narrations = splitSections(parsed.content)
  if (Object.keys(narrations).length === 0) {
    throw new Error(`${sourcePath}: no narration sections found`)
  }
  return {
    id: fm.id,
    startsIn: fm.startsIn,
    initialPhase: fm.initialPhase,
    narrations,
  }
}

const encounterNarrationRegistry = new Map<string, Map<string, string>>()

export function registerEncounterNarrations(docs: ParsedEncounterNarration[]): void {
  for (const doc of docs) {
    encounterNarrationRegistry.set(doc.id, new Map(Object.entries(doc.narrations)))
  }
}

export function _resetEncounterNarrationRegistry(autoReregister: boolean = false): void {
  encounterNarrationRegistry.clear()
  if (autoReregister) autoRegisterEncounters()
}

export function narration(encounterId: string, key: string): string {
  const map = encounterNarrationRegistry.get(encounterId)
  if (!map) {
    throw new Error(`narration(): unknown encounter id "${encounterId}"`)
  }
  const value = map.get(key)
  if (value === undefined) {
    const available = [...map.keys()].join(', ')
    throw new Error(
      `narration(): no matching section "## ${key}" for encounter "${encounterId}". Available: ${available}`,
    )
  }
  return value
}

// Auto-register encounter narrations from co-located markdown files at module init.
// This populates the registry BEFORE encounters.ts is evaluated (ESM evaluates dependencies first),
// so encounters.ts can call narration() at top level without explicit ordering.
// While src/mystery/world/encounters/ does not yet exist (Task 8 creates it), this is a no-op.
const _encounterFiles = import.meta.glob<string>('./encounters/*.md', {
  eager: true, query: '?raw', import: 'default',
})

function autoRegisterEncounters(): void {
  for (const [path, raw] of Object.entries(_encounterFiles)) {
    const doc = parseEncounterNarration(raw, path)
    encounterNarrationRegistry.set(doc.id, new Map(Object.entries(doc.narrations)))
  }
}

autoRegisterEncounters()
