# Phase 2 — Halfstreet Content Rewrite Roadmap

**For:** authoring the Halfstreet content bible into markdown for Obsidian editing, now that the engine prereqs have landed.

**Bible:** `docs/superpowers/specs/halfstreet-bible.md`
**Engine prereqs spec:** `docs/superpowers/specs/2026-05-09-mystery-engine-prereqs-design.md`
**Engine prereqs plan:** `docs/superpowers/plans/2026-05-09-mystery-engine-prereqs.md` (✅ shipped on `feat/engine-prereqs`)

---

## What the engine can now express

After Phase 1, the markdown content layer supports every interaction the bible specifies:

- **Rooms** — frontmatter exits (n/s/e/w/u/d), locked exits with item or flag requirements, encounter triggers, safe-room flag, and three description sections (`## first-visit`, `## revisit`, `## examined`). Wikilinks (`[[room-id]]`) work for cross-references.
- **Items** — `readable` (with `## read` body section), `lightable` (with `## lit` / `## extinguished`), `lighter` + `lighterUses` (with `## lighter-empty`), arbitrary `initialState`, multiple aliases. Non-key items (clocks, music boxes, etc.) can live as room scenery referenced in encounters.
- **Encounters** — phase descriptions and transition narration in markdown sections; phase state machine in `encounters.ts` references prose via `narration('id', 'key')`. Transitions support `verb`, `target`, `requires.item` (gates the instrument), `to`, `narration`, `resolveCost`.
- **Endings** — `whenFlags` predicate plus markdown body. Priority order is `true` → `wrong` → `bad`; first match fires. `_never: true` sentinel keeps placeholders from auto-firing.
- **Verbs the parser/dispatcher handle:** `look`, `examine`, `take`, `drop`, `inventory`, `wait`, `go` + directions, `read`, `light`, `extinguish`, `use`, `attack`, plus `verb-target-prep` for `light X with Y` and `use X on Y`. Stop-words (`at`/`the`/`a`/`an`) are stripped. Ambiguous nouns prompt for disambiguation.

If the bible needs anything beyond this list, that's a Phase 1.5 engine task — surface it and we'll add a small follow-up plan.

---

## What needs authoring

A rough inventory derived from the bible. Counts include the existing 3 rooms / 3 items / 1 encounter / 3 endings (which need rewriting in the new tone, not just additions).

| kind | count | source in bible |
|---|---|---|
| Rooms | 25–28 | "Existing House Rooms" + "Additional Rooms" + "Altered / Conditional Rooms" |
| Carry-able items | ~12 | "Inventory Items" + the existing matches/lamp/letter |
| Non-key (scenery) items | ~10 | "Non-Key Items" |
| Encounters | ~17 | "Revised Encounter Notes" + "Expanded Encounters" + the existing rat |
| Endings | 5 | "Expanded Endings" — true / wrong / bad / replacement / mercy |
| Story flags | ~10 | "Expanded Story Flags" |

The bible already supplies:
- **Verbatim prose** for the opening scene, the basilisk encounter, the child-beneath-the-well encounter, the toy dog, and all five endings — paste these in as-is.
- **Summaries** for each room (1–2 sentences) — expand to full first-visit + revisit + examined prose in Obsidian.
- **Interaction descriptions** for each item — expand to full long-description prose plus relevant body sections.
- **Resolution paths** for each encounter — translate into phase + transition narration.

---

## Authoring workflow in Obsidian

1. **Open the vault.** `src/world/` is configured as an Obsidian vault (see `.obsidian/`). Open that folder in Obsidian. Wikilinks to room/item/encounter ids resolve as graph edges.
2. **Branch.** Work on a Phase 2 branch (e.g. `feat/content-rewrite`) so prose iteration doesn't pile onto `main`. Commit small, frequent slices — a room or two per commit reads cleanly in PR.
3. **Edit the markdown directly.** The dev server (`npm run dev`) runs Astro's HMR; saving a `.md` file reloads the browser with the new prose.
4. **Test as you go.** `npm test` covers the engine and loader; round-trip / cross-reference validation runs at world assembly. A typo in a wikilink target throws on load — check the dev console.
5. **Use `_never: true`** on any ending whose flag conditions you haven't decided yet. Replace with real flags once authored.

---

## Suggested authoring sequence

Phase 2 is large enough that I recommend slicing by *region*, not by *kind*. A fully-authored region (rooms + items + encounters there) is playable end-to-end and produces a useful test loop. Mixing kinds across the whole house drags the playable surface to zero for a long time.

Suggested slices:

