# Mystery — Markdown Content Migration

**Date:** 2026-05-09
**Scope:** Move all Halfstreet game content (rooms, items, encounter narration, endings) from TypeScript object literals into markdown files editable in Obsidian. Engine code, tests, and the public game shape are unchanged.

This spec is a format migration. No prose is rewritten. Tonal refinement is a separate spec that comes after.

**Deliverable:** a working three-room prototype. The current game only contains three rooms (`foyer`, `hallway`, `cellar-stair`), one encounter (`rat`), three items, and a small set of endings. Migrating that content end-to-end produces a fully functional game running on the markdown pipeline, identical in behavior to today. Authoring the additional twenty-plus rooms described in the bible is the tonal-refinement spec that follows.

---

## Why

The current source of truth for game content lives in TypeScript object literals at `src/mystery/world/{rooms,items,encounters,story}.ts`. Authoring prose inside escaped string literals fights every aesthetic instinct: no markdown preview, no Obsidian links, no graph view, no easy cross-referencing between rooms.

Halfstreet has roughly twenty-five rooms, fifteen encounters, ten items, and five endings, all of which still need their final prose written. Writing that volume of text inside `.ts` files is the wrong tool. Markdown files in an Obsidian vault give the author proper prose tooling and let the house's structure surface as a graph.

---

## File Layout

```
src/mystery/world/
  index.ts             # assembles markdown into the World object (existing export, same shape)
  types.ts             # existing typed shapes, unchanged
  schema.ts            # NEW: Zod schemas for runtime validation
  loader.ts            # NEW: parse one markdown file into a typed object
  rooms/               # one file per room
    foyer.md
    hallway.md
    ...
  items/               # one file per item
    lamp.md
    ...
  encounters/          # narration only; state machine stays in TS
    rat.md
    basilisk.md
    ...
  encounters.ts        # state machine; references narration by id via narration() helper
  endings/             # one file per ending
    true.md
    wrong.md
    bad.md
    mercy.md
    replacement.md
  story.ts             # endings index + flag definitions; references endings/*.md by id
```

The Obsidian vault opens on `src/mystery/world/`. The bible at `docs/superpowers/specs/halfstreet-bible.md` stays put as a separate planning document and a separate vault.

---

## Frontmatter Conventions

### Wikilinks for cross-references

Any frontmatter field that points to another markdown file uses a quoted Obsidian wikilink.

```yaml
exitN: "[[hallway]]"
items:
  - "[[letter]]"
encounter: "[[rat]]"
```

The quotes are required. `[[hallway]]` unquoted parses as a nested YAML list. The loader strips `[[ ]]` to recover the plain id at parse time.

Plain strings — flag names, phase names, narration keys — stay plain. They don't have their own files.

### Flat exits

Every room declares all six directions, with `null` for absent exits:

```yaml
exitN: "[[hallway]]"
exitS: null
exitE: null
exitW: null
exitU: null
exitD: null
```

Locked exits extend the flat pattern. The unlocked-exit form is `exit<Dir>: "[[room]]"`. A locked exit adds two sibling fields, present only when the exit is locked:

```yaml
exitD: "[[vault]]"
exitDRequires: "[[rusted-key]]"
exitDLockedText: The door is locked.
```

`exit<Dir>Requires` may also reference a flag name (plain string, no wikilink) instead of an item.

---

## Section Conventions

The markdown body holds prose. Sections are introduced by `## key-name` headers; the header text is the section key, lowercase with hyphens.

### Rooms

Three required sections per room: `first-visit`, `revisit`, `examined`.

```md
---
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
You stand in the foyer of a house you do not remember entering. The door behind you has closed without sound. A folded letter lies on a small table. A hallway leads north.

## revisit
The foyer. The door behind you is still closed.

## examined
A foyer with peeling paper. A small table holds nothing but the letter. The air smells of cold stone. A hallway leads north.
```

### Items

`short` is one line in frontmatter. The body is the long description. State and metadata live in frontmatter.

