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

## Layout

- `src/engine/` — parser, dispatcher, encounter logic
- `src/ui/` — terminal renderer, theme, chips
- `src/world/` — markdown content (rooms, items, encounters, endings)
- `src/pages/index.astro` — entry page

## Design docs

- `docs/superpowers/specs/halfstreet-bible.md` — content bible (canonical world)
- `docs/superpowers/specs/2026-05-08-mystery-text-adventure-design.md` — engine/UI architecture
- `docs/superpowers/specs/halfstreet-followon-notes.md` — pending engine work before authoring more rooms
- `docs/superpowers/specs/2026-05-09-mystery-markdown-migration-design.md` — markdown content migration design
- `docs/superpowers/plans/2026-05-09-mystery-markdown-migration.md` — migration plan that was executed

## License

GPL-3.0-or-later. See [`LICENSE`](LICENSE).
