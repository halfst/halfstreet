---
id: sample-encounter
startsIn: "[[sample-room]]"
initialPhase: waiting
aliases: [figure]
onResolved:
  setFlags:
    sampleEncounterResolved: true
defaultWrongVerbNarration: wrong-verb
phases:
  waiting:
    description: waiting
    transitions:
      - verb: wait
        chipLabel: WAIT
        chipCommand: wait
        narration: waited
        to: resolved
---

## waiting
The figure waits.

## waited
You wait. The figure is gone.

## wrong-verb
That does not change what waits here.
