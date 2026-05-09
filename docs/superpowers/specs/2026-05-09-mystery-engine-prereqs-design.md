# Mystery Engine Prereqs — Design

**Status:** approved 2026-05-09
**Goal:** land the engine work that the Halfstreet content bible depends on, so that Phase 2 (full bible content draft into markdown) can author every room/item/encounter/ending the bible specifies without engine gaps.

**Scope:** the hard prerequisites and "should-fix while you're in there" items from `docs/superpowers/specs/halfstreet-followon-notes.md`. Polish items (8–11) are explicitly deferred.

**Out of scope:** any new prose authoring. This round is engine-only. Phase 2 gets its own spec.

---

## 1. New verbs: `read`, `light`, `extinguish`

The parser already aliases these to canonical `Verb` values; the dispatcher does not handle them.

### Schema additions (`Item`)

All optional. Items that don't set them behave as today.

| field | type | meaning |
|---|---|---|
| `readable` | `boolean` | item supports `read X` |
| `lightable` | `boolean` | item supports `light X` / `extinguish X`; toggles `state.lit` |
| `lighter` | `boolean` | item can act as the light source for another item |
| `lighterUses` | `number` | optional remaining-charges counter (matches: 4 by convention; absence = unlimited) |

Body sections (markdown):

- `## read` — prose returned by `read X`. Required iff `readable: true`.
- `## lit` — narration when `light X` succeeds. Optional; falls back to `"It catches."`
- `## extinguished` — narration when `extinguish X` succeeds. Optional; falls back to `"The flame dies."`
- `## lighter-empty` — narration when a lighter's `lighterUses` reaches 0. Optional; falls back to `"It is spent."`

### Dispatcher behavior

`read X`:
- if `!item.readable` → `"There's nothing to read on it."`
- else → narrate the item's `## read` text.

`light X` (implicit lighter):
- if `!item.lightable` → `"You can't light that."`
- if `state.lit === true` → `"It's already lit."`
- find an inventory item with `lighter: true` (and either no `lighterUses` field, or `lighterUses > 0`):
  - if none and inventory contains a depleted lighter → `"You have nothing to light it with."` (with a hint that the spent lighter is depleted)
  - if none at all → `"You have nothing to light it with."`
- else: decrement `lighterUses` on the chosen lighter (if present); set `target.state.lit = true`; narrate the target's `## lit` section. If decrement reached 0, additionally narrate the lighter's `## lighter-empty` section.

`light X with Y`:
- as above but Y must be the inventory item used. Errors: Y not in inventory, Y not a lighter, Y depleted.
- on success, same state mutations.

`extinguish X`:
- if `!item.lightable` → `"You can't extinguish that."`
- if `state.lit !== true` → `"It isn't lit."`
- else: set `state.lit = false`; narrate `## extinguished`.

### Parser additions

New command kind:

```ts
{ kind: 'verb-target-instrument', verb, target: NounRef, instrument: NounRef }
```

Parsing rule: when the noun-phrase tokens (after the verb and any pronoun handling) contain the literal word `with` between two recognized nouns, split into target (left of `with`) and instrument (right of `with`). Both must resolve via the same noun-resolution path used today (visible nouns + inventory). If either fails to resolve, fall back to the current `unknown-noun` behavior.

`with` is also legal as a no-op separator for verbs that don't accept instruments (e.g. `examine letter with care`) — for safety, only `light` consumes the instrument arm in this round; other verbs treat the instrument tail as part of the target phrase and re-resolve as today (no behavior change).

---

## 2. `use` verb

`use X` and `use X on Y` route through the existing encounter dispatcher (`applyVerbToEncounter`). Encounters declare resolutions in their phase transitions; `use` is intentionally thin.

- `use X` → `verb-target` with verb=`use`, target=X. If no encounter consumes it: `"You can't think how to use that here."`
- `use X on Y` → `verb-target-instrument` with verb=`use`, target=X, instrument=Y. The dispatcher routes the verb+target into `applyVerbToEncounter` as today; the encounter's `requires.item` mechanism (already implemented) gates the transition on the instrument being in inventory. The parser-level instrument is therefore a UX nicety: it lets the player type the form the bible uses, and we can validate the typed instrument matches the transition's `requires.item` when present (mismatch → fallback narration "That isn't going to help.").

No special-case dispatcher handler beyond the fallback narration. No new fields on `EncounterDef`.

---

## 3. Disambiguation

Today the parser returns `unknown-noun` when multiple visible aliases match a noun phrase. Replace with an explicit ambiguous variant.

### Parser

New `ParsedCommand` variant:

```ts
{ kind: 'ambiguous', verb: Verb, rawNoun: string, candidates: string[] }
```

Returned when ≥2 entries in `visibleNouns ∪ inventory` match the same alias. `candidates` is the list of canonical ids.

The existing `disambiguation` reply variant stays as-is; the parser already handles single-word reply matching.

### Dispatcher

