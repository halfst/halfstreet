# Halfstreet — Content Bible

**For:** the mystery text adventure shipped at `/mystery`.
**Style anchor:** Le Fanu's *Carmilla*, Shirley Jackson's *The Haunting of Hill House*, M.R. James's ghost stories. Second person, present tense, sparse, never explains.
**Length target:** 18–22 rooms, ~30–60 minute first playthrough.

## Voice rules

1. Second person, present tense, throughout.
2. Sentences are short; the silences between them do most of the work.
3. The narrator never explains the supernatural — it observes.
4. The narrator never addresses the player as a player ("you, the visitor"). Only as the character ("you").
5. No metafiction, no winks, no "you are clearly in a video game" jokes.
6. No proper-noun villains. The things in Halfstreet are nameless.

## Rooms

> Format: `id` · title · one-sentence first-visit prose · exits · items · encounter · safe?

| id | title | first-visit summary | exits | items | encounter | safe |
|---|---|---|---|---|---|---|
| `outside-gate` | [ The Gate ] | The road behind you is gone; the gate is unlocked. | n: foyer | letter, matches | — | yes |
| `foyer` | [ Foyer ] | A foyer of cold paper and colder air, with a hallway running impossibly far. | s: outside-gate, n: hallway | — | — | yes |
| `hallway` | [ Hallway ] | A hallway that runs longer than the house should be wide. | s: foyer, e: study, w: parlor, n: stair-up | lamp | — | — |
| `parlor` | [ Parlor ] | A parlor of stopped clocks and empty chairs, set as if for company. | e: hallway | brass-key | parlor-figure | — |
| `study` | [ Study ] | A study where the books have been left open at pages they were not written for. | w: hallway | folded-letter-2 | — | — |
| `stair-up` | [ Upper Stair ] | A stair that turns once and arrives at the wrong landing. | s: hallway, u: bedroom | — | — | — |
| `bedroom` | [ Bedroom ] | A bedroom kept ready for a sleeper who is not you. | d: stair-up, e: nursery | mirror | — | — |
| `nursery` | [ Nursery ] | A nursery whose toys have been arranged tonight. | w: bedroom | iron-key | nursery-presence | — |
| `kitchen` | [ Kitchen ] | A kitchen with a pot still warm on the stove and no one to have warmed it. | (added via locked door from hallway: `n` requires brass-key) | bread-knife | — | — |
| `back-door` | [ Back Door ] | A door in the kitchen, opening onto the grounds. | s: kitchen, e: garden | — | — | yes |
| `garden` | [ Garden ] | A garden gone to seed in the dark. | w: back-door, n: well, e: chapel | — | — | — |
| `well` | [ The Well ] | An old well, dry, with rope going down further than the well is deep. | s: garden, d: well-shaft | rope | — | — |
| `well-shaft` | [ Well Shaft ] | The shaft, descending past the water-line into the dry. | u: well, n: tunnel | — | — | — |
| `tunnel` | [ Tunnel ] | A stone tunnel that knows you are here. | s: well-shaft, e: chamber | — | hound | — |
| `chamber` | [ Antechamber ] | An antechamber whose door is locked with a lock that takes the iron key. | w: tunnel, e: vault (locked, requires iron-key) | — | — | — |
| `vault` | [ Vault ] | A vault, plain, holding what was buried at Halfstreet. | w: chamber | the-thing-itself | revenant | — |
| `chapel` | [ Chapel ] | A chapel, deconsecrated, on the edge of the grounds. | w: garden | silver-vial | chapel-watcher | yes |
| `attic` | [ Attic ] | An attic reached by a staircase that wasn't there before. | d: bedroom (appears after a flag is set) | childhood-photograph | — | — |
| `cistern` | [ Cistern ] | A cistern beneath the house, found through a grate in the kitchen. | u: kitchen | — | — | — |
| `endings-room` | (synthetic) | The endings narration room, never directly entered. | — | — | — | — |

(Total authored rooms: 19, plus the synthetic endings node.)

## Items

