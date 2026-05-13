---
id: covered-cage
startsIn: "[[smoking-room]]"
initialPhase: rustling
aliases: [covered cage, cage, birdcage, cloth]
onResolved:
  setFlags:
    cageUncovered: true
onFailed:
  narration: failed
  retreatTo: "[[hallway]]"
defaultWrongVerbNarration: wrong-verb
phases:
  rustling:
    description: rustling
    transitions:
      - verb: open
        target: covered-cage
        chipLabel: UNCOVER CAGE
        chipCommand: uncover cage
        narration: open-covered-cage-resolved
        to: resolved
---

## rustling
The covered cage rustles once. Then again, softer, as if whatever is inside has learned restraint.

## open-covered-cage-resolved
You lift the cloth.

The cage is empty. A few pale feathers cling to the wire, though no bird could have passed through it.

Somewhere far above you, wings beat once inside a wall.

## wrong-verb
The cloth trembles, then goes still again.

## failed
The rustling grows too close to your ear. You leave the room before you decide to, and the cage is still covered when you look back.