```md
---
id: lamp
names: [lamp, oil lamp]
short: An iron oil lamp.
takeable: true
initialState:
  lit: false
---

An iron oil lamp, heavy enough to swing if it came to it. The wick is dry. The reservoir sloshes faintly.
```

**Frontmatter naming convention:** all keys are `camelCase`, matching the existing TypeScript shape. The loader passes parsed values through unchanged. Engine code sees the same field names as before the migration.

### Endings

One file per ending. Conditions in frontmatter, single prose body.

```md
---
id: true
whenFlags:
  woofReturned: true
  basiliskSpared: true
  houseAcceptedYou: true
---

You stand in the vault. What is buried at Halfstreet is buried because it was loved, and grieved, and finally let go.

You set the lamp beside it.

You speak the name aloud.

The house settles around you like a long exhalation.

Outside, the road exists again.
```

---

## Encounter Narration: Hybrid Shape

Encounter state machines stay in TypeScript at `src/mystery/world/encounters.ts`. Encounter prose moves to `encounters/<id>.md`. The TS code references narration by `(encounterId, key)` through a `narration()` helper.

`encounters/basilisk.md`:

```md
---
id: basilisk
startsIn: "[[chapel]]"
initialPhase: sleeping
---

## sleeping
Something large is coiled beneath the altar.

You become aware of the eye first.

Not glowing. Merely open.

## resolved
The eye closes. The creature withdraws beneath the chapel stones.

## failed-direct-look
You meet its eye too long. Something in you gives.
```

`encounters.ts`:

```ts
export const encounters: Record<EncounterId, EncounterDef> = {
  basilisk: {
    id: 'basilisk',
    startsIn: 'chapel',           // mirrored from frontmatter; loader checks they match
    initialPhase: 'sleeping',
    phases: {
      sleeping: {
        description: narration('basilisk', 'sleeping'),
        transitions: [
          {
            verb: 'pour',
            target: 'basilisk',
            requires: { item: 'silver-vial' },
            to: 'resolved',
            narration: narration('basilisk', 'resolved'),
          },
        ],
      },
    },
    onFailed: {
      narration: narration('basilisk', 'failed-direct-look'),
      retreatTo: 'chapel',
    },
  },
}
```

`narration(encounterId, key)` looks up a parsed section from the loaded markdown at world-build time and returns the prose string. If the section is missing, the loader throws.

---

## Loader and Validation

`world/loader.ts` parses one markdown file into a typed object. It uses `gray-matter` for frontmatter, splits the body into sections by `## key` headers, recursively strips `[[ ]]` from frontmatter values, and runs the result through a Zod schema from `world/schema.ts`.

`world/index.ts` uses Vite's `import.meta.glob` to load all markdown files synchronously at module init:

```ts
const roomFiles = import.meta.glob('./rooms/*.md', { eager: true, query: '?raw', import: 'default' })
```

The index then assembles a single `World` value by validating each file and resolving cross-references. The `world` export shape is unchanged — engine code and tests continue importing `{ world } from '../world'` without modification.

### Validation passes

After all files are parsed, `buildWorld` runs cross-reference checks and throws on the first failure with a precise message:

- Every `exit<Dir>` destination resolves to a known room id.
- Every `exit<Dir>Requires` resolves to a known item id or a declared flag name.
- Every room `items[]` entry resolves to a known item id.
- Every room `encounter` resolves to a known encounter id.
- Every encounter `startsIn` (in frontmatter) resolves to a known room id, and matches the encounter's `startsIn` in `encounters.ts`.
- Every `narration(id, key)` call in `encounters.ts` finds a matching `## key` section in `encounters/<id>.md`.
- Every `## key` section in encounter markdown is referenced by at least one `narration()` call (catches orphaned prose).
- Every required room section (`first-visit`, `revisit`, `examined`) is present.
- Every ending `whenFlags` entry uses a flag name declared in `story.ts`.

Example failure messages:

