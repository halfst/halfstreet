# Mystery Markdown Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Halfstreet game content (rooms, items, encounter narration, endings) from TypeScript object literals to markdown files editable in Obsidian, with no behavioral change to the game.

**Architecture:** Markdown files live under `src/mystery/world/{rooms,items,encounters,endings}/`. Each file has YAML frontmatter for structural data (camelCase keys, wikilinks for cross-references) and section-headered prose body. A pure-string loader (`world/loader.ts`) parses one file at a time. `world/index.ts` discovers files via Vite's `import.meta.glob` (eager, raw query), assembles the typed `World` value with cross-reference validation, and exports it. Engine and tests keep importing `{ world } from '../world'` unchanged.

**Tech Stack:** TypeScript, Astro 6 (Vite under the hood), Vitest, gray-matter for frontmatter, Zod for runtime validation.

**Spec:** `docs/superpowers/specs/2026-05-09-mystery-markdown-migration-design.md`

---

## File Structure

**New files:**
- `src/mystery/world/schema.ts` — Zod schemas for Room, Item, EncounterNarrationDoc, Ending
- `src/mystery/world/loader.ts` — pure string-in / typed-object-out parsers, plus `narration()` helper and registry
- `src/mystery/world/loader.test.ts` — TDD coverage for loader
- `src/mystery/world/buildWorld.test.ts` — cross-reference validation tests
- `src/mystery/world/rooms/foyer.md`
- `src/mystery/world/rooms/hallway.md`
- `src/mystery/world/rooms/cellar-stair.md`
- `src/mystery/world/items/matches.md`
- `src/mystery/world/items/lamp.md`
- `src/mystery/world/items/letter.md`
- `src/mystery/world/encounters/rat.md`
- `src/mystery/world/endings/true.md`
- `src/mystery/world/endings/wrong.md`
- `src/mystery/world/endings/bad.md`
- `src/mystery/world/.obsidian/app.json` — minimal vault config
- `scripts/migrate-mystery-content.ts` — one-shot migration script (deleted after run, but committed once)

**Modified files:**
- `src/mystery/world/index.ts` — assemble World from markdown
- `src/mystery/world/encounters.ts` — use `narration()` references instead of inline strings
- `src/mystery/world/story.ts` — load endings prose from markdown
- `package.json` — add `gray-matter`, `zod` deps
- `.gitignore` — ignore Obsidian workspace cache

**Deleted files:**
- `src/mystery/world/rooms.ts`
- `src/mystery/world/items.ts`

**Unchanged files (verification only):**
- `src/mystery/world/types.ts`
- `src/mystery/engine/**` (all)
- `src/mystery/ui/**` (all)
- All existing test files

---

## Task 1: Setup — dependencies and raw markdown smoke test

**Files:**
- Modify: `package.json`
- Create: `src/mystery/world/__smoke__/smoke.md`
- Create: `src/mystery/world/__smoke__/smoke.test.ts`

Verify the technical approach works in this Astro+Vite+Vitest setup before building anything on top of it: can we (a) install gray-matter and zod, (b) load a markdown file's raw contents via `import.meta.glob` with `?raw` in a Vitest test? If either fails, we need to know now.

- [ ] **Step 1: Install dependencies**

```bash
npm install gray-matter zod
```

Expected: `package.json` updated with both deps; `package-lock.json` updated; no errors.

- [ ] **Step 2: Verify deps appear in package.json**

```bash
grep -E '"(gray-matter|zod)"' package.json
```

Expected: two lines, both with version specifiers.

- [ ] **Step 3: Create a smoke-test markdown fixture**

Create `src/mystery/world/__smoke__/smoke.md` with literally:

```md
---
id: smoke
---

## body
hello
```

- [ ] **Step 4: Create a smoke test that loads it raw and parses frontmatter**

Create `src/mystery/world/__smoke__/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import matter from 'gray-matter'

const files = import.meta.glob<string>('./*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

describe('raw markdown smoke test', () => {
  it('loads the smoke file as a raw string', () => {
    const entries = Object.entries(files)
    expect(entries.length).toBe(1)
    const [, raw] = entries[0]
    expect(typeof raw).toBe('string')
    expect(raw).toContain('## body')
  })

  it('parses frontmatter with gray-matter', () => {
    const [, raw] = Object.entries(files)[0]
    const parsed = matter(raw)
    expect(parsed.data).toEqual({ id: 'smoke' })
    expect(parsed.content.trim().startsWith('## body')).toBe(true)
  })
})
```

- [ ] **Step 5: Run the smoke test**

```bash
npm test -- src/mystery/world/__smoke__/smoke.test.ts
```

Expected: PASS (2 tests). If FAIL, stop and report the error before proceeding — the architecture needs revision.

- [ ] **Step 6: Delete the smoke test directory**

```bash
rm -rf src/mystery/world/__smoke__
```

Smoke test was a one-off verification; the real loader tests come in later tasks.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(mystery): add gray-matter and zod for markdown content pipeline"
```

---

## Task 2: Zod schemas for content shapes

**Files:**
- Create: `src/mystery/world/schema.ts`
- Test: `src/mystery/world/schema.test.ts`

Zod schemas validate parsed content at runtime. Field names match the existing TypeScript shapes (camelCase). Schemas accept the *post-wikilink-stripped* form, since the loader strips `[[ ]]` before validating.

- [ ] **Step 1: Write failing tests**

Create `src/mystery/world/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { roomFrontmatterSchema, itemFrontmatterSchema, endingFrontmatterSchema, encounterFrontmatterSchema } from './schema'

