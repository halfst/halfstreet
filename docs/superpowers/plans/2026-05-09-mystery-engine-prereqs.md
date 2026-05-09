# Mystery Engine Prereqs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the engine work that the Halfstreet content bible depends on — `read` / `light` / `extinguish` / `use` verb handlers, ambiguous-noun disambiguation, ending-screen UI + flag matching — plus the small "should-fix while you're in there" items, so Phase 2 (full bible content draft) has a complete engine to write against.

**Architecture:** Item frontmatter gains a few optional flags (`readable`, `lightable`, `lighter`, `lighterUses`) and the markdown body gains optional `## read` / `## lit` / `## extinguished` / `## lighter-empty` sections. The parser is extended with an `ambiguous` command kind and a `verb-target-prep` form (used for `light X with Y` / `use X on Y`). The dispatcher handles four new verbs and evaluates ending-flag conditions after every turn, setting `state.endedWith` and emitting a `kind: 'ending'` transcript event the UI renders specially.

**Tech Stack:** TypeScript, Astro 6 + Vite, Vitest, Zod (already in place), gray-matter substitute (custom `matter()` in `loader.ts`).

**Spec:** `docs/superpowers/specs/2026-05-09-mystery-engine-prereqs-design.md`

---

## File Structure

**Modified files (in dependency order):**

| file | responsibility |
|---|---|
| `src/engine/types.ts` | Add `'ending'` to `TranscriptLine.kind`; widen `RoomState`/`ItemInstance.state` value union to include `string[]`; add `'ambiguous'` variant to `ParsedCommand`; remove `theme` from `GameState`; remove the `Theme` type re-export from this module's public surface. |
| `src/world/types.ts` | Add optional `readable` / `lightable` / `lighter` / `lighterUses` to `Item`; add optional `readableText` / `litText` / `extinguishedText` / `lighterEmptyText` strings carrying the body-section prose for those item modes. |
| `src/world/schema.ts` | Add the same optional fields to `itemFrontmatterSchema`. |
| `src/world/loader.ts` | `parseItem` now extracts optional `## read` / `## lit` / `## extinguished` / `## lighter-empty` sections from the body (the long description is the unsectioned prose, or the body if no sections present). Validate that `readable: true` requires a `## read` section. |
| `src/engine/parser.ts` | Strip `at|the|a|an` stop-words from the noun phrase head. Return `'ambiguous'` instead of `'unknown-noun'` when ≥2 visible aliases match. Detect `with` between two recognized nouns and return `verb-target-prep`. |
| `src/engine/encounters.ts` | Accept `verb-target-prep` commands (currently only `verb-target` and `verb-only` are inspected). For prep commands: extract verb + target (the encounter's `requires.item` mechanism gates on the instrument being in inventory; mismatch between the typed instrument and the transition's required item yields fallback narration). |
| `src/engine/dispatcher.ts` | Drop the `theme` meta-verb branch. Add `read` / `light` / `extinguish` / `use` handlers. Handle the `ambiguous` ParsedCommand by setting `pendingDisambiguation`. Wire `verb-target-prep` (currently unhandled). After every successful state mutation, evaluate ending flags and (on match) set `endedWith` and append a `'ending'` event. Reject further turns once `endedWith !== null`. |
| `src/engine/dispatcher.test.ts` | New tests for read/light/extinguish/use, ambiguous→prompt→reply, ending detection, locked-exit synthetic world. |
| `src/engine/parser.test.ts` | Tests for stop-word strip, ambiguous variant, `with` separator. |
| `src/world/loader.test.ts` | Tests for new item body sections. |
| `src/world/items/lamp.md` | Add `lightable: true`; add `## lit` and `## extinguished` body sections. |
| `src/world/items/matches.md` | Add `lighter: true`, `lighterUses: 4`; add `## lighter-empty` section. |
| `src/world/items/letter.md` | Add `readable: true`; move/duplicate the readable text into a `## read` section (long description stays as-is). |
| `src/ui/terminal.ts` | Render `kind: 'ending'` events with separator + dedicated CSS class. When `state.endedWith !== null`, disable input and render restart-only chip footer. Stop dispatching the `halfstreet-toggle-theme` event from the typed-`theme`-trimmed pathway (the engine no longer knows about themes; just dispatch on the meta-verb shortcut). |
| `src/ui/crt.css` | `.ending` block styling: separator above, larger gap, italic or bordered, centered. |
| `src/engine/save.ts` | No code change needed (extra `theme` field on old saves is ignored at runtime), but a comment notes the schema-evolution choice. |

**No new files.** All work modifies existing modules.

**Out of scope:** transcript scrolling, cursor blink rate, line fade, scanline accessibility toggle. Tracked in the spec's section 7.

---

## Task 1: Foundation type changes — TranscriptLine 'ending' kind + RoomState widen

**Files:**
- Modify: `src/engine/types.ts`

These are mechanical type-only changes that everything else builds on. They unblock later tasks but don't yet change runtime behavior.

- [ ] **Step 1: Read the current types**

```bash
cat src/engine/types.ts
```

Note the existing `TranscriptLine`, `GameState`, `ItemInstance`, and `ParsedCommand` shapes.

- [ ] **Step 2: Widen `TranscriptLine.kind` and the state value unions**

Edit `src/engine/types.ts`:

```ts
export interface TranscriptLine {
  kind: 'narration' | 'player' | 'system' | 'ending'
  text: string
}
```

And:

```ts
export interface ItemInstance {
  id: ItemId
  /** Per-instance state: lit/unlit, broken/whole, etc. */
  state: Record<string, string | boolean | number | string[]>
}
```

And in `GameState`:

```ts
  roomState: Record<RoomId, Record<string, string | boolean | number | string[]>>
  flags: Record<string, string | boolean | number | string[]>
```

- [ ] **Step 3: Verify the rest of the project still type-checks**

```bash
npm run build
```

Expected: PASS. The widened union accepts every value the existing code stores; no callers should fail. If there are type errors caused by `as` casts that previously narrowed to `string | boolean | number`, fix them inline by removing the redundant cast.

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```

Expected: PASS unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts
git commit -m "$(cat <<'EOF'
feat(engine): widen state value unions and add 'ending' transcript kind

Drops redundant string[] casts in dispatcher paths and prepares the
TranscriptLine kind for the ending-screen render path.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Drop redundant `as string[]` casts in the dispatcher

**Files:**
- Modify: `src/engine/dispatcher.ts`

The widened union from Task 1 makes the casts unnecessary. Removing them is verification that the widening worked; it also removes a future trap where a typo cast wrong-types data.

- [ ] **Step 1: Find every `as string[]` in dispatcher.ts**

```bash
grep -n "as string\[\]" src/engine/dispatcher.ts
```

Expected: ~3 hits in `getItemsInRoom`, `handleTake`, `handleDrop`.

- [ ] **Step 2: Remove the casts where reading**

Change:

```ts
const dropped = (state.roomState[roomId]?.['droppedItems'] as string[] | undefined) ?? []
const taken = (state.roomState[roomId]?.['takenItems'] as string[] | undefined) ?? []
```

To:

```ts
const dropped = (state.roomState[roomId]?.['droppedItems'] ?? []) as string[]
const taken = (state.roomState[roomId]?.['takenItems'] ?? []) as string[]
```

(The trailing cast keeps array operations type-safe; the unsafe widening is gone because the union now includes `string[]`.)

Apply the same simplification in `handleTake` (`taken`/`dropped` reads) and `handleDrop` (`dropped` read).

- [ ] **Step 3: Drop the value cast in `setRoomFlag`**

Currently:

```ts
function setRoomFlag(state: GameState, roomId: string, key: string, value: string | boolean | number | string[]): GameState {
  return {
    ...state,
    roomState: {
      ...state.roomState,
      [roomId]: { ...(state.roomState[roomId] ?? {}), [key]: value as string | boolean | number },
    },
  }
}
```

Drop the `as string | boolean | number` cast on the value — the inner record now accepts `string[]` natively:

```ts
function setRoomFlag(state: GameState, roomId: string, key: string, value: string | boolean | number | string[]): GameState {
  return {
    ...state,
    roomState: {
      ...state.roomState,
      [roomId]: { ...(state.roomState[roomId] ?? {}), [key]: value },
    },
  }
}
```

- [ ] **Step 4: Build and test**

```bash
npm run build && npm test
```

Expected: PASS unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/engine/dispatcher.ts
git commit -m "$(cat <<'EOF'
refactor(engine): drop redundant string[] casts now that RoomState includes arrays

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Remove `theme` from GameState

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/dispatcher.ts`
- Modify: `src/ui/terminal.ts`
- Modify: `src/engine/save.ts` (comment only)
- Test: existing tests should still pass; one save-format test may need adjustment.

The `theme` field is a UI preference, not game state. Today, clicking `[B]/[C]` updates DOM + localStorage but not `state.theme`, so the next `theme` meta-verb toggles from a stale value. The fix is to delete it from `GameState` entirely. Old saves with the field continue to load (extra fields are ignored).

- [ ] **Step 1: Inspect `Theme` usage**

