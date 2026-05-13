# Halfstreet

A gothic text adventure. Second person, present tense, sparse — never explains.

Style anchors: Le Fanu's *Carmilla*, Shirley Jackson's *The Haunting of Hill House*, M.R. James's ghost stories.

Played at [halfstreet.io](https://halfstreet.io).

## Stack

- [Astro](https://astro.build) static site
- TypeScript engine — pure (no DOM, `Date`, `Math.random`, or console)
- World content authored in markdown (rooms, items, encounters, endings) under `src/world/`
- [Vitest](https://vitest.dev) for tests

## Development

```sh
npm install
npm test          # engine + world tests
npm run dev       # local dev server
npm run build     # type-check + production build
```

## Make Your Own Game

Halfstreet is currently meant to be forked as a complete Astro app, not consumed
as a separate engine package. To make a new story, replace the markdown vault in
`src/world/` and keep the TypeScript runtime in place.

Start with:

- `src/world/game.md` for the title, starting room, starting inventory, ending
  priority, opening art, help text, and end text.
- `src/world/parser.md` for command vocabulary and aliases.
- `src/world/rooms/`, `src/world/items/`, `src/world/encounters/`, and
  `src/world/endings/` for story content.
- `src/world/mechanics/` and `src/world/actions/` for configurable rules and
  interactions.
- `src/world/ui.md` for page metadata, footer links, and UI feature switches.
- `src/world/templates/` for starter files.

Run `npm test` after changing world files. The loader validates wikilinks,
required sections, frontmatter shape, and references between rooms, items,
encounters, endings, mechanics, and actions.

## Releases

The footer build number comes from Woodpecker's pipeline number and increments on each CI build.
The package version is an intentional release label.

Use one of these from a clean worktree when you are ready to cut a release:

```sh
npm run release:patch  # fixes, typo corrections, small polish
npm run release:minor  # meaningful playable additions or mechanics
npm run release:major  # disruptive changes after 1.0.0
git push --follow-tags
```

Each release script updates `package.json` and `package-lock.json`, creates a release commit, and tags it.

## Layout

- `src/engine/` — parser, dispatcher, encounter logic
- `src/ui/` — terminal renderer, theme, chips
- `src/world/` — Obsidian-friendly authoring vault
- `src/pages/index.astro` — entry page

## Design docs

- `docs/superpowers/specs/halfstreet-bible.md` — content bible (canonical world)
- `docs/superpowers/specs/2026-05-08-mystery-text-adventure-design.md` — engine/UI architecture
- `docs/superpowers/specs/halfstreet-followon-notes.md` — pending engine work before authoring more rooms
- `docs/superpowers/specs/2026-05-09-mystery-markdown-migration-design.md` — markdown content migration design
- `docs/superpowers/plans/2026-05-09-mystery-markdown-migration.md` — migration plan that was executed

## License

GPL-3.0-or-later. See [`LICENSE`](LICENSE).
