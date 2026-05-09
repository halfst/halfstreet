# Mystery text adventure ("Halfstreet") — design spec

**Date:** 2026-05-08
**Status:** Draft — pending user approval
**Scope:** A self-contained text adventure game accessed via the homepage MysteryCard (the violet ★). Includes the route, the game engine, the world content, the terminal UI, the mobile input fallback, and the persistence layer. Excludes any change to the bento grid itself (handled by the homepage redesign plan), and excludes pointing halfstreet.io at the route (a future DNS task, not part of this build).

**Dependencies:** This build is independent of the homepage redesign plan. The route works standalone (typing `/mystery` directly always works). The MysteryCard click handler is the entry point *if and when* the redesign ships; if the redesign hasn't shipped yet, the route still functions and any existing homepage element can link to it.

## Goal

Ship a gothic mystery text adventure called **Halfstreet** that reads as a real piece of writing — not a tech demo. Style it after early MS-DOS text adventures with two switchable themes (amber phosphor, ANSI/BBS color). Engine is hand-authored, deterministic, and runs entirely client-side. No LLM is called at runtime. The game must be genuinely fun on desktop *and* playable on mobile.

## Non-goals

- Calling Claude or any LLM at runtime. Authoring-time use of Claude is fine; runtime is not. (See `feedback_no_llm_in_production.md`.)
- A backend / server / database — game state is client-side only.
- A graphical adventure (no Sierra-style image pane). Text only.
- A multiplayer or shared-state experience.
- Procedural / random world generation. The world is fully authored.
- Sound or music in v1.
- Pointing halfstreet.io at the route (separate DNS task).
- Touching the existing bento grid layout, MysteryCard component, or the `mystery-card-click` event wiring (assumed in place from the homepage redesign).

## User-facing summary

A visitor clicks the ★ on the homepage. The page transitions to a fullscreen CRT terminal at `/mystery`. They are dropped into the opening of *Halfstreet* — a gothic mystery in the register of Le Fanu and Shirley Jackson, told entirely in second-person prose. They explore a haunted estate, collect items (keys, lamps, a tarnished mirror, a cane sword), encounter villains they must outwit or fight, and over 18–22 rooms of content arrive at one of two or three endings. Their progress auto-saves; if they leave and come back a week later, it's still there. ESC or `> quit` returns them to the homepage.

On mobile, a context-aware row of tap chips above the input lets them play without typing.

## Aesthetic

Two themes, user-toggleable via a small `[B] [C]` switch in a corner of the terminal. The active theme is remembered in localStorage. Both share: monospace font (system stack: `'Courier New', 'Cascadia Mono', 'Consolas', monospace`), CRT bezel, scanlines, subtle phosphor text-glow, blinking cursor.

| | Amber (default) | ANSI |
|---|---|---|
| Background | `#1a0d00` | `#000080` |
| Foreground | `#ffb000` | `#ffffff` |
| Accents | none | `#ffff55` (titles), `#55ffff` (interactables), `#aaaaaa` (dim) |
| Room headers | plain text, dashed underline | double-line box-drawing characters |

The toggle is one of the first things a player sees; the choice is non-destructive and reversible per turn.

## Architecture

A self-contained TypeScript engine inside the existing Astro 6 site, served as a single client-rendered route.

Three layers, with strict directionality:

```
                 ┌────────────────────┐
                 │   World content    │   (authored TypeScript modules)
                 │  rooms / items /   │
                 │   encounters /     │
                 │  story flags       │
                 └─────────┬──────────┘
                           │ pure data, no logic
                           ▼
                 ┌────────────────────┐
                 │       Engine       │   (pure functions)
                 │ parser • dispatch  │
                 │ encounters • save  │
                 └─────────┬──────────┘
                           │ (state in, state + narration out)
                           ▼
                 ┌────────────────────┐
                 │         UI         │   (browser-only)
                 │ terminal • chips • │
                 │ theme • CRT styles │
                 └────────────────────┘
```

- World content has **no logic** — it is plain data the engine reads.
- The engine is **pure** — it takes state + input and returns new state + narration. No DOM access. Fully unit-testable.
- The UI is **render + input only** — it never mutates game state directly; it sends commands to the engine and renders the result.