```bash
grep -rn "GameState\|state\.theme\|theme: " src/engine/types.ts src/engine/dispatcher.ts src/engine/save.ts src/engine/save.test.ts src/ui/terminal.ts src/ui/theme.ts | head -40
```

Expected: hits in `types.ts` (field declaration), `dispatcher.ts` (`initialStateFor`, `handleMeta`), `terminal.ts` (none reading `state.theme` directly), `theme.ts` (reads/writes DOM only).

- [ ] **Step 2: Remove the field from `GameState`**

In `src/engine/types.ts`:

```ts
// before
  transcript: TranscriptLine[]
  theme: Theme
  endedWith: 'true' | 'wrong' | 'bad' | null

// after
  transcript: TranscriptLine[]
  endedWith: 'true' | 'wrong' | 'bad' | null
```

Also delete the `Theme` type alias if no other module imports it. Verify with:

```bash
grep -rn "import.*Theme.*from.*engine/types" src/
```

If only `theme.ts` imports it, change `theme.ts` to declare its own `type Theme = 'amber' | 'ansi'` locally and drop the import. If none, delete the type from `types.ts`.

- [ ] **Step 3: Remove `theme` initialization from `initialStateFor`**

In `src/engine/dispatcher.ts`, in `initialStateFor`:

```ts
// before
  return {
    schemaVersion: SCHEMA_VERSION,
    location: world.startingRoom,
    inventory,
    roomState: { [world.startingRoom]: { visited: true } },
    flags: {},
    resolveLevel: 'steady',
    encounterState: {},
    lastNoun: null,
    pendingDisambiguation: null,
    transcript: opening,
    theme: 'amber',
    endedWith: null,
  }

// after
  return {
    schemaVersion: SCHEMA_VERSION,
    location: world.startingRoom,
    inventory,
    roomState: { [world.startingRoom]: { visited: true } },
    flags: {},
    resolveLevel: 'steady',
    encounterState: {},
    lastNoun: null,
    pendingDisambiguation: null,
    transcript: opening,
    endedWith: null,
  }
```

- [ ] **Step 4: Remove the `theme` branch from `handleMeta`**

In `dispatcher.ts`:

```ts
// before
function handleMeta(state: GameState, verb: 'restart' | 'undo' | 'hint' | 'save' | 'quit' | 'theme'): DispatchResult {
  if (verb === 'save') return narrate(state, [{ kind: 'system', text: '(your progress is saved automatically)' }])
  if (verb === 'theme') {
    const newTheme = state.theme === 'amber' ? 'ansi' : 'amber'
    return narrate({ ...state, theme: newTheme }, [{ kind: 'system', text: `Theme: ${newTheme}.` }])
  }
  return narrate(state, [{ kind: 'system', text: `(${verb})` }])
}

// after
function handleMeta(state: GameState, verb: 'restart' | 'undo' | 'hint' | 'save' | 'quit' | 'theme'): DispatchResult {
  if (verb === 'save') return narrate(state, [{ kind: 'system', text: '(your progress is saved automatically)' }])
  // 'theme' is a UI preference: the terminal intercepts it before dispatch and
  // dispatches a 'halfstreet-toggle-theme' DOM event. The engine no-ops here so
  // the typing the verb still produces transcript output if the UI ever misses it.
  if (verb === 'theme') return narrate(state, [{ kind: 'system', text: '(theme)' }])
  return narrate(state, [{ kind: 'system', text: `(${verb})` }])
}
```

- [ ] **Step 5: Add a save-format note**

In `src/engine/save.ts`, append a comment near `loadState` so the next person reading it knows extra fields on disk are intentional:

```ts
  // Older saves may carry fields no longer in GameState (e.g. `theme` before
  // it became a UI-only preference). TypeScript ignores extra fields at runtime;
  // bump SCHEMA_VERSION only when the meaning of an existing field changes.
  return parsed as GameState
```

- [ ] **Step 6: Build and test**

```bash
npm run build && npm test
```

Expected: PASS. If a test in `save.test.ts` asserts `theme === 'amber'` on a fresh state, delete that assertion.

- [ ] **Step 7: Smoke-test the theme button manually (just visually skim)**

```bash
grep -n "halfstreet-toggle-theme" src/ui/
```

Expected: `terminal.ts` dispatches the event when the player types `theme`; `theme.ts` listens and toggles. No engine state touched. (Manual browser verification deferred to Task 14.)

- [ ] **Step 8: Commit**

