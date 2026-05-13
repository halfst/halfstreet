# Authoring Halfstreet

Halfstreet is authored from this `src/world` vault. The TypeScript runtime loads and validates the markdown; ordinary story changes should start here.

Use wikilinks for references when you can. The loader accepts `[[foyer]]` and stores it as `foyer`, so Obsidian links stay useful without changing runtime ids.

## Forking The Game

The current open-source shape is a forkable Astro app. Keep `src/engine`, `src/ui`, and `src/pages` in place, then replace the markdown in this vault with your own rooms, items, encounters, endings, mechanics, actions, parser vocabulary, and UI labels.

For a new game, update these files first:

- `game.md`: title, starting room, starting inventory, ending priority, opening art, help text, and end text.
- `parser.md`: direction words, verb aliases, prepositions, stop words, no-target verbs, and meta verbs.
- `ui.md`: page title, meta description, footer labels and links, build label, and UI feature switches.
- `templates/`: copy these starter files when adding new world content.

After edits, run `npm test` from the repo root. Validation errors are meant to point back to the markdown field or section that needs fixing.

## Rooms

Room files live in `rooms/`. Every room needs frontmatter plus three prose sections:

- `## first-visit`
- `## revisit`
- `## examined`

Set unused exits to `null`. Set exits to `[[room-id]]` when they lead somewhere. Put item ids in `items`, and set `encounter` when a room starts an encounter.

```yaml
id: sample-room
title: "[ Sample Room ]"
exitN: "[[other-room]]"
exitS: null
exitE: null
exitW: null
exitU: null
exitD: null
items:
  - "[[sample-key]]"
encounter: null
safe: true
```

Locked exits use a matching `exitXRequires` and `exitXLockedText` pair. The requirement must be an item id or a known flag.

```yaml
exitN: "[[locked-room]]"
exitNRequires: sample-key
exitNLockedText: The door will not move.
```

## Items

Item files live in `items/`. The prose before the first `##` header is the long description shown by `examine`.

Use `readable: true` only when the item has a `## read` section. Use `lightable: true` for items that can be lit, and `lighter: true` for items that can light other items.

```yaml
id: sample-key
names: ["key", "sample key"]
short: "a sample key"
takeable: true
initialState: {}
```

Allowed optional item sections are:

- `## read`
- `## lit`
- `## extinguished`
- `## lighter-empty`

## Encounters

Encounter files live in `encounters/`. Encounters are state machines: `initialPhase` points to a phase, each phase points to a description section, and each transition points to a narration section.

```yaml
id: sample-encounter
startsIn: "[[sample-room]]"
initialPhase: waiting
aliases: [figure, shape]
defaultWrongVerbNarration: wrong-verb
phases:
  waiting:
    description: waiting
    transitions:
      - verb: wait
        chipLabel: WAIT
        narration: waited
        to: resolved
```

Use `onResolved.setFlags` for flags that endings or locked exits can read. Use `requires.item` on a transition when the player must hold a specific item.

## Endings

Ending files live in `endings/`. `whenFlags` controls when an ending is available, and the markdown body is the ending narration.

Quote ids that look like booleans:

```yaml
id: "true"
whenFlags:
  familySecretKnown: true
```

Bare `id: true` is parsed as a boolean by YAML before the loader sees it.

## Mechanics

Mechanic files live in `mechanics/`. They configure named TypeScript handlers without moving the algorithms into markdown.

`mechanics/light.md` controls the light timer, burn triggers, state keys, meter setting, and fallback light prose. `mechanics/resolve.md` controls resolve levels, wrong-verb cost, safe-room recovery, and retreat behavior.

Keep `handler` set to the supported handler name. Set `enabled: false` to disable a mechanic cleanly.

## Actions

Action files live in `actions/`. Simple actions can require visible or held items, consume inventory, decrement item state, set flags, and narrate success.

```yaml
id: sample-action
verbs: [use]
requires:
  allVisibleOrHeld:
    - "[[sample-key]]"
setsFlags:
  sampleActionDone: true
```

Every default action needs `## success`. Handler-backed actions may require extra sections. For example, the `drunk-transition` handler requires `## success`, `## secretFoundPassOut`, `## tooManyMovesPassOut`, and `## reset`.

## Game, Parser, Messages, And UI

- `game.md` controls the title, description, starting room, starting inventory, ending priority, transcript cap, opening art, help text, and ended text.
- `parser.md` controls directions, verb aliases, prepositions, stop words, no-target verbs, and meta verbs.
- `messages.md` controls common system prose.
- `ui.md` controls page metadata, footer labels and links, build label visibility, and UI feature toggles.

## Common Validation Errors

`missing required section "## first-visit"`: add the exact section header to the room file. Section names must use only letters, digits, hyphens, and underscores.

`## read section is required when readable: true`: either add `## read` to the item or remove `readable: true`.

`frontmatter references missing section`: an encounter phase, transition, or failure references a prose key that does not exist. Add the section or fix the key.

`exitNRequires is set but exitNLockedText is missing`: locked exits need both the requirement and locked narration fields.

`references unknown item` or `references unknown room`: check the wikilink/id spelling and make sure the referenced file exists in the matching folder.

`endingPriority references "true" but endings/true.md is missing`: quote boolean-like ids in YAML and make sure the ending file exists.

`unknown message section` or `unknown item section`: the loader only accepts known section keys. Rename the header to one of the allowed keys for that file type.