This split means the writing (largest piece) can iterate without touching engine code, the engine can iterate without touching the UI, and the engine is fully testable without a browser.

## Where it lives

### Route

A new Astro page at `src/pages/mystery.astro` rendering the terminal at `/mystery`. The page has no bento, no nav, no footer — it fills the viewport. Title is `"Halfstreet — Ethan J Lewis"`.

### Entry from the homepage

The MysteryCard (created in the homepage redesign plan, Task 6) already dispatches a `mystery-card-click` CustomEvent on click. A small client script in the bento page listens for this event and navigates to `/mystery` (full navigation, not a SPA route — keeps the URL real and bookmarkable).

### Exit

`> quit` or `ESC` navigates back to `/`. Game state is auto-saved before exit; revisiting `/mystery` resumes from the same point. The browser back button works the same way.

## Engine details

### State

A single immutable object. Every turn produces a new one; the prior state is retained for one-step `UNDO`.

```typescript
interface GameState {
  location: RoomId
  inventory: ItemInstance[]
  flags: Record<string, boolean | number | string>
  resolveLevel: 'steady' | 'shaken' | 'reeling' | 'returning'
  encounterState: Record<EncounterId, EncounterPhase> | null
  lastNoun: NounRef | null            // for pronoun resolution ("it")
  transcript: TranscriptLine[]         // capped at 200 lines
  theme: 'amber' | 'ansi'
  schemaVersion: number                // for save migration
}
```

### Parser

Tokenizes a line of input and resolves it to a structured command:

```typescript
type ParsedCommand =
  | { kind: 'verb-target'; verb: Verb; target: NounRef; preposition?: Prep; indirect?: NounRef }
  | { kind: 'meta'; verb: 'restart' | 'undo' | 'hint' | 'save' | 'quit' | 'theme' }
  | { kind: 'unknown'; raw: string }
```

Features:

- Case-insensitive
- Synonyms, e.g. `take` / `get` / `grab` / `pick up` → `take`
- Direction shortcuts: `n` / `s` / `e` / `w` / `u` / `d` map to `go <dir>`
- Pronouns: `it` resolves to `state.lastNoun`; ambiguous if none
- Multi-word object disambiguation: `take key` with two keys present prompts `"Which key — the brass key or the iron key?"` and waits for a one-word reply
- `look` recaps the room; `look at X` (or `examine X` / `x X`) examines
- `inventory` / `inv` / `i`
- Meta-commands: `restart`, `undo`, `hint`, `save` (no-op acknowledgement since save is automatic), `quit`, `theme` (toggles)
- Unknown verbs return one of a small pool of in-character refusals, never a generic "PARSER ERROR"

### Dispatcher

Pure function: `(state, command) => { state, narration }`. Looks up the verb handler, validates against the world data (e.g. is the exit valid? is the item present? is the encounter active?), produces narration text, returns the new state.

### Encounters

Each encounter is a small phase machine. Phases are authored data:

```typescript
interface Encounter {
  id: EncounterId
  startsIn: RoomId
  initialPhase: EncounterPhase
  phases: Record<EncounterPhase, {
    description: string                          // shown each turn this phase
    transitions: {
      verb: Verb
      target?: NounRef
      requires?: ItemRef[] | StateCondition
      to: EncounterPhase | 'resolved' | 'failed'
      narration: string
      resolveCost?: 1 | 2                        // wrong moves cost player resolve
    }[]
  }>
  onResolved: { setFlags?: Record<string, unknown>; unblockExits?: ExitRef[] }
}
```

The "right" verb advances the phase; "wrong" verbs cost resolve and surface a clue in narration. A handful of minor enemies skip the phase model entirely and use simple HP-style combat (player swings sword, enemy HP decrements, enemy hits back).

### Resolve

A four-step soft-HP track: `steady → shaken → reeling → returning`. Each "wrong" encounter verb costs a step. At `returning`, the next failed verb retreats the player to the previous safe room with a clue. Resolve regenerates one step per safe room entered. The player cannot truly die except via one specific late-game choice that reaches a "bad ending" — `RESTART` is the only way out.

### Save