```bash
git add src/engine/types.ts src/engine/dispatcher.ts src/engine/save.ts src/ui/theme.ts
git commit -m "$(cat <<'EOF'
refactor(engine): theme is a UI preference; remove it from GameState

Previously, clicking the theme button updated localStorage and the DOM but
not state.theme, so the engine's `theme` meta-verb toggled from stale state.
Theme is now exclusively UI/storage concern. Old saves with the field still
load; the field is silently ignored.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Parser stop-word strip

**Files:**
- Modify: `src/engine/parser.ts`
- Modify: `src/engine/parser.test.ts`

`look at lamp` should resolve to `examine lamp`. Currently fails because the noun phrase `at lamp` doesn't match any alias. Strip leading `at`, `the`, `a`, `an` from the noun token list before noun matching.

- [ ] **Step 1: Write failing tests**

Append to `src/engine/parser.test.ts`:

```ts
describe('stop-word stripping', () => {
  const ctx: ParserContext = {
    knownItems: ['lamp'],
    knownEncounters: [],
    visibleNouns: [{ id: 'lamp', aliases: ['lamp', 'oil lamp'] }],
    inventoryItemIds: [],
    lastNoun: null,
    awaitingDisambiguation: null,
  }

  it('strips a leading "at" from the noun phrase', () => {
    const cmd = parse('look at lamp', ctx)
    expect(cmd).toEqual({
      kind: 'verb-target',
      verb: 'look',
      target: { canonical: 'lamp', raw: 'lamp' },
    })
  })

  it('strips a leading "the"', () => {
    const cmd = parse('examine the lamp', ctx)
    expect(cmd.kind).toBe('verb-target')
  })

  it('strips "a" and "an"', () => {
    expect(parse('take a lamp', ctx).kind).toBe('verb-target')
    expect(parse('take an oil lamp', ctx).kind).toBe('verb-target')
  })

  it('does not strip stop-words mid-phrase', () => {
    // 'oil lamp' is the alias; 'oil at lamp' is not. Stop-words only strip from
    // the head of the noun phrase, not anywhere in the middle.
    const cmd = parse('take oil lamp', ctx)
    expect(cmd.kind).toBe('verb-target')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/engine/parser.test.ts
```

Expected: FAIL on the `at`/`the`/`a`/`an` tests (`unknown-noun`).

- [ ] **Step 3: Implement the strip**

In `src/engine/parser.ts`, after `rest = tokens.slice(1)` (or after the two-word verb branch sets `rest`) and before noun matching, add:

```ts
const STOP_WORDS = new Set(['at', 'the', 'a', 'an'])
while (rest.length > 0 && STOP_WORDS.has(rest[0]!)) {
  rest = rest.slice(1)
}
```

If `rest` becomes empty after stripping and the verb requires a target, fall through to the existing `verb-only` / `unknown` branches (no special handling needed — the existing logic returns `unknown-noun` or `verb-only` correctly).

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/engine/parser.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/parser.ts src/engine/parser.test.ts
git commit -m "$(cat <<'EOF'
feat(parser): strip leading stop-words (at, the, a, an) from noun phrase

Allows `look at lamp`, `examine the letter`, `take a key`, `take an oil lamp`.
Stop-words are only removed from the head of the noun phrase, not from
anywhere in the middle.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Parser ambiguous-noun variant

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/parser.ts`
- Modify: `src/engine/parser.test.ts`

Today, when a noun phrase matches ≥2 visible aliases (e.g. `take key` with both `iron-key` and `brass-key` present), the parser returns `unknown-noun`. Change it to return a dedicated `ambiguous` variant carrying the candidate ids, so the dispatcher can prompt for disambiguation.

- [ ] **Step 1: Add the variant to ParsedCommand**

In `src/engine/types.ts`:

```ts
// before
export type ParsedCommand =
  | { kind: 'verb-only'; verb: Verb | 'look' | 'inventory' | 'wait' }
  | { kind: 'verb-target'; verb: Verb; target: NounRef }
  | { kind: 'verb-target-prep'; verb: Verb; target: NounRef; preposition: string; indirect: NounRef }
  | { kind: 'go'; direction: Direction }
  | { kind: 'meta'; verb: MetaVerb }
  | { kind: 'disambiguation'; chosen: string }
  | { kind: 'unknown'; raw: string; reason: 'unknown-verb' | 'unknown-noun' | 'malformed' }

// after — add the 'ambiguous' variant
export type ParsedCommand =
  | { kind: 'verb-only'; verb: Verb | 'look' | 'inventory' | 'wait' }
  | { kind: 'verb-target'; verb: Verb; target: NounRef }
  | { kind: 'verb-target-prep'; verb: Verb; target: NounRef; preposition: string; indirect: NounRef }
  | { kind: 'ambiguous'; verb: Verb; rawNoun: string; candidates: string[] }
  | { kind: 'go'; direction: Direction }
  | { kind: 'meta'; verb: MetaVerb }
  | { kind: 'disambiguation'; chosen: string }
  | { kind: 'unknown'; raw: string; reason: 'unknown-verb' | 'unknown-noun' | 'malformed' }
```

- [ ] **Step 2: Write failing parser test**

Append to `src/engine/parser.test.ts`:

```ts
describe('ambiguous noun', () => {
  const ctx: ParserContext = {
    knownItems: ['iron-key', 'brass-key'],
    knownEncounters: [],
    visibleNouns: [
      { id: 'iron-key', aliases: ['key', 'iron key'] },
      { id: 'brass-key', aliases: ['key', 'brass key'] },
    ],
    inventoryItemIds: [],
    lastNoun: null,
    awaitingDisambiguation: null,
  }

  it('returns ambiguous when two aliases match the same noun phrase', () => {
    const cmd = parse('take key', ctx)
    expect(cmd).toEqual({
      kind: 'ambiguous',
      verb: 'take',
      rawNoun: 'key',
      candidates: ['iron-key', 'brass-key'],
    })
  })

  it('still returns verb-target when the phrase is unambiguous', () => {
    const cmd = parse('take iron key', ctx)
    expect(cmd.kind).toBe('verb-target')
    if (cmd.kind === 'verb-target') expect(cmd.target.canonical).toBe('iron-key')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- src/engine/parser.test.ts
```

Expected: FAIL — the `take key` test currently returns `unknown` reason `'unknown-noun'`.

- [ ] **Step 4: Implement the variant**

In `src/engine/parser.ts`, replace the multi-candidate branch:

```ts
// before
  if (candidates.length > 1) {
    return { kind: 'unknown', raw: trimmed, reason: 'unknown-noun' }
  }

// after
  if (candidates.length > 1) {
    const uniqueIds = [...new Set(candidates.map((c) => c.id))]
    if (uniqueIds.length === 1) {
      // Two aliases of the same item — not actually ambiguous.
      const id = uniqueIds[0]!
      return { kind: 'verb-target', verb, target: { canonical: id, raw: candidates[0]!.alias } }
    }
    return { kind: 'ambiguous', verb, rawNoun: targetRaw, candidates: uniqueIds }
  }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- src/engine/parser.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run full suite to ensure no callers broke**

```bash
npm test
```

Expected: PASS. The dispatcher will currently treat `ambiguous` as an unhandled variant and fall through to `Nothing happens.` — that's fine; Task 7 wires it up properly.

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/engine/parser.ts src/engine/parser.test.ts
git commit -m "$(cat <<'EOF'
feat(parser): return ambiguous variant when noun matches multiple aliases

Replaces the previous behavior of returning unknown-noun. The dispatcher
will use this in the next commit to prompt the player to disambiguate.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Parser `with` separator → verb-target-prep

**Files:**
- Modify: `src/engine/parser.ts`
- Modify: `src/engine/parser.test.ts`

When the player types `light lamp with matches`, the parser should return:

```ts
{ kind: 'verb-target-prep', verb: 'light',
  target: { canonical: 'lamp', raw: 'lamp' },
  preposition: 'with',
  indirect: { canonical: 'matches', raw: 'matches' } }
```

The `verb-target-prep` variant already exists in types.ts; the parser just doesn't produce it yet.

- [ ] **Step 1: Write failing tests**

Append to `src/engine/parser.test.ts`:

```ts
describe('verb-target-prep with "with"', () => {
  const ctx: ParserContext = {
    knownItems: ['lamp', 'matches'],
    knownEncounters: [],
    visibleNouns: [
      { id: 'lamp', aliases: ['lamp'] },
      { id: 'matches', aliases: ['matches', 'matchbook'] },
    ],
    inventoryItemIds: ['matches'],
    lastNoun: null,
    awaitingDisambiguation: null,
  }

  it('parses "light lamp with matches" into verb-target-prep', () => {
    const cmd = parse('light lamp with matches', ctx)
    expect(cmd).toEqual({
      kind: 'verb-target-prep',
      verb: 'light',
      target: { canonical: 'lamp', raw: 'lamp' },
      preposition: 'with',
      indirect: { canonical: 'matches', raw: 'matches' },
    })
  })

  it('parses "use shears on vines" into verb-target-prep', () => {
    const localCtx: ParserContext = {
      knownItems: ['shears', 'ivy-figure'],
      knownEncounters: [],
      visibleNouns: [
        { id: 'shears', aliases: ['shears'] },
        { id: 'ivy-figure', aliases: ['vines', 'ivy'] },
      ],
      inventoryItemIds: ['shears'],
      lastNoun: null,
      awaitingDisambiguation: null,
    }
    const cmd = parse('use shears on vines', localCtx)
    expect(cmd).toEqual({
      kind: 'verb-target-prep',
      verb: 'use',
      target: { canonical: 'shears', raw: 'shears' },
      preposition: 'on',
      indirect: { canonical: 'ivy-figure', raw: 'vines' },
    })
  })

  it('still parses verb-target when no preposition is present', () => {
    const cmd = parse('take lamp', ctx)
    expect(cmd.kind).toBe('verb-target')
  })

  it('falls back to unknown-noun when one side fails to resolve', () => {
    const cmd = parse('light lamp with feathers', ctx)
    expect(cmd).toEqual({ kind: 'unknown', raw: 'light lamp with feathers', reason: 'unknown-noun' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/engine/parser.test.ts
```

Expected: FAIL — `verb-target-prep` is never returned.

- [ ] **Step 3: Add a noun-phrase resolver helper**

Add this helper near the top of the file:

```ts
const PREPOSITIONS = new Set(['with', 'on', 'in', 'to'])

function resolveNoun(rawTokens: string[], ctx: ParserContext): { id: string; alias: string } | null {
  const phrase = rawTokens.join(' ')
  if (phrase === 'it' && ctx.lastNoun) {
    return { id: ctx.lastNoun.canonical, alias: 'it' }
  }
  for (const noun of ctx.visibleNouns) {
    for (const alias of noun.aliases) {
      if (alias === phrase) return { id: noun.id, alias }
    }
  }
  for (const itemId of ctx.inventoryItemIds) {
    if (itemId === phrase) return { id: itemId, alias: phrase }
  }
  return null
}
```

- [ ] **Step 4: Detect prepositions and split the noun phrase**

After the stop-word strip and before the existing single-noun resolution path, add:

```ts
  // Detect a preposition splitting target | indirect.
  const prepIdx = rest.findIndex((tok) => PREPOSITIONS.has(tok))
  if (prepIdx > 0 && prepIdx < rest.length - 1) {
    const targetTokens = rest.slice(0, prepIdx)
    const prep = rest[prepIdx]!
    let indirectTokens = rest.slice(prepIdx + 1)
    // Strip stop-words at the head of the indirect phrase too ("on the table").
    while (indirectTokens.length > 0 && STOP_WORDS.has(indirectTokens[0]!)) {
      indirectTokens = indirectTokens.slice(1)
    }
    if (indirectTokens.length > 0) {
      const target = resolveNoun(targetTokens, ctx)
      const indirect = resolveNoun(indirectTokens, ctx)
      if (target && indirect) {
        return {
          kind: 'verb-target-prep',
          verb,
          target: { canonical: target.id, raw: target.alias },
          preposition: prep,
          indirect: { canonical: indirect.id, raw: indirect.alias },
        }
      }
      // Either side failed to resolve → fall through to unknown-noun below.
      return { kind: 'unknown', raw: trimmed, reason: 'unknown-noun' }
    }
  }
```

(`STOP_WORDS` is the constant defined in Task 4. If you placed it inside `parse`, hoist it to module scope so the indirect-phrase strip can reuse it.)

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- src/engine/parser.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/parser.ts src/engine/parser.test.ts
git commit -m "$(cat <<'EOF'
feat(parser): emit verb-target-prep on 'with'/'on'/'in'/'to' separators

Enables `light lamp with matches`, `use shears on vines`, and similar
multi-noun forms. Both the target and indirect noun must resolve;
otherwise the command falls back to unknown-noun.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Dispatcher — handle ambiguous and disambiguation

**Files:**
- Modify: `src/engine/dispatcher.ts`
- Modify: `src/engine/dispatcher.test.ts`

When the parser returns `kind: 'ambiguous'`, the dispatcher records `pendingDisambiguation` on state and emits a "Which X — A, B, or C?" prompt. The existing `kind: 'disambiguation'` handler already re-issues the original verb.

- [ ] **Step 1: Write failing tests**

Append to `src/engine/dispatcher.test.ts` (look for the existing `describe` blocks; add a new one):

```ts
describe('ambiguous → disambiguation flow', () => {
  it('sets pendingDisambiguation and prompts when the parser returns ambiguous', () => {
    const world: World = {
      startingRoom: 'r',
      startingInventory: [],
      rooms: {
        r: {
          id: 'r',
          title: '[ R ]',
          descriptions: { firstVisit: 'r', revisit: 'r', examined: 'r' },
          exits: {},
          items: ['iron-key', 'brass-key'],
        },
      },
      items: {
        'iron-key': { id: 'iron-key', names: ['key', 'iron key'], short: 'an iron key', long: '.', initialState: {}, takeable: true },
        'brass-key': { id: 'brass-key', names: ['key', 'brass key'], short: 'a brass key', long: '.', initialState: {}, takeable: true },
      },
      encounters: {},
      endings: {
        true: { whenFlags: {}, narration: '' },
        wrong: { whenFlags: {}, narration: '' },
        bad: { whenFlags: {}, narration: '' },
      },
    }
    const state = initialStateFor(world)
    const cmd: ParsedCommand = {
      kind: 'ambiguous', verb: 'take', rawNoun: 'key', candidates: ['iron-key', 'brass-key'],
    }
    const result = dispatch(state, cmd, world)
    expect(result.state.pendingDisambiguation).toEqual({
      verb: 'take',
      candidates: ['iron-key', 'brass-key'],
      prompt: 'Which key — an iron key, or a brass key?',
    })
    expect(result.appended[0]?.text).toBe('Which key — an iron key, or a brass key?')
  })

  it('handles a single-word disambiguation reply', () => {
    // (continuing from the same world)
    // After the 'ambiguous' turn, send a 'disambiguation' command and verify the
    // dispatcher re-issues take iron-key.
    // ...
  })
})
```

(Fill in the second test inline; copy the world fixture into a top-level `const` if shared between tests.)

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/engine/dispatcher.test.ts
```

Expected: FAIL — dispatcher returns "Nothing happens." for the ambiguous branch.

- [ ] **Step 3: Add the dispatcher branch**

In `src/engine/dispatcher.ts`, in the `dispatch` function, add a new branch above `if (command.kind === 'verb-only')`:

```ts
  if (command.kind === 'ambiguous') {
    const candidateShorts = command.candidates.map((id) => world.items[id]?.short ?? id)
    const list =
      candidateShorts.length === 2
        ? `${candidateShorts[0]}, or ${candidateShorts[1]}`
        : candidateShorts.slice(0, -1).join(', ') + ', or ' + candidateShorts[candidateShorts.length - 1]
    const prompt = `Which ${command.rawNoun} — ${list}?`
    const next: GameState = {
      ...state,
      pendingDisambiguation: { verb: command.verb, candidates: command.candidates, prompt },
    }
    return narrate(next, [{ kind: 'narration', text: prompt }])
  }
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/engine/dispatcher.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/dispatcher.ts src/engine/dispatcher.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): dispatcher handles ambiguous parses with a disambiguation prompt

Sets pendingDisambiguation on state and emits "Which X — A, or B?" using
each candidate item's short text. The existing disambiguation reply path
then re-issues the original verb against the chosen target.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Item schema — readable / lightable / lighter / lighterUses fields

**Files:**
- Modify: `src/world/types.ts`
- Modify: `src/world/schema.ts`
- Modify: `src/world/schema.test.ts`

Add the four optional fields to the `Item` type and the Zod schema. No loader changes yet — those come in Task 9.

- [ ] **Step 1: Extend `Item` in world types**

In `src/world/types.ts`:

```ts
export interface Item {
  id: ItemId
  names: string[]
  short: string
  long: string
  initialState: Record<string, string | boolean | number | string[]>
  takeable: boolean
  /** True if `read X` should narrate the item's `## read` section. */
  readable?: boolean
  /** True if `light X` / `extinguish X` apply; toggles state.lit. */
  lightable?: boolean
  /** True if this item can light other items. */
  lighter?: boolean
  /** Optional remaining-charges counter; absent means unlimited. */
  lighterUses?: number
  /** Prose returned by `read X`. Required iff readable is true. */
  readableText?: string
  /** Prose narrated when `light X` succeeds. Falls back to "It catches." */
  litText?: string
  /** Prose narrated when `extinguish X` succeeds. Falls back to "The flame dies." */
  extinguishedText?: string
  /** Prose narrated when this item's lighterUses reaches 0. Falls back to "It is spent." */
  lighterEmptyText?: string
}
```

(Note: also widened `initialState` value union to include `string[]` to match Task 1. Apply that to `Item.initialState` too.)

- [ ] **Step 2: Extend `itemFrontmatterSchema`**

In `src/world/schema.ts`:

```ts
export const itemFrontmatterSchema = z.object({
  id: z.string().min(1),
  names: z.array(z.string().min(1)).min(1),
  short: z.string().min(1),
  takeable: z.boolean(),
  initialState: stateRecordSchema.default({}),
  readable: z.boolean().optional(),
  lightable: z.boolean().optional(),
  lighter: z.boolean().optional(),
  lighterUses: z.number().int().nonnegative().optional(),
})
```

- [ ] **Step 3: Add tests**

In `src/world/schema.test.ts`, append:

```ts
describe('itemFrontmatterSchema — bible additions', () => {
  it('accepts readable + lighter fields', () => {
    const data = {
      id: 'matches',
      names: ['matches', 'matchbook'],
      short: 'a matchbook',
      takeable: true,
      lighter: true,
      lighterUses: 4,
    }
    expect(() => itemFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('accepts lightable on its own', () => {
    const data = { id: 'lamp', names: ['lamp'], short: 'a lamp', takeable: true, lightable: true }
    expect(() => itemFrontmatterSchema.parse(data)).not.toThrow()
  })

  it('rejects negative lighterUses', () => {
    const data = { id: 'matches', names: ['matches'], short: 'matches', takeable: true, lighter: true, lighterUses: -1 }
    expect(() => itemFrontmatterSchema.parse(data)).toThrow()
  })
})
```

- [ ] **Step 4: Run schema tests**

```bash
npm test -- src/world/schema.test.ts
```

Expected: PASS (3 new tests).

- [ ] **Step 5: Commit**

```bash
git add src/world/types.ts src/world/schema.ts src/world/schema.test.ts
git commit -m "$(cat <<'EOF'
feat(world): item schema — readable, lightable, lighter, lighterUses

Optional fields used by the new read/light/extinguish dispatcher branches.
Loader updates and dispatcher logic follow.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Loader — extract optional `## read`, `## lit`, `## extinguished`, `## lighter-empty` sections

**Files:**
- Modify: `src/world/loader.ts`
- Modify: `src/world/loader.test.ts`

When an item's body contains `##` section headers, the long description is the prose *before* the first header, and the recognized section names are extracted into typed fields. When there are no headers, the body is the long description (current behavior).

- [ ] **Step 1: Write failing tests**

Append to `src/world/loader.test.ts`:

```ts
describe('parseItem — body sections', () => {
  it('extracts ## read into readableText', () => {
    const md = `---
id: letter
names: [letter, note]
short: a folded letter
takeable: true
readable: true
---

A folded letter, sealed with wax.

## read
You loved Halfstreet, the letter says. I loved it too.
`
    const item = parseItem(md, 'items/letter.md')
    expect(item.long).toBe('A folded letter, sealed with wax.')
    expect(item.readable).toBe(true)
    expect(item.readableText).toBe('You loved Halfstreet, the letter says. I loved it too.')
  })

  it('extracts ## lit and ## extinguished', () => {
    const md = `---
id: lamp
names: [lamp]
short: an oil lamp
takeable: true
lightable: true
initialState:
  lit: false
---

An iron oil lamp.

## lit
The wick catches; warm yellow light fills the space.

## extinguished
You smother the flame. The room darkens.
`
    const item = parseItem(md, 'items/lamp.md')
    expect(item.long).toBe('An iron oil lamp.')
    expect(item.litText).toBe('The wick catches; warm yellow light fills the space.')
    expect(item.extinguishedText).toBe('You smother the flame. The room darkens.')
  })

  it('extracts ## lighter-empty', () => {
    const md = `---
id: matches
names: [matches]
short: a matchbook
takeable: true
lighter: true
lighterUses: 4
---

A matchbook from the Halfstreet Hotel.

## lighter-empty
The last match flares and dies. The book is empty.
`
    const item = parseItem(md, 'items/matches.md')
    expect(item.lighterEmptyText).toBe('The last match flares and dies. The book is empty.')
  })

  it('throws when readable: true but ## read is missing', () => {
    const md = `---
id: x
names: [x]
short: x
takeable: true
readable: true
---

A thing.
`
    expect(() => parseItem(md, 'items/x.md')).toThrow(/## read.*required when readable/i)
  })

  it('still parses items with no body sections (back-compat)', () => {
    const md = `---
id: lamp
names: [lamp]
short: an oil lamp
takeable: true
---

An iron oil lamp with a glass chimney.
`
    const item = parseItem(md, 'items/lamp.md')
    expect(item.long).toBe('An iron oil lamp with a glass chimney.')
    expect(item.readable).toBeUndefined()
    expect(item.readableText).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/world/loader.test.ts
```

Expected: FAIL — current `parseItem` puts the entire body in `long`, including section headers.

- [ ] **Step 3: Update `parseItem`**

Replace the existing `parseItem` in `src/world/loader.ts`:

```ts
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
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/world/loader.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run full test suite to ensure existing items still load**

```bash
npm test
```

Expected: PASS. The three existing item files have no `##` headers, so the back-compat path applies.

- [ ] **Step 6: Commit**

```bash
git add src/world/loader.ts src/world/loader.test.ts
git commit -m "$(cat <<'EOF'
feat(world): parseItem extracts optional ## read / lit / extinguished / lighter-empty sections

Existing items with no body sections continue to load unchanged. New items
can author per-state prose in dedicated sections; the dispatcher will read
these in subsequent commits.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Item content — annotate lamp / matches / letter

**Files:**
- Modify: `src/world/items/lamp.md`
- Modify: `src/world/items/matches.md`
- Modify: `src/world/items/letter.md`

Real content updates so the dispatcher work in Tasks 11–13 can be exercised against the actual world.

- [ ] **Step 1: Update `lamp.md`**

```md
---
id: lamp
names: ["lamp", "oil lamp", "torch"]
short: "an oil lamp"
takeable: true
lightable: true
initialState:
  lit: false
---

An iron oil lamp with a glass chimney. Currently unlit.

## lit
The wick catches. Warm yellow light pushes the dark back.

## extinguished
You smother the wick. The room closes around you again.
```

- [ ] **Step 2: Update `matches.md`**

Read the current file first to preserve any existing prose:

```bash
cat src/world/items/matches.md
```

Then replace with:

```md
---
id: matches
names: ["matches", "matchbook"]
short: "a matchbook"
takeable: true
lighter: true
lighterUses: 4
initialState:
  uses: 4
---

A matchbook. The cover bears the name of a hotel you don't remember staying in.

## lighter-empty
The last match flares, burns down, and goes out. The book is empty.
```

(If the original `long` text differs, preserve it verbatim above the `## lighter-empty` line. The `lighterUses` schema field documents the initial charge count for authors; the runtime counter lives on the item instance under `state.uses`, seeded by `initialState.uses`. Task 12 reads and decrements the latter.)

- [ ] **Step 3: Update `letter.md`**

Read the current file:

```bash
cat src/world/items/letter.md
```

Promote whatever it currently shows when read into a `## read` section. Example shape:

```md
---
id: letter
names: ["letter", "note"]
short: "a folded letter"
takeable: true
readable: true
---

A folded letter. The wax seal has been broken once already.

## read
[the existing readable text from the original long description, or new bible-aligned prose if you prefer]
```

(The follow-on plan rewrites prose. For this task, just preserve whatever's currently there in the `## read` section; do not invent new content.)

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: PASS. Existing playthrough tests may assert on `examine letter` returning a specific string — if they do, they'll still pass because `item.long` (the unsectioned prefix) is what `examine` returns. Verify by skimming `playthrough.test.ts`.

- [ ] **Step 5: Run build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/world/items/lamp.md src/world/items/matches.md src/world/items/letter.md
git commit -m "$(cat <<'EOF'
feat(world): annotate lamp/matches/letter for read/light/extinguish

Adds the new schema flags and per-state body sections so the dispatcher's
new verb handlers have content to narrate.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Dispatcher — `read` verb

**Files:**
- Modify: `src/engine/dispatcher.ts`
- Modify: `src/engine/dispatcher.test.ts`

`read X` narrates the item's `## read` section if `readable: true`. Otherwise: "There's nothing to read on it."

- [ ] **Step 1: Write failing tests**

Append to `src/engine/dispatcher.test.ts`:

```ts
describe('read verb', () => {
  it('narrates readableText for a readable item in inventory', () => {
    const world = readWorld() // small helper defined below
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'letter', state: {} }] }
    const result = dispatch(state, {
      kind: 'verb-target', verb: 'read', target: { canonical: 'letter', raw: 'letter' },
    }, world)
    expect(result.appended.at(-1)?.text).toBe('You loved Halfstreet, the letter says.')
  })

  it('errors politely on non-readable items', () => {
    const world = readWorld()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'rock', state: {} }] }
    const result = dispatch(state, {
      kind: 'verb-target', verb: 'read', target: { canonical: 'rock', raw: 'rock' },
    }, world)
    expect(result.appended.at(-1)?.text).toBe("There's nothing to read on it.")
  })
})

// Top-level helper near the other test fixtures:
function readWorld(): World {
  return {
    startingRoom: 'r',
    startingInventory: [],
    rooms: { r: { id: 'r', title: '[ R ]', descriptions: { firstVisit: '.', revisit: '.', examined: '.' }, exits: {}, items: [] } },
    items: {
      letter: { id: 'letter', names: ['letter'], short: 'a letter', long: 'A letter.', initialState: {}, takeable: true, readable: true, readableText: 'You loved Halfstreet, the letter says.' },
      rock: { id: 'rock', names: ['rock'], short: 'a rock', long: 'A rock.', initialState: {}, takeable: true },
    },
    encounters: {},
    endings: {
      true: { whenFlags: {}, narration: '' },
      wrong: { whenFlags: {}, narration: '' },
      bad: { whenFlags: {}, narration: '' },
    },
  }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/engine/dispatcher.test.ts -t "read verb"
```

Expected: FAIL — current `verb-target` fallthrough emits `"You're not sure how to read that."`

- [ ] **Step 3: Add the `read` handler**

In `dispatch()`, in the `verb-target` block, before the trailing `return narrate(...)`:

```ts
    if (command.verb === 'read') return handleRead(stateWithNoun, command.target.canonical, world)
```

Add the handler:

```ts
function handleRead(state: GameState, itemId: string, world: World): DispatchResult {
  const item = world.items[itemId]
  if (!item) return narrate(state, [{ kind: 'narration', text: "You don't see anything like that." }])
  const visible =
    state.inventory.find((i) => i.id === itemId) ||
    getItemsInRoom(state, world, state.location).includes(itemId)
  if (!visible) return narrate(state, [{ kind: 'narration', text: "You don't see anything like that." }])
  if (!item.readable || !item.readableText) {
    return narrate(state, [{ kind: 'narration', text: "There's nothing to read on it." }])
  }
  return narrate(state, [{ kind: 'narration', text: item.readableText }])
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/engine/dispatcher.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/dispatcher.ts src/engine/dispatcher.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): read verb narrates item.readableText

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Dispatcher — `light` and `extinguish` (implicit lighter)

**Files:**
- Modify: `src/engine/dispatcher.ts`
- Modify: `src/engine/dispatcher.test.ts`

`light X` (no instrument): pick any inventory item with `lighter: true` and either no `lighterUses` or `lighterUses > 0`; consume one charge if applicable; set `target.state.lit = true`; narrate `litText`.

`extinguish X`: requires `state.lit === true`; clears it; narrates `extinguishedText`.

This task implements only the implicit form. Task 13 adds the explicit `light X with Y` form.

- [ ] **Step 1: Write failing tests**

Append to `dispatcher.test.ts`:

```ts
describe('light/extinguish verbs (implicit lighter)', () => {
  function w(): World {
    return {
      startingRoom: 'r',
      startingInventory: [],
      rooms: { r: { id: 'r', title: '[ R ]', descriptions: { firstVisit: '.', revisit: '.', examined: '.' }, exits: {}, items: [] } },
      items: {
        lamp: { id: 'lamp', names: ['lamp'], short: 'an oil lamp', long: '.', initialState: { lit: false }, takeable: true, lightable: true, litText: 'The wick catches.', extinguishedText: 'The flame dies.' },
        matches: { id: 'matches', names: ['matches'], short: 'a matchbook', long: '.', initialState: {}, takeable: true, lighter: true, lighterUses: 2, lighterEmptyText: 'The book is empty.' },
        rock: { id: 'rock', names: ['rock'], short: 'a rock', long: '.', initialState: {}, takeable: true },
      },
      encounters: {},
      endings: { true: { whenFlags: {}, narration: '' }, wrong: { whenFlags: {}, narration: '' }, bad: { whenFlags: {}, narration: '' } },
    }
  }

  it('lights a lamp using the matchbook implicitly', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [
      { id: 'lamp', state: { lit: false } },
      { id: 'matches', state: { uses: 2 } },
    ] }
    const result = dispatch(state, { kind: 'verb-target', verb: 'light', target: { canonical: 'lamp', raw: 'lamp' } }, world)
    expect(result.state.inventory.find((i) => i.id === 'lamp')?.state['lit']).toBe(true)
    expect(result.state.inventory.find((i) => i.id === 'matches')?.state['uses']).toBe(1)
    expect(result.appended.at(-1)?.text).toBe('The wick catches.')
  })

  it('refuses when the target is already lit', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [
      { id: 'lamp', state: { lit: true } },
      { id: 'matches', state: { uses: 2 } },
    ] }
    const result = dispatch(state, { kind: 'verb-target', verb: 'light', target: { canonical: 'lamp', raw: 'lamp' } }, world)
    expect(result.appended.at(-1)?.text).toBe("It's already lit.")
  })

  it('refuses when no lighter is in inventory', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'lamp', state: { lit: false } }] }
    const result = dispatch(state, { kind: 'verb-target', verb: 'light', target: { canonical: 'lamp', raw: 'lamp' } }, world)
    expect(result.appended.at(-1)?.text).toBe('You have nothing to light it with.')
  })

  it('refuses when the target is not lightable', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'rock', state: {} }, { id: 'matches', state: { uses: 2 } }] }
    const result = dispatch(state, { kind: 'verb-target', verb: 'light', target: { canonical: 'rock', raw: 'rock' } }, world)
    expect(result.appended.at(-1)?.text).toBe("You can't light that.")
  })

  it('emits the lighter-empty message when matches reach 0', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [
      { id: 'lamp', state: { lit: false } },
      { id: 'matches', state: { uses: 1 } },
    ] }
    const result = dispatch(state, { kind: 'verb-target', verb: 'light', target: { canonical: 'lamp', raw: 'lamp' } }, world)
    expect(result.state.inventory.find((i) => i.id === 'matches')?.state['uses']).toBe(0)
    const texts = result.appended.map((l) => l.text)
    expect(texts).toContain('The wick catches.')
    expect(texts).toContain('The book is empty.')
  })

  it('extinguishes a lit lamp', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'lamp', state: { lit: true } }] }
    const result = dispatch(state, { kind: 'verb-target', verb: 'extinguish', target: { canonical: 'lamp', raw: 'lamp' } }, world)
    expect(result.state.inventory.find((i) => i.id === 'lamp')?.state['lit']).toBe(false)
    expect(result.appended.at(-1)?.text).toBe('The flame dies.')
  })

  it("refuses to extinguish what isn't lit", () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'lamp', state: { lit: false } }] }
    const result = dispatch(state, { kind: 'verb-target', verb: 'extinguish', target: { canonical: 'lamp', raw: 'lamp' } }, world)
    expect(result.appended.at(-1)?.text).toBe("It isn't lit.")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/engine/dispatcher.test.ts -t "light/extinguish"
