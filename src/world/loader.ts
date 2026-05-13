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
import { DEFAULT_WORLD_MESSAGES, type DeclarativeAction, type EncounterDef, type Room, type RoomDescriptions, type Item, type WorldMessages } from './types'
import type { Direction } from '../engine/types'
import {
  gameFrontmatterSchema,
  actionFrontmatterSchema,
  lightMechanicFrontmatterSchema,
  parserFrontmatterSchema,
  resolveMechanicFrontmatterSchema,
  roomFrontmatterSchema,
  itemFrontmatterSchema,
  endingFrontmatterSchema,
  encounterFrontmatterSchema,
  uiFrontmatterSchema,
} from './schema'

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

const REQUIRED_GAME_SECTIONS = ['opening-art', 'help', 'ended'] as const

export function parseGame(raw: string, sourcePath: string) {
  const parsed = matter(raw)
  const frontmatter = stripWikilink(parsed.data) as Record<string, unknown>
  const fm = gameFrontmatterSchema.parse(frontmatter)
  const sections = splitSections(parsed.content)
  for (const key of REQUIRED_GAME_SECTIONS) {
    if (!(key in sections)) {
      throw new Error(`${sourcePath}: missing required section "## ${key}"`)
    }
  }

  return {
    id: fm.id,
    title: fm.title,
    description: fm.description,
    startingRoom: fm.startingRoom,
    startingInventory: fm.startingInventory,
    endingPriority: fm.endingPriority,
    transcriptCap: fm.transcriptCap,
    openingArt: sections['opening-art']!,
    helpText: sections['help']!,
    endedText: sections['ended']!,
  }
}

export function parseParser(raw: string, _sourcePath: string) {
  const parsed = matter(raw)
  const frontmatter = stripWikilink(parsed.data) as Record<string, unknown>
  return parserFrontmatterSchema.parse(frontmatter)
}

export function parseUi(raw: string, _sourcePath: string) {
  const parsed = matter(raw)
  const frontmatter = stripWikilink(parsed.data) as Record<string, unknown>
  return uiFrontmatterSchema.parse(frontmatter)
}

export function parseMessages(raw: string, sourcePath: string): WorldMessages {
  const parsed = matter(raw)
  const sections = splitSections(parsed.content)
  const allowed = Object.keys(DEFAULT_WORLD_MESSAGES)
  for (const key of Object.keys(sections)) {
    if (!allowed.includes(key)) {
      throw new Error(`${sourcePath}: unknown message section "## ${key}". Allowed: ${allowed.join(', ')}`)
    }
  }
  return sections as WorldMessages
}

const LIGHT_MESSAGE_KEYS = [
  'useLighterWithWhat',
  'cannotLight',
  'alreadyLit',
  'notHelpful',
  'spent',
  'noLighter',
  'cannotExtinguish',
  'notLit',
  'dropLit',
  'flameCatches',
  'flameDies',
] as const

export function parseLightMechanic(raw: string, sourcePath: string) {
  const parsed = matter(raw)
  const frontmatter = stripWikilink(parsed.data) as Record<string, unknown>
  const fm = lightMechanicFrontmatterSchema.parse(frontmatter)
  const sections = splitSections(parsed.content)
  for (const key of Object.keys(sections)) {
    if (!LIGHT_MESSAGE_KEYS.includes(key as typeof LIGHT_MESSAGE_KEYS[number])) {
      throw new Error(`${sourcePath}: unknown light mechanic section "## ${key}". Allowed: ${LIGHT_MESSAGE_KEYS.join(', ')}`)
    }
  }

  return {
    ...fm,
    messages: sections,
  }
}

export function parseResolveMechanic(raw: string, _sourcePath: string) {
  const parsed = matter(raw)
  const frontmatter = stripWikilink(parsed.data) as Record<string, unknown>
  return resolveMechanicFrontmatterSchema.parse(frontmatter)
}

const ACTION_SECTION_KEYS = ['success', 'spent', 'missingRequired', 'secretFoundPassOut', 'tooManyMovesPassOut', 'reset'] as const
type ActionSectionKey = typeof ACTION_SECTION_KEYS[number]
const ACTION_REQUIRED_SECTIONS: Record<NonNullable<DeclarativeAction['handler']> | 'default', ActionSectionKey[]> = {
  default: ['success'],
  'drunk-transition': ['success', 'secretFoundPassOut', 'tooManyMovesPassOut', 'reset'],
}

export function parseAction(raw: string, sourcePath: string): DeclarativeAction {
  const parsed = matter(raw)
  const frontmatter = stripWikilink(parsed.data) as Record<string, unknown>
  const fm = actionFrontmatterSchema.parse(frontmatter)
  const sections = splitSections(parsed.content)
  for (const key of Object.keys(sections)) {
    if (!ACTION_SECTION_KEYS.includes(key as ActionSectionKey)) {
      throw new Error(`${sourcePath}: unknown action section "## ${key}". Allowed: ${ACTION_SECTION_KEYS.join(', ')}`)
    }
  }
  const requiredSections = ACTION_REQUIRED_SECTIONS[fm.handler ?? 'default']
  for (const key of requiredSections) {
    if (!sections[key]) {
      const scope = fm.handler ? ` for handler "${fm.handler}"` : ''
      throw new Error(`${sourcePath}: missing required section "## ${key}"${scope}`)
    }
  }

  return {
    id: fm.id,
    verbs: fm.verbs,
    handler: fm.handler,
    requires: fm.requires,
    consumes: fm.consumes,
    decrements: fm.decrements,
    setsFlags: fm.setsFlags,
    drunkTransition: fm.drunkTransition,
    messages: {
      success: sections.success!,
      spent: sections.spent,
      missingRequired: sections.missingRequired,
      secretFoundPassOut: sections.secretFoundPassOut,
      tooManyMovesPassOut: sections.tooManyMovesPassOut,
      reset: sections.reset,
    },
  }
}

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