describe('roomFrontmatterSchema', () => {
  it('accepts a fully populated room', () => {
    const data = {
      id: 'foyer',
      title: '[ Foyer ]',
      exitN: 'hallway',
      exitS: null,
      exitE: null,
      exitW: null,
      exitU: null,
      exitD: null,
      items: ['letter'],
      encounter: null,
      safe: true,
    }
    expect(() => roomFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('accepts a locked exit with sibling fields', () => {
    const data = {
      id: 'hall',
      title: '[ Hall ]',
      exitN: null, exitS: null, exitE: null, exitW: null, exitU: null,
      exitD: 'vault',
      exitDRequires: 'rusted-key',
      exitDLockedText: 'The door is locked.',
      items: [],
    }
    expect(() => roomFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('rejects a room missing a required exit field', () => {
    const data = { id: 'r', title: '[ R ]', exitN: null, items: [] }
    expect(() => roomFrontmatterSchema.parse(data)).toThrow()
  })
})

describe('itemFrontmatterSchema', () => {
  it('accepts an item with state', () => {
    const data = {
      id: 'lamp',
      names: ['lamp', 'oil lamp'],
      short: 'an oil lamp',
      takeable: true,
      initialState: { lit: false },
    }
    expect(() => itemFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('accepts an item without state (defaults to {})', () => {
    const parsed = itemFrontmatterSchema.parse({
      id: 'letter',
      names: ['letter'],
      short: 'a letter',
      takeable: true,
    })
    expect(parsed.initialState).toEqual({})
  })
})

describe('endingFrontmatterSchema', () => {
  it('accepts true ending shape', () => {
    const data = { id: 'true', whenFlags: { ratGone: true } }
    expect(() => endingFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('rejects unknown ending id', () => {
    const data = { id: 'mercy', whenFlags: {} }
    expect(() => endingFrontmatterSchema.parse(data)).toThrow()
  })
})

describe('encounterFrontmatterSchema', () => {
  it('accepts an encounter narration doc', () => {
    const data = { id: 'rat', startsIn: 'cellar-stair', initialPhase: 'lurking' }
    expect(() => encounterFrontmatterSchema.parse(data)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/mystery/world/schema.test.ts
```

Expected: FAIL — module `./schema` does not exist.

- [ ] **Step 3: Write the schemas**

Create `src/mystery/world/schema.ts`:

```ts
import { z } from 'zod'

const stateValueSchema = z.union([z.string(), z.boolean(), z.number()])
const stateRecordSchema = z.record(z.string(), stateValueSchema)

export const roomFrontmatterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  exitN: z.string().nullable(),
  exitS: z.string().nullable(),
  exitE: z.string().nullable(),
  exitW: z.string().nullable(),
  exitU: z.string().nullable(),
  exitD: z.string().nullable(),
  exitNRequires: z.string().optional(),
  exitNLockedText: z.string().optional(),
  exitSRequires: z.string().optional(),
  exitSLockedText: z.string().optional(),
  exitERequires: z.string().optional(),
  exitELockedText: z.string().optional(),
  exitWRequires: z.string().optional(),
  exitWLockedText: z.string().optional(),
  exitURequires: z.string().optional(),
  exitULockedText: z.string().optional(),
  exitDRequires: z.string().optional(),
  exitDLockedText: z.string().optional(),
  items: z.array(z.string()).default([]),
  encounter: z.string().nullable().optional(),
  safe: z.boolean().optional(),
})

export type RoomFrontmatter = z.infer<typeof roomFrontmatterSchema>

export const itemFrontmatterSchema = z.object({
  id: z.string().min(1),
  names: z.array(z.string().min(1)).min(1),
  short: z.string().min(1),
  takeable: z.boolean(),
  initialState: stateRecordSchema.default({}),
})

export type ItemFrontmatter = z.infer<typeof itemFrontmatterSchema>

export const endingFrontmatterSchema = z.object({
  id: z.enum(['true', 'wrong', 'bad']),
  whenFlags: stateRecordSchema.default({}),
})

export type EndingFrontmatter = z.infer<typeof endingFrontmatterSchema>

export const encounterFrontmatterSchema = z.object({
  id: z.string().min(1),
  startsIn: z.string().min(1),
  initialPhase: z.string().min(1),
})

export type EncounterFrontmatter = z.infer<typeof encounterFrontmatterSchema>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/mystery/world/schema.test.ts
```

Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/mystery/world/schema.ts src/mystery/world/schema.test.ts
git commit -m "feat(mystery): add Zod schemas for markdown frontmatter"
```

---

## Task 3: parseRoom — markdown string to typed Room

**Files:**
- Create: `src/mystery/world/loader.ts`
- Create: `src/mystery/world/loader.test.ts`

Pure function: `(rawMarkdown, sourcePath) → Room`. Parses frontmatter, strips wikilinks, splits sections by `## key` headers, validates with Zod, assembles into a `Room` matching `world/types.ts`.

The `Room.descriptions` shape (`firstVisit`, `revisit`, `examined`) requires us to map section keys: markdown `## first-visit` → TS `firstVisit`. Hyphen-to-camel for the three required sections.

The `Room.exits` shape is the existing `Partial<Record<Direction, RoomId>>`. Frontmatter has six flat fields; we collapse them into the existing nested shape on parse.

The `Room.lockedExits` shape similarly collapses sibling fields.

- [ ] **Step 1: Write failing tests**

Create `src/mystery/world/loader.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseRoom } from './loader'

const FOYER_MD = `---
id: foyer
title: "[ Foyer ]"
exitN: "[[hallway]]"
exitS: null
exitE: null
exitW: null
exitU: null
exitD: null
items:
  - "[[letter]]"
encounter: null
safe: true
---

## first-visit
You stand in the foyer. A folded letter lies on a table.

A hallway leads north.

## revisit
The foyer.

## examined
A foyer with peeling paper.
`

describe('parseRoom', () => {
  it('parses frontmatter and strips wikilinks', () => {
    const room = parseRoom(FOYER_MD, 'rooms/foyer.md')
    expect(room.id).toBe('foyer')
    expect(room.title).toBe('[ Foyer ]')
    expect(room.exits).toEqual({ n: 'hallway' })
    expect(room.items).toEqual(['letter'])
    expect(room.safe).toBe(true)
    expect(room.encounter).toBeUndefined()
  })

  it('captures all three description sections with multi-paragraph prose', () => {
    const room = parseRoom(FOYER_MD, 'rooms/foyer.md')
    expect(room.descriptions.firstVisit).toBe(
      'You stand in the foyer. A folded letter lies on a table.\n\nA hallway leads north.',
    )
    expect(room.descriptions.revisit).toBe('The foyer.')
    expect(room.descriptions.examined).toBe('A foyer with peeling paper.')
  })

  it('throws when a required section is missing', () => {
    const incomplete = FOYER_MD.replace('## examined\nA foyer with peeling paper.\n', '')
    expect(() => parseRoom(incomplete, 'rooms/foyer.md')).toThrow(/missing required section.*examined/i)
  })

  it('throws on malformed frontmatter', () => {
    expect(() => parseRoom('## first-visit\nhi', 'rooms/x.md')).toThrow()
  })

  it('parses a locked exit into lockedExits', () => {
    const md = `---
id: r
title: "[ R ]"
exitN: null
exitS: null
exitE: null
exitW: null
exitU: null
exitD: "[[vault]]"
exitDRequires: "[[rusted-key]]"
exitDLockedText: The door is locked.
items: []
---

## first-visit
.
## revisit
.
## examined
.
`
    const room = parseRoom(md, 'rooms/r.md')
    expect(room.exits).toEqual({ d: 'vault' })
    expect(room.lockedExits).toEqual({
      d: { requires: 'rusted-key', lockedNarration: 'The door is locked.' },
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/mystery/world/loader.test.ts
```

Expected: FAIL — module `./loader` does not export `parseRoom`.

- [ ] **Step 3: Implement parseRoom**

Create `src/mystery/world/loader.ts`:

```ts
import matter from 'gray-matter'
import type { Room, RoomDescriptions } from './types'
import type { Direction } from '../engine/types'
import { roomFrontmatterSchema } from './schema'

const WIKILINK = /^\[\[(.+)\]\]$/

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
  const re = /^##\s+([\w-]+)\s*$/gm
  const matches = [...body.matchAll(re)]
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const key = m[1]
    const start = m.index! + m[0].length
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length
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
    firstVisit: sections['first-visit'],
    revisit: sections['revisit'],
    examined: sections['examined'],
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
      if (req !== undefined) {
        if (locked === undefined) {
          throw new Error(`${sourcePath}: ${keys.requires} is set but ${keys.locked} is missing`)
        }
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/mystery/world/loader.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/mystery/world/loader.ts src/mystery/world/loader.test.ts
git commit -m "feat(mystery): parseRoom — markdown to typed Room"
```

---

## Task 4: parseItem — markdown string to typed Item

**Files:**
- Modify: `src/mystery/world/loader.ts`
- Modify: `src/mystery/world/loader.test.ts`

Item markdown has `short` in frontmatter and the *long* description as the entire body (no section headers). Frontmatter holds `names`, `takeable`, `initialState`.

- [ ] **Step 1: Append failing tests to loader.test.ts**

Add to the bottom of `src/mystery/world/loader.test.ts`:

```ts
import { parseItem } from './loader'

const LAMP_MD = `---
id: lamp
names: [lamp, oil lamp, torch]
short: an oil lamp
takeable: true
initialState:
  lit: false
---

An iron oil lamp with a glass chimney. Currently unlit.
`

describe('parseItem', () => {
  it('parses an item with state', () => {
    const item = parseItem(LAMP_MD, 'items/lamp.md')
    expect(item).toEqual({
      id: 'lamp',
      names: ['lamp', 'oil lamp', 'torch'],
      short: 'an oil lamp',
      long: 'An iron oil lamp with a glass chimney. Currently unlit.',
      initialState: { lit: false },
      takeable: true,
    })
  })

  it('uses empty initialState when omitted', () => {
    const md = `---
id: x
names: [x]
short: x
takeable: false
---

The long description.
`
    const item = parseItem(md, 'items/x.md')
    expect(item.initialState).toEqual({})
  })

  it('throws when body is empty', () => {
    const md = `---
id: x
names: [x]
short: x
takeable: false
---
`
    expect(() => parseItem(md, 'items/x.md')).toThrow(/empty long description/i)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/mystery/world/loader.test.ts
```

Expected: FAIL — `parseItem` is not exported.

- [ ] **Step 3: Append parseItem to loader.ts**

Add to `src/mystery/world/loader.ts`:

```ts
import type { Item } from './types'
import { itemFrontmatterSchema } from './schema'

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
```

(Merge the new `import` lines with the existing imports at the top of the file.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/mystery/world/loader.test.ts
```

Expected: PASS (8 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/mystery/world/loader.ts src/mystery/world/loader.test.ts
git commit -m "feat(mystery): parseItem — markdown to typed Item"
```

---

## Task 5: parseEnding — markdown string to typed Ending

**Files:**
- Modify: `src/mystery/world/loader.ts`
- Modify: `src/mystery/world/loader.test.ts`

Ending markdown has `id` and `whenFlags` in frontmatter; the body is the narration prose. The `World['endings']` type is `{ true: {...}, wrong: {...}, bad: {...} }` where each entry has `whenFlags` and `narration`. `parseEnding` returns `{ id, ending: { whenFlags, narration } }` so the assembler can build the keyed record.

- [ ] **Step 1: Append failing tests**

Add to `src/mystery/world/loader.test.ts`:

```ts
import { parseEnding } from './loader'

const TRUE_ENDING_MD = `---
id: true
whenFlags:
  ratGone: true
---

You stand at the top of the stair. The thing below has settled.

The door behind you opens, and outside, finally, is morning.
`

describe('parseEnding', () => {
  it('parses an ending with flags and prose', () => {
    const result = parseEnding(TRUE_ENDING_MD, 'endings/true.md')
    expect(result.id).toBe('true')
    expect(result.ending.whenFlags).toEqual({ ratGone: true })
    expect(result.ending.narration).toBe(
      'You stand at the top of the stair. The thing below has settled.\n\nThe door behind you opens, and outside, finally, is morning.',
    )
  })

  it('accepts an empty body (unreachable ending stub)', () => {
    const md = `---
id: wrong
whenFlags: {}
---
`
    const result = parseEnding(md, 'endings/wrong.md')
    expect(result.ending.narration).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/mystery/world/loader.test.ts
```

Expected: FAIL — `parseEnding` is not exported.

- [ ] **Step 3: Append parseEnding to loader.ts**

```ts
import { endingFrontmatterSchema } from './schema'

export interface ParsedEnding {
  id: 'true' | 'wrong' | 'bad'
  ending: { whenFlags: Record<string, string | boolean | number>; narration: string }
}

export function parseEnding(raw: string, sourcePath: string): ParsedEnding {
  const parsed = matter(raw)
  const fm = endingFrontmatterSchema.parse(parsed.data)
  return {
    id: fm.id,
    ending: { whenFlags: fm.whenFlags, narration: parsed.content.trim() },
  }
}
```

(Merge schema import with existing imports.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/mystery/world/loader.test.ts
```

Expected: PASS (10 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/mystery/world/loader.ts src/mystery/world/loader.test.ts
git commit -m "feat(mystery): parseEnding — markdown to typed Ending"
```

---

## Task 6: parseEncounterNarration — markdown string to phase/transition narration map

**Files:**
- Modify: `src/mystery/world/loader.ts`
- Modify: `src/mystery/world/loader.test.ts`

Encounter markdown holds *only* prose — phase descriptions and transition narrations. The state machine stays in TypeScript. The body has `## key` sections. Each section's prose is a narration string keyed by header text.

`parseEncounterNarration(raw, sourcePath)` returns `{ id, startsIn, initialPhase, narrations: Record<string, string> }`.

- [ ] **Step 1: Append failing tests**

```ts
import { parseEncounterNarration } from './loader'

const RAT_MD = `---
id: rat
startsIn: "[[cellar-stair]]"
initialPhase: lurking
---

## lurking
A heavy rat watches you from the third step. Its eyes catch the light.

## attack-resolved
You stamp. The rat squeals and is gone into the dark.

## wait-stays
The rat does not move. Neither do you.
`

describe('parseEncounterNarration', () => {
  it('parses frontmatter and narration sections', () => {
    const doc = parseEncounterNarration(RAT_MD, 'encounters/rat.md')
    expect(doc.id).toBe('rat')
    expect(doc.startsIn).toBe('cellar-stair')
    expect(doc.initialPhase).toBe('lurking')
    expect(doc.narrations).toEqual({
      lurking: 'A heavy rat watches you from the third step. Its eyes catch the light.',
      'attack-resolved': 'You stamp. The rat squeals and is gone into the dark.',
      'wait-stays': 'The rat does not move. Neither do you.',
    })
  })

  it('throws when no sections are present', () => {
    const md = `---
id: x
startsIn: room
initialPhase: p
---
`
    expect(() => parseEncounterNarration(md, 'encounters/x.md')).toThrow(/no narration sections/i)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/mystery/world/loader.test.ts
```

Expected: FAIL — `parseEncounterNarration` not exported.

- [ ] **Step 3: Append parseEncounterNarration to loader.ts**

```ts
import { encounterFrontmatterSchema } from './schema'

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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/mystery/world/loader.test.ts
```

Expected: PASS (12 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/mystery/world/loader.ts src/mystery/world/loader.test.ts
git commit -m "feat(mystery): parseEncounterNarration — phase and transition prose"
```

---

## Task 7: narration() helper and registry

**Files:**
- Modify: `src/mystery/world/loader.ts`
- Modify: `src/mystery/world/loader.test.ts`

`encounters.ts` will reference narration like `narration('rat', 'attack-resolved')` and get back the prose string. The helper looks up a registry that the world index initializes from parsed encounter docs.

The registry is a module-level `Map<string, Map<string, string>>` populated by `registerEncounterNarrations(docs)`. `narration(id, key)` reads from it. Throws if the encounter or key is missing, with available keys listed.

- [ ] **Step 1: Append failing tests**

```ts
import { narration, registerEncounterNarrations, _resetEncounterNarrationRegistry } from './loader'

describe('narration registry', () => {
  beforeEach(() => {
    _resetEncounterNarrationRegistry()
  })

  it('returns prose for a registered encounter and key', () => {
    registerEncounterNarrations([
      { id: 'rat', startsIn: 'cellar-stair', initialPhase: 'lurking', narrations: { lurking: 'watches' } },
    ])
    expect(narration('rat', 'lurking')).toBe('watches')
  })

  it('throws with available keys when key is missing', () => {
    registerEncounterNarrations([
      { id: 'rat', startsIn: 'cellar-stair', initialPhase: 'lurking', narrations: { lurking: 'a', resolved: 'b' } },
    ])
    expect(() => narration('rat', 'sleping')).toThrow(/no matching section.*Available: lurking, resolved/i)
  })

  it('throws when encounter is unknown', () => {
    expect(() => narration('ghost', 'whatever')).toThrow(/unknown encounter id "ghost"/i)
  })
})
```

(Add `import { beforeEach } from 'vitest'` to the existing vitest import line.)

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/mystery/world/loader.test.ts
```

Expected: FAIL — none of the registry exports exist yet.

- [ ] **Step 3: Append registry and auto-registration to loader.ts**

```ts
const encounterNarrationRegistry = new Map<string, Map<string, string>>()

export function registerEncounterNarrations(docs: ParsedEncounterNarration[]): void {
  for (const doc of docs) {
    encounterNarrationRegistry.set(doc.id, new Map(Object.entries(doc.narrations)))
  }
}

export function _resetEncounterNarrationRegistry(): void {
  encounterNarrationRegistry.clear()
  autoRegisterEncounters()
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
```

**Note on `_resetEncounterNarrationRegistry`:** it both clears manually-registered test data AND re-runs the auto-registration. Tests that want a fully empty registry should call `encounterNarrationRegistry.clear()` directly via the registry's escape hatch — but no current test needs this. The reset-then-auto-reregister behavior keeps tests close to production state.

For the existing Task 7 tests to still pass after auto-registration is added, `_resetEncounterNarrationRegistry` must produce an empty registry from the test's perspective. Adjust the implementation to take an optional flag:

```ts
export function _resetEncounterNarrationRegistry(autoReregister: boolean = false): void {
  encounterNarrationRegistry.clear()
  if (autoReregister) autoRegisterEncounters()
}
```

The Task 7 tests pass no argument, getting a clean registry. World assembly tests can pass `true` to reset to production state. (No test currently does this; the option exists for future use.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/mystery/world/loader.test.ts
```

Expected: PASS (15 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/mystery/world/loader.ts src/mystery/world/loader.test.ts
git commit -m "feat(mystery): narration() helper and encounter narration registry"
```

---

## Task 8: Migration script

**Files:**
- Create: `scripts/migrate-mystery-content.ts`

One-shot script. Reads existing world data, writes markdown files to `src/mystery/world/{rooms,items,encounters,endings}/`. Run with `npx tsx scripts/migrate-mystery-content.ts` (or `node --import tsx/esm` depending on setup; verify in step 2).

The script must produce byte-identical prose strings — the migration's correctness depends on this.

For the encounter, the script invents narration *keys* for each transition:

- `'attack' → 'resolved'` becomes key `attack-resolved`
- `'wait' → 'lurking'` becomes key `wait-stays` (loop back to same phase; we use `stays` to disambiguate from a hypothetical `wait-resolved`)
- Phase descriptions use the phase name as the key (e.g. `lurking`)

The script logs each file it writes; a no-op rerun is acceptable (it overwrites with identical content).

- [ ] **Step 1: Write the script**

Create `scripts/migrate-mystery-content.ts`:

```ts
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { rooms } from '../src/mystery/world/rooms'
import { items } from '../src/mystery/world/items'
import { encounters } from '../src/mystery/world/encounters'
import { endings } from '../src/mystery/world/story'
import type { Direction } from '../src/mystery/engine/types'

const ROOT = resolve(process.cwd(), 'src/mystery/world')
const DIRS: Direction[] = ['n', 's', 'e', 'w', 'u', 'd']
const DIR_FIELD: Record<Direction, string> = { n: 'N', s: 'S', e: 'E', w: 'W', u: 'U', d: 'D' }

function write(path: string, content: string): void {
  const abs = resolve(ROOT, path)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content, 'utf8')
  console.log(`wrote ${path}`)
}

function wikilink(id: string): string {
  return `"[[${id}]]"`
}

function yamlList(items: string[]): string {
  if (items.length === 0) return '[]'
  return '\n' + items.map(s => `  - ${wikilink(s)}`).join('\n')
}

function emitRoom(room: typeof rooms[string]): string {
  const lines: string[] = []
  lines.push('---')
  lines.push(`id: ${room.id}`)
  lines.push(`title: "${room.title}"`)
  for (const dir of DIRS) {
    const dest = room.exits[dir]
    lines.push(`exit${DIR_FIELD[dir]}: ${dest ? wikilink(dest) : 'null'}`)
    const locked = room.lockedExits?.[dir]
    if (locked) {
      lines.push(`exit${DIR_FIELD[dir]}Requires: ${wikilink(locked.requires)}`)
      lines.push(`exit${DIR_FIELD[dir]}LockedText: ${JSON.stringify(locked.lockedNarration)}`)
    }
  }
  lines.push(`items:${yamlList(room.items)}`)
  lines.push(`encounter: ${room.encounter ? wikilink(room.encounter) : 'null'}`)
  if (room.safe) lines.push(`safe: true`)
  lines.push('---')
  lines.push('')
  lines.push('## first-visit')
  lines.push(room.descriptions.firstVisit)
  lines.push('')
  lines.push('## revisit')
  lines.push(room.descriptions.revisit)
  lines.push('')
  lines.push('## examined')
  lines.push(room.descriptions.examined)
  lines.push('')
  return lines.join('\n')
}

function emitItem(item: typeof items[string]): string {
  const lines: string[] = []
  lines.push('---')
  lines.push(`id: ${item.id}`)
  lines.push(`names: [${item.names.map(n => JSON.stringify(n)).join(', ')}]`)
  lines.push(`short: ${JSON.stringify(item.short)}`)
  lines.push(`takeable: ${item.takeable}`)
  if (Object.keys(item.initialState).length > 0) {
    lines.push('initialState:')
    for (const [k, v] of Object.entries(item.initialState)) {
      lines.push(`  ${k}: ${JSON.stringify(v)}`)
    }
  }
  lines.push('---')
  lines.push('')
  lines.push(item.long)
  lines.push('')
  return lines.join('\n')
}

function transitionKey(verb: string, target: string | undefined, to: string): string {
  // verb-resolved | verb-target-resolved | verb-stays | verb-target-newPhase
  const parts = [verb]
  if (target && target !== '*') parts.push(target)
  if (to === 'resolved') parts.push('resolved')
  else if (to === 'failed') parts.push('failed')
  else parts.push(to)
  return parts.join('-')
}

function emitEncounter(enc: typeof encounters[string]): { md: string; keyMap: Record<string, string> } {
  const lines: string[] = []
  lines.push('---')
  lines.push(`id: ${enc.id}`)
  lines.push(`startsIn: ${wikilink(enc.startsIn)}`)
  lines.push(`initialPhase: ${enc.initialPhase}`)
  lines.push('---')
  lines.push('')
  const keyMap: Record<string, string> = {}
  // Phase descriptions
  for (const [phaseName, phase] of Object.entries(enc.phases)) {
    lines.push(`## ${phaseName}`)
    lines.push(phase.description)
    lines.push('')
    keyMap[`phase:${phaseName}`] = phaseName
    for (const t of phase.transitions) {
      // Loop-back transitions (to === current phase) use a 'stays' suffix to disambiguate
      const effectiveTo = t.to === phaseName ? 'stays' : t.to
      const key = transitionKey(t.verb, t.target, effectiveTo)
      lines.push(`## ${key}`)
      lines.push(t.narration)
      lines.push('')
      keyMap[`transition:${phaseName}:${t.verb}:${t.target ?? ''}:${t.to}`] = key
    }
  }
  if (enc.onFailed?.narration) {
    const key = `failed`
    lines.push(`## ${key}`)
    lines.push(enc.onFailed.narration)
    lines.push('')
    keyMap['onFailed'] = key
  }
  return { md: lines.join('\n'), keyMap }
}

function emitEnding(id: string, e: { whenFlags: Record<string, unknown>; narration: string }): string {
  const lines: string[] = []
  lines.push('---')
  lines.push(`id: ${id}`)
  if (Object.keys(e.whenFlags).length === 0) {
    lines.push('whenFlags: {}')
  } else {
    lines.push('whenFlags:')
    for (const [k, v] of Object.entries(e.whenFlags)) {
      lines.push(`  ${k}: ${JSON.stringify(v)}`)
    }
  }
  lines.push('---')
  lines.push('')
  if (e.narration) lines.push(e.narration)
  lines.push('')
  return lines.join('\n')
}

// Run
for (const room of Object.values(rooms)) {
  write(`rooms/${room.id}.md`, emitRoom(room))
}
for (const item of Object.values(items)) {
  write(`items/${item.id}.md`, emitItem(item))
}
const encounterKeyMaps: Record<string, Record<string, string>> = {}
for (const enc of Object.values(encounters)) {
  const { md, keyMap } = emitEncounter(enc)
  write(`encounters/${enc.id}.md`, md)
  encounterKeyMaps[enc.id] = keyMap
}
for (const [id, e] of Object.entries(endings)) {
  write(`endings/${id}.md`, emitEnding(id, e))
}
console.log('\nEncounter key maps (use these in encounters.ts narration() calls):')
console.log(JSON.stringify(encounterKeyMaps, null, 2))
```

- [ ] **Step 2: Verify the script runs by checking package scripts and tsx availability**

The project uses `node >=22.12.0`. Node 22 supports `--experimental-strip-types` for direct `.ts` execution. Try that first:

```bash
node --experimental-strip-types scripts/migrate-mystery-content.ts
```

If that fails (e.g. missing tsx/ts-node and strip-types doesn't handle ESM imports of `.ts` from `src/`), install tsx as a dev dep and retry:

```bash
npm install --save-dev tsx
npx tsx scripts/migrate-mystery-content.ts
```

Expected output: a list of `wrote rooms/foyer.md` lines and an `Encounter key maps:` JSON block at the end. Save the JSON block — Task 11 needs it.

- [ ] **Step 3: Verify produced files exist**

```bash
ls src/mystery/world/rooms src/mystery/world/items src/mystery/world/encounters src/mystery/world/endings
```

Expected:
- `rooms/`: `foyer.md`, `hallway.md`, `cellar-stair.md`
- `items/`: `matches.md`, `lamp.md`, `letter.md`
- `encounters/`: `rat.md`
- `endings/`: `true.md`, `wrong.md`, `bad.md`

- [ ] **Step 4: Commit script and produced markdown**

```bash
git add scripts/migrate-mystery-content.ts \
  src/mystery/world/rooms \
  src/mystery/world/items \
  src/mystery/world/encounters \
  src/mystery/world/endings \
  package.json package-lock.json
git commit -m "feat(mystery): migration script and produced markdown content"
```

---

## Task 9: Round-trip verification — parse produced markdown back to objects

**Files:**
- Create: `src/mystery/world/roundtrip.test.ts`

Before wiring the markdown into the live world, prove the produced files round-trip correctly: parse each `.md` file with the new loader and verify the result deep-equals the original TypeScript data. If this passes, the migration is byte-correct and we can safely cut over.

- [ ] **Step 1: Write the round-trip test**

Create `src/mystery/world/roundtrip.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseRoom, parseItem, parseEnding, parseEncounterNarration } from './loader'
import { rooms } from './rooms'
import { items } from './items'
import { encounters } from './encounters'
import { endings } from './story'

const roomFiles = import.meta.glob<string>('./rooms/*.md', {
  eager: true, query: '?raw', import: 'default',
})
const itemFiles = import.meta.glob<string>('./items/*.md', {
  eager: true, query: '?raw', import: 'default',
})
const endingFiles = import.meta.glob<string>('./endings/*.md', {
  eager: true, query: '?raw', import: 'default',
})
const encounterFiles = import.meta.glob<string>('./encounters/*.md', {
  eager: true, query: '?raw', import: 'default',
})

describe('round-trip: rooms', () => {
  it('parses each room file back to the original Room', () => {
    for (const [path, raw] of Object.entries(roomFiles)) {
      const parsed = parseRoom(raw, path)
      const original = rooms[parsed.id]
      expect(original, `room ${parsed.id} missing in source TS`).toBeDefined()
      expect(parsed).toEqual(original)
    }
  })
})

describe('round-trip: items', () => {
  it('parses each item file back to the original Item', () => {
    for (const [path, raw] of Object.entries(itemFiles)) {
      const parsed = parseItem(raw, path)
      const original = items[parsed.id]
      expect(original, `item ${parsed.id} missing in source TS`).toBeDefined()
      expect(parsed).toEqual(original)
    }
  })
})

describe('round-trip: endings', () => {
  it('parses each ending file back to the original ending', () => {
    for (const [path, raw] of Object.entries(endingFiles)) {
      const { id, ending } = parseEnding(raw, path)
      const original = endings[id]
      expect(ending.whenFlags).toEqual(original.whenFlags)
      expect(ending.narration).toEqual(original.narration)
    }
  })
})

describe('round-trip: encounters narration', () => {
  it('captures every inline narration string', () => {
    for (const [path, raw] of Object.entries(encounterFiles)) {
      const doc = parseEncounterNarration(raw, path)
      const original = encounters[doc.id]
      expect(original).toBeDefined()
      // Phase descriptions
      for (const [phaseName, phase] of Object.entries(original.phases)) {
        expect(doc.narrations[phaseName], `phase ${phaseName} narration missing`).toBe(phase.description)
      }
      // Transition narrations: every original narration string must appear somewhere in doc.narrations.values()
      const allNarrations = new Set(Object.values(doc.narrations))
      for (const phase of Object.values(original.phases)) {
        for (const t of phase.transitions) {
          expect(allNarrations.has(t.narration), `transition narration missing: "${t.narration}"`).toBe(true)
        }
      }
    }
  })
})
```

- [ ] **Step 2: Run the test**

```bash
npm test -- src/mystery/world/roundtrip.test.ts
```

Expected: PASS (4 tests). If anything fails, the migration script (Task 8) has a bug — fix it there, regenerate the markdown, and re-run.

- [ ] **Step 3: Commit**

```bash
git add src/mystery/world/roundtrip.test.ts
git commit -m "test(mystery): round-trip verification of migrated markdown"
```

---

## Task 10: Switch world/index.ts to assemble from markdown

**Files:**
- Modify: `src/mystery/world/index.ts`
- Create: `src/mystery/world/buildWorld.test.ts`
- Delete: `src/mystery/world/rooms.ts`
- Delete: `src/mystery/world/items.ts`
- Delete: `src/mystery/world/roundtrip.test.ts` (no longer meaningful once `rooms.ts`/`items.ts` are gone)

The index now uses `import.meta.glob` to load markdown files, parses each, registers encounter narrations, validates cross-references, and exposes `world` with the existing `World` shape.

The endings narrations come from markdown but the TS `endings` export retains its current shape (the engine reads `world.endings.true.narration` as a string). We override the narrations on the existing `endings` object using `parseEnding` outputs.

The encounters export keeps its TS state machine shape (Task 11 adds `narration()` calls); for now, the index continues to import `encounters` from `./encounters.ts` as-is. The `narration()` registry must be initialized *before* `encounters.ts` is evaluated. Achieve this by initializing the registry at the top of `index.ts` and importing `encounters` lazily (after registration).

Cross-reference validation runs at module load. If any check fails, the import throws — Vite's HMR overlay shows the error in dev; CI fails on the test suite.

- [ ] **Step 1: Write cross-reference validation tests**

Create `src/mystery/world/buildWorld.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { world } from './index'

describe('assembled world', () => {
  it('contains all three rooms', () => {
    expect(Object.keys(world.rooms).sort()).toEqual(['cellar-stair', 'foyer', 'hallway'])
  })

  it('contains all three items', () => {
    expect(Object.keys(world.items).sort()).toEqual(['lamp', 'letter', 'matches'])
  })

  it('all room exits resolve to known rooms', () => {
    for (const room of Object.values(world.rooms)) {
      for (const dest of Object.values(room.exits)) {
        expect(world.rooms[dest], `${room.id} → ${dest}`).toBeDefined()
      }
    }
  })

  it('all room item refs resolve to known items', () => {
    for (const room of Object.values(world.rooms)) {
      for (const itemId of room.items) {
        expect(world.items[itemId], `${room.id} item ${itemId}`).toBeDefined()
      }
    }
  })

  it('all room encounter refs resolve to known encounters', () => {
    for (const room of Object.values(world.rooms)) {
      if (room.encounter) {
        expect(world.encounters[room.encounter]).toBeDefined()
      }
    }
  })

  it('startingRoom is a known room', () => {
    expect(world.rooms[world.startingRoom]).toBeDefined()
  })

  it('startingInventory items are known', () => {
    for (const itemId of world.startingInventory) {
      expect(world.items[itemId]).toBeDefined()
    }
  })

  it('endings have non-empty narration where the original did', () => {
    expect(world.endings.true.narration.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails (or passes for wrong reasons)**

```bash
npm test -- src/mystery/world/buildWorld.test.ts
```

Expected: PASS — the existing world (loaded via TS data) already satisfies these. The test exists to lock in correctness for the post-migration assembly.

- [ ] **Step 3: Replace src/mystery/world/index.ts**

```ts
import type { World, Room, Item } from './types'
import {
  parseRoom,
  parseItem,
  parseEnding,
  parseEncounterNarration,
} from './loader'
// Importing loader (above) triggers auto-registration of encounter narrations.
// ESM evaluates dependencies first, so by the time encounters.ts is evaluated below,
// narration() can resolve all keys.
import { encounters } from './encounters'

const roomFiles = import.meta.glob<string>('./rooms/*.md', {
  eager: true, query: '?raw', import: 'default',
})
const itemFiles = import.meta.glob<string>('./items/*.md', {
  eager: true, query: '?raw', import: 'default',
})
const endingFiles = import.meta.glob<string>('./endings/*.md', {
  eager: true, query: '?raw', import: 'default',
})
const encounterFiles = import.meta.glob<string>('./encounters/*.md', {
  eager: true, query: '?raw', import: 'default',
})

// Re-parse encounter docs here so we can validate startsIn / initialPhase against encounters.ts
// (the loader already auto-registered narrations from these same files).
const encounterDocs = Object.entries(encounterFiles).map(([path, raw]) =>
  parseEncounterNarration(raw, path),
)

// Build rooms map.
const rooms: Record<string, Room> = {}
for (const [path, raw] of Object.entries(roomFiles)) {
  const room = parseRoom(raw, path)
  if (rooms[room.id]) throw new Error(`${path}: duplicate room id "${room.id}"`)
  rooms[room.id] = room
}

// Build items map.
const items: Record<string, Item> = {}
for (const [path, raw] of Object.entries(itemFiles)) {
  const item = parseItem(raw, path)
  if (items[item.id]) throw new Error(`${path}: duplicate item id "${item.id}"`)
  items[item.id] = item
}

// Build endings.
const endings = {
  true: { whenFlags: {} as Record<string, string | boolean | number>, narration: '' },
  wrong: { whenFlags: {} as Record<string, string | boolean | number>, narration: '' },
  bad: { whenFlags: {} as Record<string, string | boolean | number>, narration: '' },
}
for (const [path, raw] of Object.entries(endingFiles)) {
  const { id, ending } = parseEnding(raw, path)
  endings[id] = ending
}

// Cross-reference validation.
for (const room of Object.values(rooms)) {
  for (const [dir, dest] of Object.entries(room.exits)) {
    if (!rooms[dest!]) {
      throw new Error(`rooms/${room.id}.md: exit${dir.toUpperCase()} references "${dest}" but no such room exists.`)
    }
  }
  for (const itemId of room.items) {
    if (!items[itemId]) {
      throw new Error(`rooms/${room.id}.md: items[] references unknown item "${itemId}"`)
    }
  }
  if (room.encounter && !encounters[room.encounter]) {
    throw new Error(`rooms/${room.id}.md: encounter "${room.encounter}" is not defined`)
  }
  if (room.lockedExits) {
    for (const [, lock] of Object.entries(room.lockedExits)) {
      // requires may be an item id or a flag name; only validate if it matches a known item shape
      // (flag names cannot be cross-checked here without a flag registry; left as future work)
      if (items[lock.requires] === undefined) {
        // Not a known item — assume flag name. Skip.
      }
    }
  }
}

// Validate encounter narration registry: every encounter in TS has a markdown doc.
for (const enc of Object.values(encounters)) {
  const doc = encounterDocs.find(d => d.id === enc.id)
  if (!doc) {
    throw new Error(`encounters/${enc.id}.md: missing narration markdown for encounter "${enc.id}"`)
  }
  if (doc.startsIn !== enc.startsIn) {
    throw new Error(`encounters/${enc.id}.md: startsIn "${doc.startsIn}" does not match encounters.ts "${enc.startsIn}"`)
  }
  if (doc.initialPhase !== enc.initialPhase) {
    throw new Error(`encounters/${enc.id}.md: initialPhase "${doc.initialPhase}" does not match encounters.ts "${enc.initialPhase}"`)
  }
}

export const world: World = {
  startingRoom: 'foyer',
  startingInventory: ['matches'],
  rooms,
  items,
  encounters,
  endings,
}
```

- [ ] **Step 4: Delete obsolete data files**

```bash
rm src/mystery/world/rooms.ts src/mystery/world/items.ts src/mystery/world/roundtrip.test.ts
```

The round-trip test referenced the deleted modules; its job is done.

- [ ] **Step 5: Run all mystery tests**

```bash
npm test -- src/mystery
```

Expected: PASS for all suites (`buildWorld`, `loader`, `schema`, plus the existing `playthrough`, `chips`, `dispatcher`, `encounters` tests). If any existing test fails, the world assembly has drifted from the original — investigate before committing.

- [ ] **Step 6: Run astro check (type safety)**

```bash
npm run build
```

Expected: build succeeds. If type errors surface, fix them before committing.

- [ ] **Step 7: Commit**

```bash
git add src/mystery/world/index.ts src/mystery/world/buildWorld.test.ts
git rm src/mystery/world/rooms.ts src/mystery/world/items.ts src/mystery/world/roundtrip.test.ts
git commit -m "feat(mystery): assemble World from markdown via import.meta.glob"
```

---

## Task 11: Refactor encounters.ts to use narration() helper

**Files:**
- Modify: `src/mystery/world/encounters.ts`

Replace inline narration strings with `narration('rat', 'key')` calls. The keys come from the migration script's output JSON (printed in Task 8 step 2). For the rat encounter, those keys are `lurking`, `attack-resolved`, `wait-stays`.

- [ ] **Step 1: Replace encounters.ts contents**

```ts
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
            narration: narration('rat', 'attack-resolved'),
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
```

`defaultWrongVerbNarration` is a one-off and not currently in the markdown. We'll either move it to the markdown in a follow-up, or leave it here. Leaving it: it's not a piece of prose the author needs to revise often.

- [ ] **Step 2: Run all mystery tests**

```bash
npm test -- src/mystery
```

Expected: PASS. The narrations resolve to the same strings they did before (Task 9 verified this), so tests asserting specific narration text will still pass.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/mystery/world/encounters.ts
git commit -m "feat(mystery): encounters.ts uses narration() helper for prose"
```

---

## Task 12: Refactor story.ts to use endings markdown

**Files:**
- Modify: `src/mystery/world/story.ts`

`story.ts` becomes a near-empty file. The endings narration and flag conditions now come from markdown via `world/index.ts`. We keep `story.ts` to host any non-ending story constants if/when we add them, but for now it's a minimal stub. The simplest move is to delete it.

Check whether anything still imports from `./story`:

- [ ] **Step 1: Find imports of story.ts**

```bash
grep -rn "from.*['\"].*world/story" src/ scripts/ 2>/dev/null
```

If only `scripts/migrate-mystery-content.ts` imports it (which is now historical) and the new `world/index.ts` does NOT, story.ts can be deleted. The migration script imported `endings` from story.ts; the script is one-shot and its job is done. We can either delete the script or leave it as a historical artifact — leave it for one cycle, delete in a follow-up commit.

Expected output: a small list. If `world/index.ts` no longer references it (it shouldn't, per Task 10), proceed with deletion.

- [ ] **Step 2: Delete story.ts**

```bash
rm src/mystery/world/story.ts
```

- [ ] **Step 3: Run build to ensure nothing else broke**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Run all mystery tests**

```bash
npm test -- src/mystery
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git rm src/mystery/world/story.ts
git commit -m "refactor(mystery): remove story.ts; endings live in markdown"
```

---

## Task 13: Manual playthrough verification

**Files:** none

Type-checking and tests verify code correctness, not feature correctness. The mystery is a UI-driven game; we have to actually play it. Walk the golden path: arrive in the foyer, read the letter, take the lamp, descend, encounter the rat, attack, reach the ending.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Expected: Astro dev server starts, prints a localhost URL.

- [ ] **Step 2: Open the mystery in a browser**

Navigate to `http://localhost:4321/mystery` (port may differ; use what Astro printed).

- [ ] **Step 3: Verify initial render**

Expected: terminal-style UI shows `[ Foyer ]` title and the foyer's first-visit prose. Inventory contains `matches`.

- [ ] **Step 4: Walk the golden path**

Type each command and verify the response prose matches what the game produced before the migration. The expected strings are exactly the originals from `rooms.ts`/`items.ts`/`encounters.ts` (now in the markdown files).

```
> read letter
> take lamp
> n
> e
> attack rat
```

Expected ending: "You stand at the top of the stair. The thing below has settled..."

- [ ] **Step 5: Test edge interactions**

```
> look
> inventory
> wait
> examine letter
> drop lamp
```

Each should respond with prose identical to pre-migration behavior.

- [ ] **Step 6: Stop the dev server (Ctrl-C) and record findings**

If anything is wrong, stop. Do NOT commit further until the bug is found and fixed. The most likely source of drift is whitespace/newline handling in the loader — multi-paragraph `firstVisit` strings, in particular.

If everything works, no commit needed for this task — manual verification is its own confirmation.

---

## Task 14: Obsidian vault config and gitignore

**Files:**
- Create: `src/mystery/world/.obsidian/app.json`
- Create: `src/mystery/world/.obsidian/graph.json`
- Modify: `.gitignore`

Minimal Obsidian config so the vault opens with sensible defaults (graph view enabled, attachments folder configured) and workspace-local cache files don't pollute git.

- [ ] **Step 1: Create app.json**

`src/mystery/world/.obsidian/app.json`:

```json
{
  "alwaysUpdateLinks": true,
  "newLinkFormat": "shortest",
  "useMarkdownLinks": false,
  "attachmentFolderPath": "_attachments"
}
```

- [ ] **Step 2: Create graph.json with a useful default view**

`src/mystery/world/.obsidian/graph.json`:

```json
{
  "showTags": false,
  "showAttachments": false,
  "showOrphans": true,
  "collapse-filter": false,
  "collapse-color-groups": false,
  "collapse-display": false,
  "collapse-forces": false,
  "lineSizeMultiplier": 1,
  "nodeSizeMultiplier": 1.2
}
```

- [ ] **Step 3: Update .gitignore**

Append to the project's existing `.gitignore` (create the file if it doesn't exist):

```
# Obsidian workspace cache (per-machine, not for source control)
src/mystery/world/.obsidian/workspace.json
src/mystery/world/.obsidian/workspace-mobile.json
src/mystery/world/.obsidian/workspace.json.bak
src/mystery/world/.obsidian/cache
```

- [ ] **Step 4: Commit**

```bash
git add src/mystery/world/.obsidian/app.json src/mystery/world/.obsidian/graph.json .gitignore
git commit -m "chore(mystery): commit minimal Obsidian vault config; ignore workspace cache"
```

---

## Done

Final state:
- All Halfstreet game content for the existing three rooms lives in markdown under `src/mystery/world/{rooms,items,encounters,endings}/`.
- `import { world } from '../world'` returns the same `World` shape as before.
- All existing tests pass unchanged.
- Editing any `.md` file triggers Vite HMR; the browser reloads with new prose.
- Obsidian opens the vault and renders the wikilinks as graph edges.

The follow-on spec — tonal refinement — can now author additional rooms and revise existing prose entirely in Obsidian.
