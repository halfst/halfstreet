---
id: breathing-wall
startsIn: "[[servants-passage]]"
initialPhase: audible
aliases: [breathing wall, wall, walls, breathing]
onResolved:
  setFlags:
    breathingWallPassed: true
onFailed:
  narration: failed
  retreatTo: "[[music-room]]"
defaultWrongVerbNarration: wrong-verb
phases:
  audible:
    description: audible
    transitions:
      - verb: wait
        chipLabel: WAIT
        narration: wait-resolved
        to: resolved
---

## audible
The wall beside your shoulder breathes in. The opposite wall answers.

## wait-resolved
You stand still.

The passage narrows, then forgets to. The breathing passes on ahead of you, down the wall and out of reach.

## wrong-verb
The walls take a slower breath.

## failed
The boards lean close enough to touch your sleeves. You retreat into the music room before they can close around you.