Auto-save to localStorage every turn under key `halfstreet:save:v1`. Saved data is the full `GameState` minus `transcript` rendering details (transcript is included but capped at last 200 lines). On load, if a save exists, the terminal shows `> CONTINUE` / `> NEW GAME` choices first. `RESTART` clears the save with a one-prompt confirmation.

`schemaVersion` is bumped if the save shape changes; older saves are silently discarded with a "Save format updated — starting fresh" message rather than failing.

## World content

### Story

**Halfstreet** — gothic mystery, M-scope, 18–22 rooms across three areas (the house, the grounds, the lower vaults). The player is an unnamed visitor called to an address that does not appear on any map. The road behind them is gone. The single overarching question — *what is buried at Halfstreet, and why* — resolves in one of three reachable end-states: a "true" ending, an alternate "wrong" ending reachable via specific player choices, and one "bad" ending reachable only via the late-game choice that costs the player their character. All three are authored.

### Voice

Second-person, present tense, sparse. Register: Le Fanu, Shirley Jackson, M.R. James. Authored prose, not generated. Each room has:

- A `firstVisit` description (longer, sets atmosphere)
- A `revisit` description (shorter, references state)
- An `examined` description (richer detail when player types `look`)
- Per-object descriptions

Each encounter has phase-by-phase narration, with multiple variants for wrong-verb responses so encounters don't feel scripted.

### Items

Authored item set including: brass key, iron key, tarnished silver mirror, oil lamp, safety matches, cane sword, folded letter, plus a handful of discoverable artifacts. Items have state (`lit` / `unlit`, `held` / `placed`), can combine in specific ways (matches + lamp = lit lamp), and gate progression. Inventory is unbounded for an M-scope game.

### Authoring workflow (hybrid)

A two-stage process:

1. **Content bible** (Claude drafts, user approves): a single document under `docs/superpowers/specs/halfstreet-bible.md` listing all rooms with one-sentence descriptions and exits, all items with purpose, all encounters with their solution, the opening scene in full prose, and the final scene(s) in full prose. User reviews and edits before any room prose is locked.
2. **Room prose** (Claude drafts in user's voice): once the bible is approved, Claude authors the per-room prose in batches; user reviews each batch and may reject/rewrite. The opening and ending scenes from the bible are used verbatim — they are the style anchors.

This means: user controls the structure and the style anchors; Claude does the volume drafting using those anchors.

## UI / Terminal

A single client-only TypeScript module renders the terminal. Layout:

```
┌─────────────────────────────────────────────────────────┐
│ ╔═══════════════════════════════════════════╗      [B] │  ← theme toggle
│ ║                                           ║      [C] │
│ ║   transcript scrolls upward as text       ║          │
│ ║   appears; latest line at bottom          ║          │
│ ║                                           ║          │
│ ║                                           ║          │
│ ║   > take torch_                           ║          │
│ ╚═══════════════════════════════════════════╝          │
│                                                         │
│ ┌─ chips (mobile/touch only) ──────────────────────┐    │
│ │  ↑N   →E   ↓S   ←W   LOOK   TAKE TORCH   INV    │    │
│ └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

- **Transcript** auto-scrolls; old lines fade in opacity at the top.
- **Cursor** blinks at 1.05Hz at the input position.
- **Scanlines** overlay the entire terminal at low opacity; can be disabled in a `[?]` settings dropdown for accessibility.
- **Phosphor glow** is a `text-shadow` of `0 0 1.5px currentColor`.
- **Bezel** is the rounded outer container with inset shadow.
- The transcript is keyboard-scrollable (`PageUp` / `PageDown`).

### Mobile chips

Below the terminal on touch devices (detected via `pointer: coarse` media query), a horizontal row of context-aware tap chips:

- **Direction chips** for valid exits (`↑ N`, `→ E`, etc.); invalid directions are shown dimmed
- **Item chips** for visible-and-takeable items (`TAKE TORCH`, `TAKE KEY`)
- **Encounter chips** for present NPCs/encounters (`EXAMINE REVENANT`, `HOLD MIRROR TO REVENANT`)
- **Persistent chips**: `LOOK`, `INV`

The chip set recomputes from world state every turn. Tapping a chip injects the command into the input and submits. Typing still works on mobile (Bluetooth keyboard, etc.). Chip styling matches the active theme.

### Theme toggle

A small `[B] [C]` indicator in the upper right. Click cycles. Choice persists in localStorage under `halfstreet:theme:v1`. Default is `amber`.

## Persistence

| Key | Value | Lifetime |
|---|---|---|
| `halfstreet:save:v1` | full GameState (JSON) | until `RESTART` or schema bump |
| `halfstreet:theme:v1` | `'amber'` \| `'ansi'` | until manually changed |

No cookies, no server, no third-party. All state lives in the browser.

## Error handling

- **Malformed save in localStorage** → silently discard, start fresh, log to console
- **Schema-version mismatch** → discard with a one-line in-terminal notice, start fresh
- **Unknown verb** → in-character refusal, no error
- **Ambiguous noun** → disambiguation prompt
- **No-op verb in current context** (e.g. `take` something that isn't there) → in-character explanation, no error
- **Engine throws** (should never happen) → caught at the UI boundary, shown as `[ The terminal hums and resets. ]`, save preserved, transcript continues

## Testing

Vitest tests for the engine. No automated UI tests; UI is verified by manual smoke at desktop / tablet / mobile breakpoints.

| File | What it covers |
|---|---|
| `parser.test.ts` | Tokenization, synonyms, direction shortcuts, pronoun resolution, disambiguation, meta-commands |
| `dispatcher.test.ts` | Each verb against representative world states; invalid commands; resolve depletion |
| `encounters.test.ts` | Every encounter from start to all valid resolutions, including failure paths |
| `save.test.ts` | Round-trip identity; schema-version migration / discard; transcript truncation at 200 lines |
| `playthrough.test.ts` | A scripted command sequence reaches a known win-state from a fresh start |

## File layout

```
src/
  pages/
    mystery.astro              # the route — fullscreen CRT terminal
  mystery/
    world/
      rooms.ts                 # room data + authored prose
      items.ts                 # item data
      encounters.ts            # NPC / encounter data
      story.ts                 # story flags, win conditions, endings
      index.ts                 # barrel export of the world bundle
    engine/
      types.ts                 # GameState, ParsedCommand, etc.
      parser.ts
      parser.test.ts
      dispatcher.ts
      dispatcher.test.ts
      encounters.ts
      encounters.test.ts
      save.ts
      save.test.ts
      playthrough.test.ts
    ui/
      terminal.ts              # client-side terminal rendering + input
      chips.ts                 # mobile chip computation
      theme.ts                 # theme toggle + persistence
      crt.css                  # bezel, scanlines, phosphor, themes
docs/
  superpowers/
    specs/
      2026-05-08-mystery-text-adventure-design.md   # this file
      halfstreet-bible.md                            # content bible (created in implementation)
```

The MysteryCard click handler from the homepage redesign plan is unchanged; this build adds the route and the terminal at the other end of the navigation.

## Acceptance criteria

1. Clicking the ★ on the homepage navigates to `/mystery` and presents the opening scene of Halfstreet in the amber theme by default.
2. The terminal accepts typed input on desktop and tap-chip input on mobile, with the chip set updating per turn from world state.
3. The player can complete one full playthrough end-to-end (scripted in `playthrough.test.ts`).
4. Auto-save persists across page reloads and across browser sessions; `RESTART` clears the save with confirmation.
5. Theme toggle switches between amber and ANSI per click; choice persists.
6. ESC and `> quit` return to `/`; revisiting `/mystery` resumes from the saved state.
7. The engine ships with comprehensive vitest coverage of the parser, dispatcher, encounter state machines, and save layer. The `playthrough.test.ts` integration test reaches a known win-state from a fresh start.
8. No runtime LLM calls anywhere in the shipped code.
9. The 18–22 rooms of authored prose pass a final user pass before merge — writing quality is the primary acceptance bar.
10. Bundle size for the `/mystery` route does not exceed 80kb gzipped (excluding shared site assets), to keep first-load time under a second on mid-tier mobile.

## Out of scope (future)

- Sound design (typewriter clicks, ambient drone)
- A high-score / "endings collected" persistent meta-layer across plays
- Pointing halfstreet.io at `/mystery` — DNS task, not a code task
- Sharing a transcript / endgame screenshot
- Achievements / steam-style unlocks
- Localization