const ITEM_SECTION_KEYS = ['read', 'lit', 'extinguished', 'lighter-empty'] as const
type ItemSectionKey = typeof ITEM_SECTION_KEYS[number]

export function parseItem(raw: string, sourcePath: string): Item {
  const parsed = matter(raw)
  const frontmatter = stripWikilink(parsed.data) as Record<string, unknown>
  const fm = itemFrontmatterSchema.parse(frontmatter)

  // Split body into long-description prefix + sectioned remainder.
  // The first `## key` header (if any) marks the boundary.
  const body = parsed.content
  const firstHeader = body.match(/^##\s+[\w-]+\s*$/m)
  const longRaw = firstHeader ? body.slice(0, firstHeader.index!).trim() : body.trim()
  if (longRaw.length === 0) {
    throw new Error(`${sourcePath}: empty long description`)
  }
  const sections = firstHeader ? splitSections(body.slice(firstHeader.index!)) : {}

  // Validate that only known section keys appear.
  for (const key of Object.keys(sections)) {
    if (!ITEM_SECTION_KEYS.includes(key as ItemSectionKey)) {
      throw new Error(`${sourcePath}: unknown item section "## ${key}". Allowed: ${ITEM_SECTION_KEYS.join(', ')}`)
    }
  }

  if (fm.readable && !sections['read']) {
    throw new Error(`${sourcePath}: ## read section is required when readable: true`)
  }

  const item: Item = {
    id: fm.id,
    names: fm.names,
    short: fm.short,
    long: longRaw,
    initialState: fm.initialState,
    takeable: fm.takeable,
  }
  if (fm.readable !== undefined) item.readable = fm.readable
  if (fm.lightable !== undefined) item.lightable = fm.lightable
  if (fm.lighter !== undefined) item.lighter = fm.lighter
  if (fm.lighterUses !== undefined) item.lighterUses = fm.lighterUses
  if (sections['read']) item.readableText = sections['read']
  if (sections['lit']) item.litText = sections['lit']
  if (sections['extinguished']) item.extinguishedText = sections['extinguished']
  if (sections['lighter-empty']) item.lighterEmptyText = sections['lighter-empty']
  return item
}

export interface ParsedEnding {
  id: string
  ending: { whenFlags: Record<string, string | boolean | number | string[]>; narration: string }
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
  encounter?: EncounterDef
}

export function parseEncounterNarration(raw: string, sourcePath: string): ParsedEncounterNarration {
  const parsed = matter(raw)
  const frontmatter = stripWikilink(parsed.data) as Record<string, unknown>
  const fm = encounterFrontmatterSchema.parse(frontmatter)
  const narrations = splitSections(parsed.content)
  if (Object.keys(narrations).length === 0) {
    throw new Error(`${sourcePath}: no narration sections found`)
  }
  const encounter = fm.phases
    ? buildEncounterFromMarkdown(fm, narrations, sourcePath)
    : undefined

  return {
    id: fm.id,
    startsIn: fm.startsIn,
    initialPhase: fm.initialPhase,
    narrations,
    encounter,
  }
}

function proseSection(sections: Record<string, string>, key: string, sourcePath: string): string {
  const text = sections[key]
  if (text === undefined) {
    const available = Object.keys(sections).join(', ') || '(none)'
    throw new Error(`${sourcePath}: frontmatter references missing section "## ${key}". Available: ${available}`)
  }
  return text
}

function buildEncounterFromMarkdown(
  fm: ReturnType<typeof encounterFrontmatterSchema.parse>,
  sections: Record<string, string>,
  sourcePath: string,
): EncounterDef {
  const phases: EncounterDef['phases'] = {}
  for (const [phaseId, phase] of Object.entries(fm.phases ?? {})) {
    phases[phaseId] = {
      description: proseSection(sections, phase.description, sourcePath),
      transitions: phase.transitions.map((transition) => ({
        ...transition,
        narration: proseSection(sections, transition.narration, sourcePath),
      })),
    }
  }
  if (!phases[fm.initialPhase]) {
    throw new Error(`${sourcePath}: initialPhase "${fm.initialPhase}" is not defined in phases`)
  }

  const encounter: EncounterDef = {
    id: fm.id,
    startsIn: fm.startsIn,
    initialPhase: fm.initialPhase,
    phases,
  }
  if (fm.aliases) encounter.aliases = fm.aliases
  if (fm.onResolved) encounter.onResolved = fm.onResolved
  if (fm.onFailed) {
    encounter.onFailed = {
      narration: proseSection(sections, fm.onFailed.narration, sourcePath),
      retreatTo: fm.onFailed.retreatTo,
    }
  }
  if (fm.defaultWrongVerbNarration) {
    encounter.defaultWrongVerbNarration = proseSection(sections, fm.defaultWrongVerbNarration, sourcePath)
  }
  return encounter
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
// This keeps the narration() helper available for tests and any remaining
// TypeScript escape hatches that need to reference encounter prose by key.
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
