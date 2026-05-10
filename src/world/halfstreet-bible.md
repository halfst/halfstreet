---
test: "[[halfstreet-followon-notes]]"
---
# Halfstreet — Content Bible

**For:** the mystery text adventure shipped at `/mystery`

**Style anchors:**

- Le Fanu's _Carmilla_
    
- Shirley Jackson's _The Haunting of Hill House_
    
- M.R. James ghost stories
    

**Perspective:** second person, present tense

**Target length:** 25–28 rooms, 45–90 minute first playthrough

---

# Voice Rules

1. Second person, present tense.
    
2. Sentences are short; silence does most of the work.
    
3. Never explain the supernatural.
    
4. Never address the player as a player.
    
5. No metafiction.
    
6. No named villains.
    
7. Violence usually worsens outcomes.
    
8. Many frightening things should prove harmless.
    

---

# Core Themes

- mistaken identity
    
- unresolved grief
    
- memory behaving incorrectly
    
- repetition
    
- domestic spaces becoming ritual spaces
    
- familiar objects recurring in altered forms
    
- the house remembering itself imperfectly
    

---

# Opening Scene

```txt
[ The Gate ]

You arrive at the address, but you do not remember what has happened.
There is no sign, no number on the gate. The fence is overgrown
with grape vines. The road behind you is gone.

The air is cool and still around you, but a quiet rustling and a
damp breeze seem to emanate from beneath the house.

You are carrying: a folded letter, a matchbook, and a broken cigarette.

>
```

---

# Existing House Rooms

| id             | title           | summary                                                                                                                                                                       |
| -------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `outside-gate` | [ The Gate ]    | The road behind you is gone.                                                                                                                                                  |
| `foyer`        | [ Foyer ]       | A foyer that doesn't feel welcoming. Beneath the dust is another scent: sweet at first, then medicinal, like crushed almond pits. A hallway runs impossibly far to the north. |
| `hallway`      | [ Hallway ]     | A hallway longer than the house should allow.                                                                                                                                 |
| `parlor`       | [ Parlor ]      | Chairs arranged for absent company.                                                                                                                                           |
| `study`        | [ Study ]       | Books left open at impossible pages.                                                                                                                                          |
| `stair-up`     | [ Upper Stair ] | A stair arriving at the wrong landing.                                                                                                                                        |
| `bedroom`      | [ Bedroom ]     | Prepared for another sleeper.                                                                                                                                                 |
| `nursery`      | [ Nursery ]     | Toys arranged tonight.                                                                                                                                                        |
| `kitchen`      | [ Kitchen ]     | Something recently warm.                                                                                                                                                      |
| `back-door`    | [ Back Door ]   | Opens onto the grounds.                                                                                                                                                       |
| `garden`       | [ Garden ]      | Overgrown and listening.                                                                                                                                                      |
| `well`         | [ The Well ]    | Dry deeper than it should be.                                                                                                                                                 |
| `well-shaft`   | [ Well Shaft ]  | Descending below the water line.                                                                                                                                              |
| `tunnel`       | [ Tunnel ]      | A tunnel aware of your presence.                                                                                                                                              |
| `chamber`      | [ Antechamber ] | Locked threshold before the vault.                                                                                                                                            |
| `vault`        | [ Vault ]       | Holds what was buried at Halfstreet.                                                                                                                                          |
| `chapel`       | [ Chapel ]      | Deconsecrated and occupied.                                                                                                                                                   |
| `attic`        | [ Attic ]       | Reached by a staircase that was not there before.                                                                                                                             |
| `cistern`      | [ Cistern ]     | Beneath the kitchen.                                                                                                                                                          |

---

## Structural Revision

The house should begin behaving differently after several story flags are set. Certain rooms subtly alter on revisit, some exits change, and a secondary loop through the house opens. The player should slowly realize the house is less a physical location than an accumulation of grief, repetition, and mistaken memory.

Themes reinforced by the new rooms:

- mistaken identity
    
- repetition
    
- domestic memory
    
- grief fossilized into architecture
    
- things mistaken for people
    
- familiar objects recurring in different forms
    
- the sense that the player may have belonged here once
    

---

# Additional Rooms

## Main House Expansion

