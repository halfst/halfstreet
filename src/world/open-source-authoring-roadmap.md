# Open-Source Authoring Roadmap

Goal: make Halfstreet usable as a small text-adventure toolkit, where a new author can create or fork a story mostly by editing markdown inside this `src/world` Obsidian vault.

Bias: if a setting, rule, phrase, object, or workflow can reasonably live in markdown frontmatter or markdown sections, put it there. TypeScript should remain the runtime, validator, and escape hatch for genuinely executable behavior.

## Principles

- Keep `src/world` as the authoring surface. Authors should not need to hunt through `src/engine`, `src/ui`, or `src/pages` for ordinary story changes.
- Prefer markdown files with frontmatter over TypeScript config when the data is declarative.
- Preserve Obsidian-friendly wikilinks for references between rooms, items, encounters, endings, mechanics, and author notes.
- Separate generic engine behavior from Halfstreet-specific story behavior.
- Keep validation strict. Markdown should be friendly to write, but mistakes should fail loudly during dev and CI.
- Make every new abstraction prove itself against the current Halfstreet content before calling it reusable.

## Target Vault Shape

This is the rough destination, not a required first commit:

```text
src/world/
  game.md
  parser.md
  ui.md
  mechanics/
    light.md
    resolve.md
    drunk.md
    inventory.md
  actions/
    burn-letter.md
    drink-whiskey.md
  rooms/
  items/
  encounters/
  endings/
  bugs/
  authoring.md
  open-source-authoring-roadmap.md
```

`game.md` should become the primary manifest: title, description, starting room, starting inventory, ending priority, enabled mechanics, default UI labels, and other story-level settings.

`parser.md` should hold author-controlled vocabulary: verbs, aliases, prepositions, direction words, meta commands, and no-target verbs.

`mechanics/*.md` should describe optional rule modules in markdown. Some mechanics can be fully declarative; others can bind to a named TypeScript handler while keeping all author-facing knobs and prose in markdown.

`actions/*.md` should replace one-off hardcoded interactions where possible, especially story-specific combinations like burning the letter or drinking whiskey.

## Phase 1: Manifest in Markdown

Move story-level constants out of TypeScript and into `src/world/game.md`.

Candidate frontmatter:

```yaml
id: halfstreet
title: Half Street
description: A gothic mystery.
startingRoom: "[[outside-gate]]"
startingInventory:
  - "[[letter]]"
  - "[[matches]]"
  - "[[broken-cigarette]]"
endingPriority:
  - mercy
  - "true"
  - replacement
  - bad
  - wrong
transcriptCap: 200
```

Candidate sections:

```md
## opening-art
...

## help
...

## ended
The story has ended. Type `restart` or `undo`.
```

Implementation notes:

- Add a `parseGame` loader path beside `parseRoom`, `parseItem`, `parseEnding`, and `parseEncounterNarration`.
- Update `World` to include manifest data instead of hardcoding `startingRoom`, `startingInventory`, required endings, ending priority, ASCII art, and help copy in engine/UI files.
- Keep validation in `src/world/index.ts`: starting room must exist, starting inventory must reference real items, ending priority must reference loaded endings.
- Treat this as the first reusable boundary. A fork should be able to change the starting room and opening text without touching TypeScript.

Acceptance criteria:

- `src/world/index.ts` no longer hardcodes `outside-gate`, starting items, or ending priority.
- Opening ASCII/help text can be edited in Obsidian.
- Existing Halfstreet tests and build still pass.

## Phase 2: Parser Vocabulary in Markdown

Move parser vocabulary into `src/world/parser.md`.

Candidate frontmatter:

```yaml
directions:
  n: [n, north]
  s: [s, south]
  e: [e, east]
  w: [w, west]
  u: [u, up]
  d: [d, down]
prepositions: [with, on, in, to]
stopWords: [at, the, a, an]
noTargetVerbs: [look, inventory, wait, listen]
metaVerbs: [restart, undo, hint, save, quit, theme]
verbs:
  go: [go, walk, move]
  look: [look, l]
  examine: [examine, x, inspect]
  take: [take, get, grab, pick up]
  drop: [drop, put, leave]
  use: [use, combine]
  open: [open, uncover]
  close: [close]
  drink: [drink, sip]
  read: [read]
  light: [light]
  extinguish: [extinguish, douse]
  attack: [attack, kill, fight, strike]
  hold: [hold, show]
  push: [push, press]
  pull: [pull]
  cut: [cut, trim]
  play: [play]
  listen: [listen]
  pour: [pour]
  wait: [wait, z]
```