| id | names | purpose | state |
|---|---|---|---|
| `letter` | letter, folded letter | Opening exposition; the call to come. | — |
| `matches` | matches, safety matches | Light the lamp. | — |
| `lamp` | lamp, oil lamp, torch | Illuminates dark rooms. | `lit: false` |
| `brass-key` | brass key, key | Unlocks the kitchen door. | — |
| `iron-key` | iron key, key | Unlocks the vault. | — |
| `mirror` | mirror, tarnished mirror | The revenant's resolution. | — |
| `silver-vial` | silver vial, vial | The chapel-watcher's resolution. | — |
| `bread-knife` | knife, bread knife | A weapon for the hound. | — |
| `rope` | rope | Required to descend the well shaft. | — |
| `folded-letter-2` | second letter, page | Bible-context: the burial register page. Reveals the truth needed for the true ending. | — |
| `the-thing-itself` | (unnamed in prose) | The McGuffin in the vault. State changes based on chosen ending. | `disturbed: false` |
| `childhood-photograph` | photograph, photo | Triggers the bad-ending choice. | — |

## Encounters

| id | room | initial phase | resolution path | failure path |
|---|---|---|---|---|
| `parlor-figure` | parlor | seated | `wait` (twice) → `examine figure` → resolved (the figure was a coat). Wrong verbs cost resolve. | retreat to foyer |
| `nursery-presence` | nursery | listening | `wait` → `extinguish lamp` → resolved (it does not show itself in the dark). Wrong: light costs resolve. | retreat to bedroom |
| `hound` | tunnel | tracking | `attack hound with knife` → wounded → `attack` → resolved. Pure HP-style fight. | retreat to well-shaft |
| `chapel-watcher` | chapel | observing | `pour silver-vial on watcher` → resolved. Wrong: any aggressive verb fails the encounter (chapel-watcher is harmless if undisturbed). | exit chapel forced |
| `revenant` | vault | wary | `examine revenant` → `hold mirror to revenant` → resolved. Other verbs cost resolve. | retreat to chamber |

## Story flags

- `letterRead` — set after reading the opening letter; gates first hint
- `revenantLaid` — set on revenant resolution; required for true ending
- `houndPassed` — set on hound resolution; required to reach vault
- `watcherSpared` — set on chapel-watcher resolution; alternate path to a hint
- `photographSeen` — set on examining the attic photograph; unlocks bad ending
- `theThingDisturbed` — set if the player attacks the thing in the vault; forces wrong ending
- `theThingRecognised` — set if the player has read the burial register and laid the revenant before reaching the vault; forces true ending

## Endings

### True ending (when `theThingRecognised` and not `theThingDisturbed`)

> You stand in the vault. What is buried at Halfstreet is buried because it was loved, and grieved, and finally let go.
> You set the lamp down beside it. You speak its name aloud — the name from the page in the study — and the name is enough.
> You go up. The door opens onto a road that is, suddenly, on every map.

### Wrong ending (when `theThingDisturbed`)

> You stand in the vault. The thing under the cloth shifts. It was not waiting to be freed.
> You climb back, fast, but the house has rearranged its rooms. The door you came in by is now north, then west, then nowhere.
> You walk a corridor that is longer than the house, and longer, and you do not stop.

### Bad ending (when `photographSeen` and the player chooses `take photograph` after reading it)

> You take the photograph from the attic. The child in it is you. The date is older than you are.
> Behind you, on the stairs, someone has come up to meet you.
> You will not go down again.

## Opening scene (full prose, used verbatim)

```
[ The Gate ]

You have arrived at the address you were given. There is no sign,
no number on the gate — only an iron star, twisted and bent, set
into the rust like a wound. The road behind you is gone.

A wind rises from somewhere under the house. The gate, you find,
is not locked.

You are carrying: a folded letter, a box of safety matches.

>
```

## Closing notes for the room-prose authoring

- Each room gets three description blocks: `firstVisit` (180–280 chars), `revisit` (40–80 chars), `examined` (300–450 chars).
- Per-object descriptions: `short` (under 30 chars), `long` (200–400 chars).
- Encounter narration: each transition gets one sentence, max two; default-wrong-verb narration for each encounter is one sentence.
- Style sample: see the opening scene above.
- Style anti-patterns to avoid: words like *spooky*, *creepy*, *eerie*. Adjectives that announce mood. Exclamation marks. The word *suddenly*.