```

Expected: FAIL.

- [ ] **Step 3: Implement the handlers**

In `dispatch()`'s `verb-target` block:

```ts
    if (command.verb === 'light') return handleLight(stateWithNoun, command.target.canonical, null, world)
    if (command.verb === 'extinguish') return handleExtinguish(stateWithNoun, command.target.canonical, world)
```

Add:

```ts
function handleLight(state: GameState, targetId: string, instrumentId: string | null, world: World): DispatchResult {
  const target = world.items[targetId]
  if (!target) return narrate(state, [{ kind: 'narration', text: "You don't see anything like that." }])
  if (!target.lightable) return narrate(state, [{ kind: 'narration', text: "You can't light that." }])
  const targetInst = state.inventory.find((i) => i.id === targetId) ?? null
  const visibleInRoom = getItemsInRoom(state, world, state.location).includes(targetId)
  if (!targetInst && !visibleInRoom) {
    return narrate(state, [{ kind: 'narration', text: "You don't see anything like that." }])
  }
  // The 'lit' state lives on the inventory instance for inventory items, or
  // (eventually) on roomState for items left in a room. For now we only
  // support lighting items the player is carrying.
  if (!targetInst) {
    return narrate(state, [{ kind: 'narration', text: "You'd have to be carrying it." }])
  }
  if (targetInst.state['lit'] === true) {
    return narrate(state, [{ kind: 'narration', text: "It's already lit." }])
  }

  // Pick an instrument. If explicit, validate it; if implicit, find any.
  let lighterInst = null as typeof state.inventory[number] | null
  if (instrumentId) {
    lighterInst = state.inventory.find((i) => i.id === instrumentId) ?? null
    if (!lighterInst) return narrate(state, [{ kind: 'narration', text: "You don't have that." }])
    const lighterDef = world.items[instrumentId]
    if (!lighterDef?.lighter) return narrate(state, [{ kind: 'narration', text: "That isn't going to help." }])
    if (typeof lighterInst.state['uses'] === 'number' && lighterInst.state['uses'] <= 0) {
      return narrate(state, [{ kind: 'narration', text: "It is spent." }])
    }
  } else {
    for (const inst of state.inventory) {
      const def = world.items[inst.id]
      if (!def?.lighter) continue
      if (typeof inst.state['uses'] === 'number' && inst.state['uses'] <= 0) continue
      lighterInst = inst
      break
    }
    if (!lighterInst) {
      return narrate(state, [{ kind: 'narration', text: 'You have nothing to light it with.' }])
    }
  }

  // Apply state changes immutably.
  const lighterDef = world.items[lighterInst.id]!
  const lighterUsesField = typeof lighterInst.state['uses'] === 'number' ? lighterInst.state['uses'] : null
  const newLighterUses = lighterUsesField === null ? null : lighterUsesField - 1
  const newInventory = state.inventory.map((i) => {
    if (i.id === targetInst.id) return { ...i, state: { ...i.state, lit: true } }
    if (i.id === lighterInst!.id && newLighterUses !== null) return { ...i, state: { ...i.state, uses: newLighterUses } }
    return i
  })
  const lines: TranscriptLine[] = [{ kind: 'narration', text: target.litText ?? 'It catches.' }]
  if (newLighterUses === 0) {
    lines.push({ kind: 'narration', text: lighterDef.lighterEmptyText ?? 'It is spent.' })
  }
  return narrate({ ...state, inventory: newInventory }, lines)
}