```
rooms/parlor.md: exitN references "[[hallwayy]]" but no such room exists. Did you mean "hallway"?
encounters.ts: narration('basilisk', 'sleping') has no matching section in encounters/basilisk.md. Available: sleeping, resolved, failed-direct-look.
rooms/foyer.md: missing required section "## first-visit".
```

### Schema source of truth

Zod schemas in `world/schema.ts` validate at runtime. The static types in `world/types.ts` remain authoritative for engine consumers — keeping engine code free of any dependency on Zod. The two are kept in sync by hand. (Single source of truth via `z.infer` is possible later but is not part of this migration.)

---

## Migration Script

`scripts/migrate-mystery-content.ts` runs once. It imports the existing world via the current TypeScript modules and emits one markdown file per object with the agreed frontmatter and body shape, wikilinks applied to cross-references, prose copied byte-for-byte.

Hand-converting twenty-five-plus files invites dropped fields and silent prose loss. The script guarantees every existing string lands somewhere.

The script is committed alongside its output. It may be deleted in a follow-up commit, or kept for reference.

---

## Cutover

One PR, ordered:

1. Add `gray-matter` to `package.json` dependencies.
2. Add `world/loader.ts` and `world/schema.ts`.
3. Add the `narration()` helper to `world/loader.ts`. The helper is defined but unused until step 5.
4. Run the migration script. Commit the produced markdown files.
5. Refactor `world/index.ts` to assemble from markdown via `import.meta.glob`. Delete `world/rooms.ts` and `world/items.ts`. Refactor `world/encounters.ts` to call `narration()` in place of its inline strings; delete the inline narrations (now in `encounters/*.md`). Refactor `world/story.ts` to reference `endings/*.md`.
6. Run the existing test suite. `playthrough.test.ts`, `encounters.test.ts`, `dispatcher.test.ts`, `chips.test.ts` should pass unchanged because the `World` shape is identical.
7. Manually walk the game in dev mode to confirm no prose drift.

The diff for step 5 should show one-for-one prose moves only. Any byte-level deviation is a migration bug, not an intentional rewrite.

---

## Dev Experience

Editing any `.md` file in Obsidian triggers Vite HMR and the browser reloads with new prose. No build step. Validation errors surface in the browser overlay during HMR and fail CI on commit.

---

## Obsidian Vault

The vault opens on `src/mystery/world/`. With wikilinks in place, the graph view shows rooms connected by exits, items linked to the rooms that hold them, and encounters linked to their starting rooms — a literal map of the house and its inhabitants.

A minimal `.obsidian/` directory is committed for shared graph and tag-pane settings. Workspace-local files (`workspace.json`, cache files, plugin state) are gitignored.

---

## Out of Scope

- **Tonal refinement.** This migration preserves every existing string verbatim. Authoring richer prose into the new markdown files is a separate spec that follows immediately after.
- **Bible reorganization.** The bible currently duplicates structural data (room summaries, item lists) that becomes redundant once the markdown files exist. Slimming the bible to voice, themes, and high-level structure is a follow-on task tied to the tonal refinement spec.
- **Single-source-of-truth types.** `types.ts` and `schema.ts` remain hand-synced. Deriving one from the other is a possible later cleanup.
- **Astro content collections (`defineCollection` / `getCollection`).** A deliberate tooling choice, not a feature exclusion. The mystery is a client-bundled JS module; `import.meta.glob({ eager: true })` runs at bundle time and gives synchronous access to the world data in both production and tests. `getCollection` is server-side and async, which would force serializing the world to JSON inside `mystery.astro` and rehydrating on the client — extra plumbing for no editorial benefit. Markdown editing, HMR, Obsidian wikilinks, graph view, and Zod schema validation all work identically with `import.meta.glob`. Content collections become attractive only if mystery content ever needs server-rendered routes (e.g. a public room index page); not the case today.

---

## Follow-on Risks

The bible will become stale once room prose lives in markdown. The author has flagged that the markdown files are the working surface and the bible will need ongoing maintenance to stay current. The tonal refinement spec should treat the bible's room descriptors as deprecated upon successful migration, and propose either deleting them or auto-generating a digest from the markdown.