On `kind: 'ambiguous'`:
- set `state.pendingDisambiguation = { verb, candidates }`
- emit a single narration: `"Which X — A, B, or C?"` where `X` is the `rawNoun` and A/B/C are the `short` strings of each candidate item.

On `kind: 'disambiguation'` reply (already wired):
- read `state.pendingDisambiguation`, clear it, re-issue the original verb against the chosen canonical id.

### Edge cases

- If the player issues a fresh command (not a single-word disambiguation reply) while `pendingDisambiguation` is set, clear it and proceed normally.
- If candidates resolve to identical canonical ids (shouldn't happen given current schema), prefer the first; no error.

---

## 4. Ending UI + flag matching

### Dispatcher

After every dispatched turn (and only on turns that succeeded — meta-commands and parse failures don't trigger ending evaluation), iterate `world.endings`:

- For each `endingId` in a fixed priority order (`true` > `wrong` > `bad` — declared order in `world.endings`), check that **every** key in `whenFlags` is present in `state.flags` and has the matching value. First match wins.
- On match: set `state.endedWith = endingId`; append a narration event with `kind: 'ending'` and the body prose (already loaded from the ending markdown). Mark the run as ended (subsequent turns are rejected with a "the game has ended" narration until restart).

Ending evaluation is pure — same inputs, same outputs.

### UI (terminal renderer)

- `kind: 'ending'` events render with a separator line above, the prose centered or left-aligned with extra vertical gap, no `>` prompt afterward.
- Input field disables (`disabled` attribute or readonly + faded styling).
- Footer chips replace the regular set with `[R] Restart`, `[U] Undo`.
- `restart` (typed or button) resets state and re-enables input.
- `undo` (typed or button) pops the last turn (existing behavior) and re-enables input if the popped state had no ending.

---

## 5. Should-fix items (in scope)

### 5a. Parser stop-word strip

Before noun resolution, strip leading occurrences of `at`, `the`, `a`, `an` from the noun-phrase tokens. So `look at the lamp` → tokens `[lamp]` for matching. The verb itself is not touched.

Affects only the noun phrase. Stop-words *between* meaningful tokens are left alone (e.g. `light lamp with the matches` strips the leading-of-instrument `the`).

### 5b. Remove `theme` from `GameState`

`theme` is a UI preference, not game state. Today, clicking `[B]/[C]` updates DOM + localStorage but not `state.theme`, then the next `theme` meta-verb toggles from a stale value.

Changes:
- delete `theme` field from `GameState` and from save format
- `theme` meta-verb becomes a UI-layer action: dispatcher emits a `kind: 'ui-toggle-theme'` event that the terminal handles
- migration: existing saves drop the `theme` field on load (forward-compatible)

### 5c. Widen `RoomState` type

Today: `Record<string, string | boolean | number>`, but `droppedItems` / `takenItems` store `string[]` via `as` casts.

Change: `Record<string, string | boolean | number | string[]>`. Remove all `as` casts in dispatcher and engine paths that touch `roomState`. No runtime change.

### 5d. Self-contained locked-exit dispatcher test

The current `dispatcher.test.ts` "opens a locked exit" test is a stub. Add a 15-line synthetic world fixture (two rooms, one key item, one locked exit) and exercise:
- locked exit blocks movement with the `lockedNarration`
- carrying the required item permits movement
- the key is not consumed by passage (unless flagged so in future; current behavior: not consumed)

---

## 6. Test plan

TDD throughout, per existing project conventions.

| area | test types |
|---|---|
| schema additions | Zod parse tests (valid + each invalid shape) |
| `read` verb | dispatcher unit (readable, non-readable, missing item) |
| `light` / `extinguish` | dispatcher unit (lightable + lighter, lighter-with-charges decrement, lighter-empty fallthrough, explicit `with`, error paths) |
| `use` verb | dispatcher unit (no encounter consumes → fallback; encounter consumes → routed) |
| disambiguation | parser unit (ambiguous candidates), dispatcher round-trip (prompt → reply → re-issue) |
| ending detection | dispatcher unit per ending; priority order; ended-state turn rejection |
| stop-word strip | parser unit (`look at lamp`, `read the letter`, etc.) |
| theme removal | save round-trip drops field; `theme` meta-verb emits UI event, no state mutation |
| roomState widen | type-level (compile passes); existing tests unchanged |
| locked-exit | new synthetic-world dispatcher test |
| manual playthrough | golden path on current 3-room world after all changes |

---

## 7. Out of scope — follow-up tracker

These are tracked but not part of this round:

- Transcript scrolling (PageUp/PageDown)
- Cursor blink at 1.05 Hz
- Old-line opacity fade at top of transcript
- Scanline accessibility toggle (`[?]` settings dropdown — important for photosensitivity)

---

## 8. After this lands

Phase 2 brainstorming → spec → plan: full bible content draft. All 25+ rooms, all bible items, all encounters, all 5 endings authored to markdown for Obsidian editing. Engine will support every interaction the bible specifies by then.