function handleExtinguish(state: GameState, targetId: string, world: World): DispatchResult {
  const target = world.items[targetId]
  if (!target) return narrate(state, [{ kind: 'narration', text: "You don't see anything like that." }])
  if (!target.lightable) return narrate(state, [{ kind: 'narration', text: "You can't extinguish that." }])
  const targetInst = state.inventory.find((i) => i.id === targetId)
  if (!targetInst) return narrate(state, [{ kind: 'narration', text: "You'd have to be carrying it." }])
  if (targetInst.state['lit'] !== true) {
    return narrate(state, [{ kind: 'narration', text: "It isn't lit." }])
  }
  const newInventory = state.inventory.map((i) =>
    i.id === targetId ? { ...i, state: { ...i.state, lit: false } } : i,
  )
  return narrate({ ...state, inventory: newInventory }, [{ kind: 'narration', text: target.extinguishedText ?? 'The flame dies.' }])
}
```

**Note on the `uses` state key:** the matches' `lighterUses` schema field is the *initial* charge count (set in Task 10's frontmatter); the runtime counter lives on the item instance under `state.uses`, seeded by `initialState.uses` in matches.md. Tests in this task use `state.uses` directly.

- [ ] **Step 4: Run tests**

```bash
npm test -- src/engine/dispatcher.test.ts
```

Expected: PASS for the new tests and all existing.

- [ ] **Step 5: Commit**

```bash
git add src/engine/dispatcher.ts src/engine/dispatcher.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): light/extinguish verbs with implicit lighter selection