Implementation notes:

- Keep the parser code generic: it should consume a parsed vocabulary object rather than owning Halfstreet's vocabulary.
- Allow multi-word verb aliases from markdown, not a separate hardcoded `TWO_WORD_VERBS` list.
- Validate that every verb key maps to an engine-supported verb or a registered custom action.
- Keep parser behavior deterministic and testable with a small synthetic vocabulary fixture.

Acceptance criteria:

- A new verb alias can be added by editing `parser.md`.
- Parser tests cover markdown-loaded vocabulary.
- Existing Halfstreet commands continue to parse.

## Phase 3: Text and System Messages in Markdown

Move generic narration strings that authors may want to tune into markdown.

Candidate file: `src/world/messages.md`

Candidate sections:

```md
## unknown-verb
You consider the words, but they don't fit this place.

## unknown-noun
You don't see anything like that here.

## malformed
You hesitate.

## nothing-to-confirm
Nothing to confirm.

## cancelled
Cancelled.

## inventory-empty
You are empty-handed.

## taken
Taken.

## dropped
Dropped.
```

Implementation notes:

- Add a small message lookup helper with fallback defaults.
- Use message keys from dispatcher and UI instead of inline strings.
- Keep heavily stateful narration in mechanics/actions, not in one giant message file.

Acceptance criteria:

- Common parser/dispatcher responses are author-editable in Obsidian.
- Missing message keys fail validation or fall back predictably.

## Phase 4: Mechanics as Markdown-Configured Modules

Move optional, reusable systems into `src/world/mechanics/*.md`.

Start with mechanics that already exist:

- `light.md`: burn duration, burn trigger policy, item state keys, meter visibility, extinguish behavior, author-facing prose keys.
- `resolve.md`: resolve ladder, safe-room recovery, failure behavior.
- `drunk.md`: special room prefix, max moves, pass-out room, item reset behavior, visual effect flag.
- `inventory.md`: carry limits later, drop policy, lit-drop restrictions.

Candidate `light.md` frontmatter:

```yaml
enabled: true
handler: light
maxTurns: 6
burnOn:
  - move
  - wait
stateKeys:
  lit: lit
  burn: burn
ui:
  meter: true
  icon: candle
messages:
  noLighter: You have nothing to light it with.
  alreadyLit: It's already lit.
  notLit: It isn't lit.
  dropLit: Extinguish it first.
```

Implementation notes:

- TypeScript still owns the actual light algorithm, but markdown owns the knobs and prose.
- `World` should expose enabled mechanics as parsed data.
- Dispatcher should call enabled mechanic handlers through a small registry rather than direct Halfstreet-specific functions.
- Do not overgeneralize on the first pass. Convert one mechanic, keep tests green, then repeat.

Acceptance criteria:

- The light timer can be changed from markdown.
- Disabling a mechanic in markdown removes its behavior cleanly.
- Existing light UI still works from parsed mechanic data.

## Phase 5: Declarative Actions

Move one-off item interactions into `src/world/actions/*.md` where possible.

Candidate `burn-letter.md`:

```yaml
id: burn-letter
verbs: [use, light]
requires:
  allVisibleOrHeld:
    - "[[letter]]"
    - "[[matches]]"
consumes:
  inventory:
    - "[[letter]]"
decrements:
  item: "[[matches]]"
  stateKey: uses
setsFlags:
  letterBurned: true
```

```md
## success
The letter catches at one corner. In a few breaths it is ash.

## spent
The matchbook is empty.
```

Candidate `drink-whiskey.md` may need a `handler: drunk-transition` escape hatch because it changes room, removes and resets an item, and starts a timed mode. That is acceptable: markdown should still own the item ids, destination room, max moves, and prose.

