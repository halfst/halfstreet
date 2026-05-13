---
id: garden-procession
startsIn: "[[garden]]"
initialPhase: passing
aliases: [garden procession, procession, lanterns, lantern, lights, hedge]
onResolved:
  setFlags:
    gardenQuiet: true
onFailed:
  narration: failed
  retreatTo: "[[back-door]]"
defaultWrongVerbNarration: wrong-verb
phases:
  passing:
    description: passing
    transitions:
      - verb: wait
        chipLabel: WAIT
        narration: wait-resolved
        to: resolved
---

## passing
Lanterns pass behind the hedge in a slow line. Each flame is held at the height of a face, but the leaves show no faces through them.

## wait-resolved
You remain silent.

The lanterns go by one after another, counting themselves in light. When the last has passed, the hedge exhales and the garden belongs to the rain again.

## wrong-verb
The nearest lantern stops.

## failed
The procession turns with one motion. You are back at the kitchen door before you remember retreating, and something in the hedge has learned your footstep.