`light X` finds a lighter (item with lighter:true and remaining state.uses)
in inventory, decrements its charges, and toggles target.state.lit. The
target's litText / extinguishedText / the lighter's lighterEmptyText
provide narration. Refuses politely on each error path.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Dispatcher — `light X with Y` (verb-target-prep) and `use` routing

**Files:**
- Modify: `src/engine/dispatcher.ts`
- Modify: `src/engine/encounters.ts`
- Modify: `src/engine/dispatcher.test.ts`

Wire `verb-target-prep` through the dispatcher. For `light`, route to `handleLight` with the explicit instrument. For `use` and any other verb, route to the encounter dispatcher (with the prep info passed through), and fall back to "You can't think how to use that here." if no encounter consumes it.

- [ ] **Step 1: Write failing tests**

Append to `dispatcher.test.ts`:

```ts
describe('light X with Y (explicit lighter)', () => {
  // reuse the world from Task 12's test block; if scoped, redeclare here.

  it('lights with the explicit instrument', () => {
    // ... using the same w() helper from Task 12 ...
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [
      { id: 'lamp', state: { lit: false } },
      { id: 'matches', state: { uses: 2 } },
    ] }
    const result = dispatch(state, {
      kind: 'verb-target-prep', verb: 'light',
      target: { canonical: 'lamp', raw: 'lamp' },
      preposition: 'with',
      indirect: { canonical: 'matches', raw: 'matches' },
    }, world)
    expect(result.state.inventory.find((i) => i.id === 'lamp')?.state['lit']).toBe(true)
    expect(result.state.inventory.find((i) => i.id === 'matches')?.state['uses']).toBe(1)
  })

  it('refuses when the named instrument is not a lighter', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [
      { id: 'lamp', state: { lit: false } },
      { id: 'rock', state: {} },
    ] }
    const result = dispatch(state, {
      kind: 'verb-target-prep', verb: 'light',
      target: { canonical: 'lamp', raw: 'lamp' },
      preposition: 'with',
      indirect: { canonical: 'rock', raw: 'rock' },
    }, world)
    expect(result.appended.at(-1)?.text).toBe("That isn't going to help.")
  })
})

describe('use verb routing', () => {
  it('falls back when no encounter consumes use', () => {
    const world = w()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'rock', state: {} }] }
    const result = dispatch(state, {
      kind: 'verb-target', verb: 'use', target: { canonical: 'rock', raw: 'rock' },
    }, world)
    expect(result.appended.at(-1)?.text).toBe("You can't think how to use that here.")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/engine/dispatcher.test.ts
```

Expected: FAIL on the prep + use cases.

- [ ] **Step 3: Add the verb-target-prep dispatch branch**