1. **Rewrite the existing 3 rooms** in the bible's voice. Foyer, Hallway, Cellar Stair — already wired up, fastest route to "the new tone is on screen." This is the smallest possible PR and de-risks the voice direction before scaling up.
2. **Main-floor expansion** — Parlor, Study, Dining Room, Conservatory, Smoking Room, Music Room, Servants' Passage, Laundry. These connect to the existing Hallway. Add the items each room references (candlestick, pruning-shears, silver-lighter, music-box-key, damp-sheet) and their encounters (window-guest, ivy-figure, covered-cage, piano-echo, breathing-wall, linen-shape).
3. **Upper floor** — Stair, Bedroom, Nursery, Attic. Items: child's drawing, music-box (non-key), toy dog. Encounters: stair-sleeper.
4. **Garden + grounds** — Back Door, Garden, Well, Well Shaft. Encounter: garden-procession, child-beneath-the-well (verbatim prose in bible).
5. **Lower passages** — Tunnel, Antechamber, Vault, Ossuary, Flooded Passage, Root Chamber, Burial Gallery, Cistern. Items: burial-ring, toy-boat, family-register. Encounters: bone-keeper, reflection, root-movement, portrait-woman.
6. **Chapel + basilisk** — verbatim prose in bible. Items: silver-vial. Encounter: basilisk (replaces chapel-watcher).
7. **Conditional / altered rooms** — wrong-hallway, returned-nursery, rain-room. These appear only after specific flags.
8. **Endings** — true, wrong, bad, replacement, mercy. Verbatim prose; just wire the `whenFlags` per the bible's conditions.
9. **Polish pass** — re-read the whole transcript top to bottom in the browser. Catch tonal drift, stale wikilinks, dead encounters, items with no resolution.

Within each slice, the order that minimizes broken intermediate state:

1. Author the room files first (with placeholder exits to non-existent rooms commented out or marked `null` until the destination is authored — the loader's cross-ref validation will fail otherwise).
2. Author item files referenced by the rooms.
3. Author encounter files (frontmatter + narration sections), then update `encounters.ts` with the phase/transition state machine.
4. Add any new flags to `flags.ts` or wherever they land (no central registry today — they're set/read ad hoc).
5. Set ending `whenFlags` once enough flags exist to specify the conditions.

---

## Open questions / things to watch

- **Flag registry.** The bible introduces ~10 story flags. Today they're untyped strings flowing through `state.flags`. As the count grows, consider a `flags.ts` module exporting the canonical names so typos surface at compile time. Not required for Phase 2 to ship; might be a small Phase 1.5 task.
- **Scenery items.** Bible's "Non-Key Items" (grandfather-clock, music-box, dinner-place-setting, etc.) are objects the player interacts with but cannot carry. Decide whether to model them as untakeable items (frontmatter `takeable: false`) or as room-state with custom verbs in `encounters.ts`. The former is simpler if `examine` and one or two specific verbs cover the interaction; the latter is needed for richer state machines (e.g. setting the grandfather clock to a specific time).
- **House-altering geometry.** "wrong-hallway" and "returned-nursery" are the same physical space with different prose after a flag is set. Today rooms have one set of descriptions. Either: (a) author them as separate room ids and gate access with locked-exit + flag conditions; (b) extend the room schema to support conditional descriptions. (a) is smaller; (b) is more elegant. Pick (a) until it bites.
- **Resolve mechanic.** Bible says "violence usually worsens outcomes" and assumes a Resolve ladder. The engine has `resolveLevel` but the bible's expected costs/recoveries aren't fully specified. Phase 2 can either (a) commit to the existing levels and let prose lean on them informally, or (b) write a short addendum nailing down which transitions cost what. Lean toward (a) until inconsistencies emerge.
- **Disambiguation in practice.** With ~12 carry-able items, watch for shared aliases (`key` covers `rusted-key` / `music-box-key` / `burial-ring`'s "ring"). The disambiguation prompt is in place but the prose for it is generic ("Which X — A, or B?"). Acceptable as-is; revisit if it reads clunky.

---

## Definition of done for Phase 2

- All bible rooms, items, encounters, and endings live in `src/world/` markdown.
- A first playthrough reaches the true ending in 45–90 minutes.
- All five endings are reachable by some flag combination and tested at least once.
- No cross-reference errors at world load; all encounter narrations resolve.
- Prose passes a re-read by the author against the bible's voice rules.
- Polish items deferred from Phase 1 (transcript scrolling, cursor blink rate, line fade, scanline toggle) are still deferred — Phase 2 is content-only.

---

## When ready to start

Brainstorm Slice 1 (existing 3 rooms in new tone) → spec → plan → author. The brainstorming will be quick because the bible already specifies most of what's needed; the spec is mostly a checklist and a tone-test paragraph; the plan is "edit these N markdown files." After Slice 1 ships, decide whether to continue slice-by-slice in plans or shift to a looser working-mode where each region's PR is its own thing.