|id|title|first-visit summary|exits|items|encounter|safe|
|---|---|---|---|---|---|---|
|`dining-room`|[ Dining Room ]|A dining room laid for supper long after supper ended.|w: hallway, n: conservatory|candlestick|window-guest|—|
|`conservatory`|[ Conservatory ]|The glass ceiling has gone blind with moss and rain.|s: dining-room, e: garden|pruning-shears|ivy-figure|—|
|`smoking-room`|[ Smoking Room ]|The room smells faintly of ash, velvet, and bitter almonds.|e: hallway|silver-lighter|covered-cage|—|
|`music-room`|[ Music Room ]|A piano stands open with one key held silently down.|w: hallway, n: servants-passage|music-box-key|piano-echo|—|
|`servants-passage`|[ Servants' Passage ]|The walls here are unfinished and smell of wet wood.|s: music-room, e: laundry|—|breathing-wall|—|
|`laundry`|[ Laundry ]|Sheets hang unmoving in the still air.|w: servants-passage|damp-sheet|linen-shape|—|

---

## Lower-Level Expansion

|id|title|first-visit summary|exits|items|encounter|safe|
|---|---|---|---|---|---|---|
|`ossuary`|[ Ossuary ]|The bones have been arranged with more care than devotion.|s: tunnel, e: flooded-passage|burial-ring|bone-keeper|—|
|`flooded-passage`|[ Flooded Passage ]|Black water moves softly across the stone floor.|w: ossuary, n: root-chamber|toy-boat|reflection|—|
|`root-chamber`|[ Root Chamber ]|Roots have entered through the ceiling and never stopped growing.|s: flooded-passage, e: burial-gallery|—|root-movement|—|
|`burial-gallery`|[ Burial Gallery ]|Portraits line the walls, though none survive intact.|w: root-chamber, e: vault|family-register|portrait-woman|—|

---

## Altered / Conditional Rooms

These rooms appear only after certain flags are set.

| id                 | title         | first-visit summary                                   | exits                     | items      | encounter       | safe |
| ------------------ | ------------- | ----------------------------------------------------- | ------------------------- | ---------- | --------------- | ---- |
| `wrong-hallway`    | [ Hallway ]   | The hallway is longer now.                            | impossible-changing exits | —          | distant-steps   | —    |
| `returned-nursery` | [ Nursery ]   | The toys no longer appear arranged.                   | w: bedroom                | —          | —               | yes  |
| `rain-room`        | [ Rain Room ] | Rain falls steadily inside the room and nowhere else. | unknown                   | rusted-key | rainwater-basin | —    |

---

# Core House Rooms Revisions

|id|revised summary|
|---|---|
|`foyer`|A foyer that doesn't feel welcoming. Beneath the dust is another scent: sweet at first, then medicinal, like crushed almond pits. A hallway runs impossibly far to the north.|

---

# Inventory Items

|id|names|purpose|state|
|---|---|---|---|
|`candlestick`|candlestick, candle holder|Provides temporary light without using the lamp.|`lit: false`|
|`pruning-shears`|shears, pruning shears|Cuts through overgrowth in the conservatory and garden.|—|
|`silver-lighter`|lighter, silver lighter|Can light the broken cigarette or lamp.|—|
|`music-box-key`|tiny key, music box key|Unlocks the music box in the nursery.|—|
|`damp-sheet`|sheet, damp sheet|Used to obscure reflections in flooded areas.|—|
|`burial-ring`|ring, burial ring|Matches the crest found in the family register.|—|
|`toy-boat`|toy boat, wooden boat|Floats briefly against the current.|—|
|`family-register`|register, ledger|Reveals names, dates, and repeated burials tied to Halfstreet.|—|
|`rusted-key`|rusted key|Opens an optional locked room near the gate.|—|

---

# Non-Key Items

Non-key items are objects the player meaningfully interacts with but cannot permanently carry.

These objects should feel physically inconvenient, emotionally difficult, fragile, attached to the house itself, or impossible to remove.

|id|description|interaction|
|---|---|---|
|`grandfather-clock`|A stopped clock in the parlor whose pendulum occasionally resumes on its own.|Setting the correct time alters hallway geometry temporarily.|
|`music-box`|A nursery music box bolted to the shelf.|Unlocking and winding it reveals hidden sounds elsewhere in the house.|
|`dinner-place-setting`|A single untouched plate in the dining room.|Sitting before it triggers memory prose and a hidden passage.|
|`veil`|A funeral veil draped over a portrait in the burial gallery.|Lifting it reveals the player's resemblance to the family.|
|`rainwater-basin`|A basin collecting rain inside the rain room.|Looking into it reveals altered room descriptions.|
|`covered-cage`|A cloth-covered birdcage in the smoking room.|Removing the cloth changes ambient sounds throughout the house.|
|`altar-stone`|A cracked altar slab in the chapel.|Pouring the silver vial here weakens the basilisk without violence.|
|`childs-drawing`|A crayon drawing pinned to the nursery wall.|Reveals the existence of the wrong hallway before it appears.|
|`portrait-frame`|A shattered portrait frame underground.|Rotating it exposes hidden writing beneath the backing.|
|`well-rope-wheel`|The old iron wheel beside the well.|Turning it changes what is heard below the house.|

---

# Revised Encounter Notes

## The Child Beneath the Well

If the player attempts to descend the well for the first time:

> Something moves below before you do.
> 
> A child emerges from the tunnel beneath the well, barefoot and breathless, one hand against the stone wall as it climbs past you. It does not stop. A draft of cold air follows after it.
> 
> Then it is gone upward toward the garden.

If carrying the toy dog:

> The child pauses at the garden gate.
> 
> “You found Woof.”
> 
> Or perhaps: “Wolf.”
> 
> The child takes the toy carefully and disappears into the overgrowth.
> 
> The garden grows quieter afterward.

The child is harmless.

---

## Basilisk Encounter Revision

Replace the chapel-watcher entirely.

|id|room|initial phase|resolution path|failure path|
|---|---|---|---|---|
|`basilisk`|chapel|sleeping|`pour silver-vial on basilisk` → resolved. The creature withdraws beneath the chapel stones.|direct eye contact costs resolve; forced exit|

Suggested prose:

> Something large is coiled beneath the altar.
> 
> You become aware of the eye first.
> 
> Not glowing. Merely open.

---

# Expanded Encounters

The expanded house should contain more quiet encounters than overtly hostile ones.

|id|room|initial phase|resolution path|failure path|
|---|---|---|---|---|
|`ivy-figure`|conservatory|hidden|`cut vines with shears` → reveals garden shortcut|entangled; lose resolve|
|`piano-echo`|music-room|listening|`play note` matching distant melody → hidden passage opens|wrong notes cost resolve|
|`linen-shape`|laundry|hanging|`wait` → shape proves empty|panic returns player to passage|
|`bone-keeper`|ossuary|arranging|`leave burial-ring` → passage opens|disturbing bones costs resolve|
|`reflection`|flooded-passage|following|obscure water with damp-sheet|reflected figure approaches|
|`portrait-woman`|burial-gallery|watching|`examine portraits` reveals hidden family resemblance|retreat|
|`distant-steps`|wrong-hallway|approaching|stand still until steps pass|hallway lengthens|
|`garden-procession`|garden|passing|remain silent while lantern lights move beyond hedges|encounter follows player indoors|
|`bell-sounder`|chapel|ringing|follow the sound without directly approaching|resolve loss|
|`stair-sleeper`|upper stair|seated|leave without speaking|staircase changes|
|`window-guest`|dining-room|standing outside|close curtains before approaching glass|face appears at window|
|`breathing-wall`|servants-passage|audible|remain still until the sound passes|walls feel narrower|
|`root-movement`|root-chamber|shifting|extinguish light and listen|roots block exits temporarily|
|`rainwater-basin`|rain-room|reflecting|look into basin after major story flags|altered room descriptions persist|
|`covered-cage`|smoking-room|rustling|uncover cage briefly|distant sounds intensify|

---

# Toy Dog

short: a stuffed dog

long:

The toy dog is several shades darker than it used to be.  
His fur is matted down in areas and worn from years of handling.

A name is stitched into one paw in faded blue thread:

WOOF

Or perhaps:

WOLF

The stitching has begun to loosen.

---

# Expanded Story Flags

- `woofReturned`
    
- `hallwayShifted`
    
- `musicSolved`
    
- `basiliskSpared`
    
- `familyNameLearned`
    
- `rainRoomEntered`
    
- `houseAcceptedYou`
    

---

# Expanded Endings

## True Ending

> You stand in the vault. What is buried at Halfstreet is buried because it was loved, and grieved, and finally let go.
> 
> You set the lamp beside it.
> 
> You speak the name aloud.
> 
> The house settles around you like a long exhalation.
> 
> Outside, the road exists again.

---

## Wrong Ending

> You disturb what should have remained untouched.
> 
> The house rearranges itself around your leaving.
> 
> Corridors repeat.
> 
> Doors return you to themselves.
> 
> The hallway grows longer.

---

## Bad Ending

> You take the photograph.
> 
> The child in it is you.
> 
> Behind you, on the stairs, someone has come up to meet you.
> 
> You do not go down again.

---

## Replacement Ending

Unlocked if the player restores too much order to the house, lingers too long, or repeatedly revisits altered rooms.

> You open the front door.
> 
> Someone is standing at the gate outside.
> 
> They look tired. Rain-darkened. Lost.
> 
> After a moment, you understand they have arrived for you.

---

## Mercy Ending

Unlocked if:

- Woof is returned
    
- the basilisk is spared
    
- the thing is not disturbed
    
- all burial clues are learned
    
- the revenant is laid to rest
    

> You remain in the vault until the lamp goes out.
> 
> The house is quiet.
> 
> Somewhere above, floorboards settle one final time.
> 
> By morning, Halfstreet contains one fewer restless thing.

---

# Spatial Notes

The house should increasingly violate geography.

Examples:

- The servants' passage should emerge somewhere impossible.
    
- The wrong hallway can replace the normal hallway after enough resolve loss.
    
- The rain room should not fit within the visible structure of the house.
    
- The burial gallery should feel emotionally adjacent to the dining room despite being underground.
    
- Certain rooms should inherit sounds from distant locations.
    

Examples:

- nursery laughter faintly audible in the flooded passage
    
- piano note heard from the attic
    
- chapel bell heard underwater
    
- footsteps overhead while underground
    

The player should slowly suspect the house is remembering itself incorrectly.

---

# Additional Tone Guidance

The horror works best when:

- encounters are quiet
    
- threats are ambiguous
    
- many frightening things prove harmless
    
- harmless things prove emotionally devastating
    
- monsters are treated with restraint
    
- violence worsens outcomes
    

The game should feel less like surviving a haunted house and more like wandering through unresolved mourning.