In `dispatch()`, before the closing `return narrate(state, [{ kind: 'narration', text: 'Nothing happens.' }])`:

```ts
  if (command.kind === 'verb-target-prep') {
    const stateWithNoun: GameState = { ...state, lastNoun: command.target }
    // Try the encounter first — it may consume verbs like 'cut vines with shears'.
    const encResult = applyVerbToEncounter(stateWithNoun, command, world)
    if (encResult?.consumed) {
      return { state: encResult.state, appended: encResult.lines }
    }
    if (command.verb === 'light' && command.preposition === 'with') {
      return handleLight(stateWithNoun, command.target.canonical, command.indirect.canonical, world)
    }
    if (command.verb === 'use') {
      return narrate(stateWithNoun, [{ kind: 'narration', text: "You can't think how to use that here." }])
    }
    return narrate(stateWithNoun, [{ kind: 'narration', text: `You're not sure how to ${command.verb} that.` }])
  }
```

- [ ] **Step 4: Add `use` fallback in the existing `verb-target` branch**

Currently `verb-target` falls through to `"You're not sure how to ${verb} that."` for `use`. Improve to the spec wording:

```ts
    if (command.verb === 'use') return narrate(stateWithNoun, [{ kind: 'narration', text: "You can't think how to use that here." }])
```

(Add this above the existing trailing `return` in the `verb-target` block.)

- [ ] **Step 5: Extend `applyVerbToEncounter` to accept verb-target-prep**

In `src/engine/encounters.ts`, in `applyVerbToEncounter`, add a third command-kind branch:

```ts
  // Only verb-target, verb-target-prep, and verb-only commands engage with encounters.
  let verb: string | null = null
  let targetId: string | null = null
  let instrumentId: string | null = null
  if (command.kind === 'verb-target') {
    verb = command.verb
    targetId = command.target.canonical
  } else if (command.kind === 'verb-target-prep') {
    verb = command.verb
    targetId = command.target.canonical
    instrumentId = command.indirect.canonical
  } else if (command.kind === 'verb-only' && command.verb !== 'inventory') {
    verb = command.verb
  } else {
    return null
  }
```

If a transition's `requires.item` is set and `instrumentId` is also set but doesn't match, treat as no transition (the player typed the wrong instrument). The existing matching loop already enforces `requires.item` via inventory presence; add an extra guard inside the `transitions.find` callback:

```ts
    if (t.requires && instrumentId && t.requires.item !== instrumentId) return false
