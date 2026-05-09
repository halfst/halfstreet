# Halfstreet — notes for the room-prose follow-on plan

These notes carry over from the final code review of the engine/UI/bible plan (2026-05-08). Read before generating the room-prose implementation plan.

## Hard prerequisites — land BEFORE authoring rooms

These are gaps the engine ships with that will block specific rooms or items in the bible. Make them the first commits of the follow-on plan.

1. **Add `read`, `light`, `extinguish`, `use` verb handlers to the dispatcher.** The bible's items include a lamp (`light`/`extinguish`), letter and burial-register page (`read`), lamp+matches combination (`use` or `light with`). None have dispatcher handlers in the shipped engine. Authoring rooms around items players can't interact with creates blocked playthroughs.

2. **Wire disambiguation end-to-end.** The parser already returns `unknown-noun` for ambiguous nouns and the type system has `PendingDisambiguation`, but the dispatcher never sets it. The bible has two keys (`brass-key`, `iron-key`) both aliased `key`; without disambiguation, `take key` silently fails for any player who doesn't type the full noun. Plan: change the parser to return a dedicated `{kind: 'ambiguous', candidates}` variant, and have the dispatcher convert it into a `pendingDisambiguation` set + a "Which key — …?" narration.

3. **Implement the ending-screen UI and `endedWith` flag-checking logic.** All three endings are written verbatim in the bible. The engine has the `endedWith` field but never sets it; the terminal never checks it. Without this, a true-ending playthrough sets `revenantLaid = true` and the player keeps typing into a terminal that should have shown the ending. Land this as the first commit of the prose plan, then author the vault and ending rooms last so they can be tested end-to-end.

## Should-fix while you're in there

4. **`look at X` parser polish.** Strip leading stop-words (`at`, `the`, `a`, `an`) from the noun token list before matching. `look at lamp` currently fails noun resolution; only `examine lamp` and `x lamp` work. Spec says `look at X` should examine X.

5. **Theme-state divergence.** When the player clicks `[B]/[C]`, `theme.ts` updates the DOM and localStorage but does not update `state.theme`. Next `theme` meta-command then toggles from the stale `state.theme`. Cleanest fix: remove `theme` from `GameState` entirely (it's a UI preference, not game state) and have the engine's `theme` meta-verb read the DOM via the UI layer.

6. **Type lie in `roomState`.** The type is `Record<string, string | boolean | number>` but the code stores `string[]` for `droppedItems`/`takenItems` via `as` casts in both directions. Widen the union to include `string[]`.

7. **Add a self-contained locked-exit-with-key dispatcher test.** The current `dispatcher.test.ts` "opens a locked exit" test is a stub (`expect(true).toBe(true)`). The sample world's locked exit is unreachable without the key behind it, so the playthrough test can't cover this either. Add a 15-line synthetic world to dispatcher.test.ts.

## Polish / nice-to-have

8. PageUp/PageDown transcript scrolling (spec calls it out, not implemented).
9. Cursor blink at 1.05Hz (currently uses native ~0.53Hz `caret-color` only).
10. Old-line opacity fade at the top of the transcript (spec, not implemented).
11. Scanline accessibility toggle (`[?]` settings dropdown, spec, not implemented). Important for photosensitivity.

## What's already good — don't refactor

- Three-layer architecture (world data → engine → UI) holds end-to-end. Don't introduce cross-layer shortcuts.
- Engine purity (no Date, Math.random, console, DOM) is verified. Keep new verbs pure.
- Type contract and `verbatimModuleSyntax` discipline are clean. Use `import type` for type-only imports.
- Test coverage is meaningful, not gamed. Match this density for new verbs.