Implementation notes:

- Support a small declarative action grammar first: required items, consumed items, state decrement, flags, room transition, success narration.
- Add `handler` as an explicit escape hatch for complex behavior.
- Validate all referenced items, rooms, flags, and section keys.

Acceptance criteria:

- Burning the letter no longer lives as hardcoded ids in the dispatcher.
- At least one complex action remains supported through a named handler with markdown-owned config.

## Phase 6: Encounters Fully in Markdown

Current state: implemented. Encounter phase machines and prose now live together in `src/world/encounters/*.md`.

Destination: encounter phase machines live in `src/world/encounters/*.md`.

Candidate frontmatter:

```yaml
id: rat
startsIn: "[[cellar-stair]]"
initialPhase: lurking
aliases: [rat]
onResolved:
  setFlags:
    ratGone: true
defaultWrongVerbNarration: wrong-verb
phases:
  lurking:
    description: lurking
    transitions:
      - verb: attack
        target: rat
        chipLabel: ATTACK RAT
        chipCommand: attack rat
        narration: attack-rat-resolved
        to: resolved
      - verb: wait
        chipLabel: WAIT
        narration: wait-stays
        to: lurking
```

Sections remain the prose:

```md
## lurking
...

## attack-rat-resolved
...

## wait-stays
...

## wrong-verb
...
```

Implementation notes:

- Replace `encounters.ts` with parsed encounter definitions from markdown.
- Validate every `description`, `narration`, and `defaultWrongVerbNarration` key points to a real section.
- Keep support for custom handler hooks later if needed, but do not start there.

Acceptance criteria:

- Adding a simple encounter requires one markdown file only.
- No duplicated `startsIn` / `initialPhase` values between markdown and TypeScript.
- Encounter transition chips still compute correctly.

## Phase 7: UI Configuration in Markdown

Move author-facing UI labels, themes, footer links, title metadata, and feature toggles into `src/world/ui.md`.

Candidate frontmatter:

```yaml
pageTitle: Halfstreet - Ethan J Lewis
description: A gothic mystery.
robots: noindex
themeColor: "#1a0d00"
footer:
  copyright: "2026 Ethan J Lewis"
  links:
    - label: GNU 3.0
      href: https://half.st/ejlewis/halfstreet/src/branch/main/LICENSE
    - label: Source Code
      href: https://half.st/ejlewis/halfstreet
features:
  chips: true
  lightMeter: true
  typedEffect: true
  roomScroll: true
```

Implementation notes:

- Keep layout and styling in Astro/CSS.
- Let markdown control labels, metadata, and feature switches.
- Avoid making authors edit `src/pages/index.astro` for ordinary title/footer/help changes.

Acceptance criteria:

- Site metadata and footer links are editable from `src/world/ui.md`.
- Feature toggles are validated and reflected in the UI.

## Phase 8: Authoring Docs and Starter Template

Add docs that live where authors work.

Files:

- `src/world/authoring.md`: how to create rooms, items, encounters, endings, mechanics, and actions.
- `src/world/templates/room.md`
- `src/world/templates/item.md`
- `src/world/templates/encounter.md`
- `src/world/templates/action.md`
- `src/world/templates/game.md`

Implementation notes:

- Keep docs short and example-heavy.
- Include "common validation errors" with exact fixes.
- Add a tiny sample adventure later if the repo is meant to be a toolkit, not only a Halfstreet fork.

Acceptance criteria:

- A new author can add a room, item, simple encounter, and ending by following files inside the Obsidian vault.
- Templates use wikilinks and valid frontmatter.

## Phase 9: Package Boundary

Once the markdown-driven pieces are stable, decide whether to keep this as a forkable app or extract a package.

Forkable app path:

- Keep everything in one Astro repo.
- Document "replace `src/world` to make your own game."
- Lowest maintenance burden.

Package path:

- Extract generic engine/loader/parser into a package, with Halfstreet as an example app.
- Better for reuse, but increases release and compatibility work.

Recommendation: stay forkable first. Do not package until at least two different worlds can run through the same engine without code edits.

## Suggested Implementation Order