```

(Place this after the existing `requires` block.)

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/dispatcher.ts src/engine/encounters.ts src/engine/dispatcher.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): wire verb-target-prep — explicit `light X with Y` and `use` routing

light X with Y validates the named instrument and reuses handleLight.
use X / use X on Y route through the encounter dispatcher; if no encounter
consumes it, the dispatcher narrates the fallback. The encounter matcher
also rejects transitions whose required item doesn't match the typed
instrument, so a mistyped instrument fails cleanly.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Locked-exit synthetic-world dispatcher test

**Files:**
- Modify: `src/engine/dispatcher.test.ts`

The existing locked-exit test stub asserts `expect(true).toBe(true)`. Replace it with a real fixture that exercises locked exits end-to-end without depending on the live world.

- [ ] **Step 1: Locate and remove the stub**

```bash
grep -n "locked exit" src/engine/dispatcher.test.ts
```

- [ ] **Step 2: Replace with a real test**

Insert (replacing the stub):

```ts
describe('locked exits', () => {
  function makeWorld(): World {
    return {
      startingRoom: 'antechamber',
      startingInventory: [],
      rooms: {
        antechamber: {
          id: 'antechamber',
          title: '[ Antechamber ]',
          descriptions: { firstVisit: '.', revisit: '.', examined: '.' },
          exits: { n: 'vault' },
          lockedExits: { n: { requires: 'rusted-key', lockedNarration: 'The door is locked.' } },
          items: ['rusted-key'],
        },
        vault: {
          id: 'vault',
          title: '[ Vault ]',
          descriptions: { firstVisit: 'You are inside.', revisit: '.', examined: '.' },
          exits: {},
          items: [],
        },
      },
      items: {
        'rusted-key': { id: 'rusted-key', names: ['rusted key', 'key'], short: 'a rusted key', long: '.', initialState: {}, takeable: true },
      },
      encounters: {},
      endings: { true: { whenFlags: {}, narration: '' }, wrong: { whenFlags: {}, narration: '' }, bad: { whenFlags: {}, narration: '' } },
    }
  }

  it('blocks movement without the key', () => {
    const world = makeWorld()
    const state = initialStateFor(world)
    const result = dispatch(state, { kind: 'go', direction: 'n' }, world)
    expect(result.appended.at(-1)?.text).toBe('The door is locked.')
    expect(result.state.location).toBe('antechamber')
  })

  it('permits movement once the key is in inventory', () => {
    const world = makeWorld()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'rusted-key', state: {} }] }
    const result = dispatch(state, { kind: 'go', direction: 'n' }, world)
    expect(result.state.location).toBe('vault')
  })

  it('does not consume the key on passage', () => {
    const world = makeWorld()
    let state = initialStateFor(world)
    state = { ...state, inventory: [{ id: 'rusted-key', state: {} }] }
    const result = dispatch(state, { kind: 'go', direction: 'n' }, world)
    expect(result.state.inventory.find((i) => i.id === 'rusted-key')).toBeDefined()
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test -- src/engine/dispatcher.test.ts
```

Expected: PASS (3 new tests).

- [ ] **Step 4: Commit**

```bash
git add src/engine/dispatcher.test.ts
git commit -m "$(cat <<'EOF'
test(engine): self-contained locked-exit fixture replaces the stub

Verifies blocked movement, key-permitted passage, and that the key is
not consumed by passing through.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Dispatcher — ending detection and end-state lock

**Files:**
- Modify: `src/engine/dispatcher.ts`
- Modify: `src/engine/dispatcher.test.ts`

After every successful dispatch (verb-target, go, verb-only that mutates state — basically every branch except `unknown`/`meta`/disambiguation prompts), check whether any ending's `whenFlags` are now satisfied. First match (in declared order: `true`, `wrong`, `bad`) sets `state.endedWith` and appends an `'ending'` event with the prose. Once `endedWith !== null`, further dispatches return a narration "The story has ended. Type `restart` or `undo`." and do not mutate state otherwise.

- [ ] **Step 1: Write failing tests**

Append to `dispatcher.test.ts`:

```ts
describe('ending detection', () => {
  function makeWorld(): World {
    return {
      startingRoom: 'r',
      startingInventory: [],
      rooms: {
        r: {
          id: 'r',
          title: '[ R ]',
          descriptions: { firstVisit: '.', revisit: '.', examined: '.' },
          exits: { n: 'r2' },
          items: [],
        },
        r2: {
          id: 'r2',
          title: '[ R2 ]',
          descriptions: { firstVisit: '.', revisit: '.', examined: '.' },
          exits: {},
          items: [],
        },
      },
      items: {},
      encounters: {},
      endings: {
        true: { whenFlags: { reachedR2: true }, narration: 'You stand at the top of the stair.' },
        wrong: { whenFlags: {}, narration: 'You disturb what should not be disturbed.' },
        bad: { whenFlags: { tookPhoto: true }, narration: 'The child in it is you.' },
      },
    }
  }

  it('sets endedWith and emits an ending line when flags match', () => {
    const world = makeWorld()
    let state = initialStateFor(world)
    state = { ...state, flags: { reachedR2: true } }
    // Any successful dispatch should now trigger the ending check.
    const result = dispatch(state, { kind: 'verb-only', verb: 'wait' }, world)
    expect(result.state.endedWith).toBe('true')
    const last = result.appended.at(-1)!
    expect(last.kind).toBe('ending')
    expect(last.text).toBe('You stand at the top of the stair.')
  })

  it('honors priority order: true beats wrong beats bad', () => {
    const world = makeWorld()
    // wrong has empty whenFlags, so it matches every state — but true must win
    // when its flags also match.
    let state = initialStateFor(world)
    state = { ...state, flags: { reachedR2: true } }
    const result = dispatch(state, { kind: 'verb-only', verb: 'wait' }, world)
    expect(result.state.endedWith).toBe('true')
  })

  it('rejects further input once ended', () => {
    const world = makeWorld()
    let state = initialStateFor(world)
    state = { ...state, flags: { reachedR2: true } }
    const ended = dispatch(state, { kind: 'verb-only', verb: 'wait' }, world).state
    const result = dispatch(ended, { kind: 'verb-only', verb: 'wait' }, world)
    expect(result.appended.at(-1)?.text).toBe('The story has ended. Type `restart` or `undo`.')
    expect(result.state.location).toBe(ended.location)
  })

  it('does not fire on unknown/meta turns (no state mutation)', () => {
    const world = makeWorld()
    // wrong has empty whenFlags but unknown commands shouldn't re-trigger it.
    // (Bad would also match nothing here since tookPhoto is false.)
    // We verify that an 'unknown' command does not change endedWith.
    const state = initialStateFor(world)
    const result = dispatch(state, { kind: 'unknown', raw: 'fnord', reason: 'unknown-verb' }, world)
    expect(result.state.endedWith).toBeNull()
  })
})
```

Note the third ending in the fixture: `wrong` has empty `whenFlags`. With "every key must match", an empty `whenFlags` matches everything. We rely on priority order to keep this from firing prematurely — `true` is checked first, and only when its conditions fail does `wrong` activate. The "doesn't fire on unknown" test depends on us only running ending detection on *successful* turns (not unknown).

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/engine/dispatcher.test.ts -t "ending detection"
```

Expected: FAIL.

- [ ] **Step 3: Implement ending detection**

Add helper in `dispatcher.ts`:

```ts
const ENDING_PRIORITY: ('true' | 'wrong' | 'bad')[] = ['true', 'wrong', 'bad']

function evaluateEndings(state: GameState, world: World): GameState | null {
  if (state.endedWith) return null
  for (const id of ENDING_PRIORITY) {
    const ending = world.endings[id]
    const flags = ending.whenFlags
    let allMatch = true
    for (const [k, v] of Object.entries(flags)) {
      if (state.flags[k] !== v) { allMatch = false; break }
    }
    if (!allMatch) continue
    // Empty whenFlags would match any state; ensure 'true' / 'bad' must list at
    // least one flag in real worlds. The test fixture's 'wrong' with empty flags
    // is intentional: it's the catch-all replacement ending.
    return {
      ...state,
      endedWith: id,
      transcript: [...state.transcript, { kind: 'ending', text: ending.narration }],
    }
  }
  return null
}
```

Wrap the relevant `dispatch` branches with an end-state check at the top:

```ts
  if (state.endedWith) {
    return narrate(state, [{ kind: 'narration', text: 'The story has ended. Type `restart` or `undo`.' }])
  }
```

(Place near the very top of `dispatch`, after the disambiguation reply branch — that one already redirects, and it must remain functional even after ending so the player can clear stale state with restart/undo.)

After every branch that produces a successful state mutation, evaluate endings. The simplest hook is to wrap the existing `narrate` helper *for game-mutating outcomes*. The cleanest path: just before returning from `dispatch` for `verb-only`, `verb-target`, `verb-target-prep`, and `go`, post-process:

```ts
function withEndingCheck(result: DispatchResult, world: World): DispatchResult {
  const updated = evaluateEndings(result.state, world)
  if (!updated) return result
  const endingLine: TranscriptLine = updated.transcript[updated.transcript.length - 1]!
  return { state: updated, appended: [...result.appended, endingLine] }
}
```

Then in `dispatch`, change the relevant returns:

```ts
  if (command.kind === 'go') return withEndingCheck(handleGo(state, command.direction, world), world)
  if (command.kind === 'verb-only') {
    if (command.verb === 'look') return withEndingCheck(handleLook(state, world), world)
    if (command.verb === 'inventory') return withEndingCheck(handleInventory(state, world), world)
    if (command.verb === 'wait') return withEndingCheck(narrate(state, [{ kind: 'narration', text: 'Time passes.' }]), world)
  }
  if (command.kind === 'verb-target') {
    // ... existing block ...
    return withEndingCheck(/* whichever branch result */, world)
  }
  if (command.kind === 'verb-target-prep') {
    // ...
    return withEndingCheck(/* result */, world)
  }
```

(Apply `withEndingCheck` to every successful state-mutating return inside `verb-target` and `verb-target-prep`. Don't apply it to `unknown`, `meta`, `ambiguous`, or `disambiguation` (the latter recurses).)

- [ ] **Step 4: Run tests**

```bash
npm test -- src/engine/dispatcher.test.ts
```

Expected: PASS for the new tests and existing.

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: PASS. Existing playthrough tests should still work — they only mutate flags via the rat encounter, and the existing `endings.true.whenFlags = { ratGone: true }` means killing the rat triggers the ending. The playthrough probably already tests this; verify the assertion shape still matches (transcript may now contain an `'ending'`-kind line).

- [ ] **Step 6: If playthrough test breaks, update it**

The expected ending narration is now appended with `kind: 'ending'`, not `'narration'`. If the test asserts `kind: 'narration'`, change it to `kind: 'ending'`. The text content should be the same.

- [ ] **Step 7: Commit**

```bash
git add src/engine/dispatcher.ts src/engine/dispatcher.test.ts src/engine/playthrough.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): detect endings on every successful turn

After each state-mutating dispatch, evaluate world.endings in priority
order (true > wrong > bad). The first whose whenFlags are all satisfied
sets state.endedWith and appends a kind:'ending' transcript line. Once
ended, further dispatches return a "story has ended" narration.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: UI — render ending events and disable input on end

**Files:**
- Modify: `src/ui/terminal.ts`
- Modify: `src/ui/crt.css`

When `state.endedWith !== null`, the input field is disabled. Lines with `kind: 'ending'` render with a dedicated CSS class for visual distinction (separator above, larger gap, optional border).

- [ ] **Step 1: Update `renderAll` to use the kind as a class**

`renderAll` already does `el.className = line.kind`. The `'ending'` kind will arrive automatically — the renderer just needs CSS for it.

Verify by reading the function:

```bash
grep -n "el.className" src/ui/terminal.ts
```

Expected: a single line setting `el.className = line.kind`. No code change needed for class assignment.

- [ ] **Step 2: Add an ended-state guard in the keydown handler**

In `terminal.ts`, near the top of the `inputEl.addEventListener('keydown', …)` callback, before any dispatch logic:

```ts
    // Once the game has ended, only restart and undo are allowed.
    if (state.endedWith !== null) {
      const lower = raw.trim().toLowerCase()
      if (lower !== 'restart' && lower !== 'undo') {
        appendLines([{ kind: 'system', text: 'The story has ended. Type `restart` or `undo`.' }])
        return
      }
    }
```

(The dispatcher also rejects, but doing it here saves a roundtrip and keeps the disabled-input UX consistent.)

- [ ] **Step 3: Disable the input visually when ended**

After every state mutation in the keydown handler (and once at startup after `loadState`), set:

```ts
    inputEl.disabled = state.endedWith !== null
```

Find the right hooks:
- After `state = initialStateFor(world)` on startup
- After every `state = result.state` in the dispatch path
- After undo (`state = lastState`)
- After restart (`state = initialStateFor(world)`)

Add a small helper to keep this clean:

```ts
  const syncEndedUI = (): void => {
    inputEl!.disabled = state.endedWith !== null
  }
```

Call `syncEndedUI()` at the same places `refreshChips()` is called.

- [ ] **Step 4: Add CSS for the ending block**

Append to `src/ui/crt.css`:

```css
.ending {
  margin-top: 2em;
  margin-bottom: 1em;
  padding-top: 1em;
  border-top: 1px solid currentColor;
  font-style: italic;
  white-space: pre-wrap;
}

[data-mystery-input]:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/terminal.ts src/ui/crt.css
git commit -m "$(cat <<'EOF'
feat(ui): render ending lines distinctly and lock input on end-state

Ending-kind lines get a separator and italic styling. Once endedWith is
set, the terminal disables the input and rejects all commands except
restart and undo.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Manual playthrough verification

**Files:** none

Type-checking and unit tests verify code correctness. The mystery is a UI-driven game and we have to actually play it.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Expected: Astro dev server prints a localhost URL.

- [ ] **Step 2: Open `/mystery` in a browser**

- [ ] **Step 3: Verify each new behavior**

Run through these inputs and verify the response:

- `look at lamp` → examine response (Task 4 stop-words)
- `read letter` → narrates the readable text (Task 11)
- `light lamp` → "The wick catches." (Task 12); inventory shows `(lit)`
- `extinguish lamp` → "The flame dies." (Task 12); `(lit)` removed
- `light lamp` × 4 (depleting matches) → after the 4th, narration includes "The book is empty."
- `light lamp` after empty → "You have nothing to light it with."
- `light lamp with matches` → behaves the same as implicit (Task 13)
- `light lamp with rock` → "That isn't going to help." (Task 13)
- `use rock` → "You can't think how to use that here." (Task 13)
- `attack rat` (golden path) → reaches the ending → ending text rendered with separator → input disabled
- Click restart in the chip footer → game resets, input re-enabled

If any of the above fail, stop. Investigate and fix before moving on.

- [ ] **Step 4: Verify disambiguation if there's an ambiguous noun in scope**

The current 3-room world has no ambiguous nouns (matches/lamp/letter all distinct), so disambiguation can't be exercised live. Verify it's covered by unit tests instead.

- [ ] **Step 5: Stop dev server (Ctrl-C). No commit needed.**

---

## Done

Final state:
- Engine supports `read`, `light`, `extinguish`, `use` verbs against bible-style item flags.
- Parser handles stop-words, `with`/`on` prepositions, and ambiguous nouns.
- Disambiguation prompts work end-to-end.
- Endings fire on flag match; UI renders them and locks input.
- `theme` is no longer in `GameState`.
- All previously-passing tests still pass.

Ready for **Phase 2**: full bible content draft, authored entirely in markdown for Obsidian editing.

Polish items deferred (tracked in spec section 7): transcript scrolling, cursor blink rate, line fade, scanline accessibility toggle.