1. Add `game.md` manifest and parse it.
2. Move opening/help/ending priority/start state into manifest-backed world data.
3. Add `parser.md` and make parser consume loaded vocabulary.
4. Add `messages.md` for common system responses.
5. Convert the light mechanic to markdown-configured runtime behavior.
6. Convert `burn-letter` into a declarative action.
7. Convert encounter state machines into markdown.
8. Add `ui.md` for metadata, footer, and UI feature toggles.
9. Add authoring docs and templates.
10. Reassess package extraction after a second sample world exists.

## Current Status

- Phase 1 is implemented: `game.md` controls the manifest, starting room, starting inventory, ending priority, transcript cap, opening art, help text, and ended text.
- Phase 2 is implemented: `parser.md` controls command vocabulary, direction aliases, prepositions, stop words, no-target verbs, and meta verbs.
- Phase 3 is implemented: `messages.md` controls common parser, dispatcher, and UI system responses with TypeScript defaults as fallback.
- Phase 4 is implemented for the first reusable mechanics: `mechanics/light.md` controls the light mechanic's enabled state, burn triggers, burn duration, state keys, meter toggle, and light prose fallbacks; `mechanics/resolve.md` controls the resolve ladder, safe-room recovery, wrong-verb cost, and retreat behavior.
- Phase 5 has its first two action patterns implemented: `actions/burn-letter.md` defines a simple declarative interaction, and `actions/drink-whiskey.md` defines a complex `drunk-transition` handler-backed action with markdown-owned item ids, destination room, move cap, reset room, wake room, and prose.
- Phase 5 validation is hardened: handler-backed actions require their handler-specific prose sections, unsupported handler config is rejected, duplicate handler ownership fails during world assembly, and missing room/item references report the exact action field authors need to fix.
- Phase 6 started with an incremental migration: encounter markdown gained full phase machine support when `phases:` is present, and `rat` became the first fully markdown-owned encounter.
- Phase 6 now has its first simple batch migrated: `window-guest`, `covered-cage`, and `piano-echo` are markdown-owned, including aliases, resolved/failed effects, wrong-verb text, transition chips, and transition commands.
- Phase 6 also has the wait-resolved batch migrated: `breathing-wall`, `linen-shape`, and `stair-sleeper` are markdown-owned, including aliases, resolved/failed effects, wrong-verb text, and wait transition chips.
- Phase 6 now has an item-gated batch migrated: `ivy-figure`, `child-beneath-well`, and `bone-keeper` are markdown-owned, including required inventory items, repeated narration keys, transition-level flags, alternate fallback transitions, and resolved/failed effects.
- Phase 6 now has a garden/lower-passage batch migrated: `garden-procession`, `reflection`, and `root-movement` are markdown-owned, including wait, item-gated, and listen transitions plus resolved/failed effects.
- Phase 6 is implemented: the final legacy batch (`portrait-woman`, `basilisk`, `vault-memory`, `creaking-floorboard`, `distant-steps`, and `rainwater-basin`) is markdown-owned, `encounters.ts` has been removed, and world assembly now requires every encounter markdown file to define `phases:`.
- Phase 7 is implemented: `ui.md` controls page title, meta description, robots, theme color, footer copyright/link/build labels, and feature toggles for chips, the light meter, typed text, and room-title scrolling.
- Phase 8 is implemented: `authoring.md` explains the markdown authoring workflow, common validation errors, and current room/item/encounter/ending/mechanic/action surfaces; `templates/` includes starter room, item, encounter, action, and game files.
- Phase 9 is resolved for now in favor of the forkable app path: README and vault-local authoring docs tell authors to replace `src/world` while keeping the Astro app and TypeScript runtime intact. Package extraction is deferred until a second sample world proves the boundary.

## Near-Term Slice

The next concrete slice should stay on open-source polish without extracting a package:

- Add a short root-level contribution guide if outside authors are expected to send changes.
- Decide whether to include a tiny second sample world fixture to test the forkable boundary.
- Keep package extraction deferred until that sample world can run without Halfstreet-specific code edits.

This keeps the toolkit roadmap focused on a low-maintenance open-source shape before adding package complexity.
