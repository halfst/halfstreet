---
id: distant-steps
startsIn: "[[wrong-hallway]]"
initialPhase: approaching
aliases: [distant steps, steps, footsteps, hallway]
onResolved:
  setFlags:
    distantStepsPassed: true
onFailed:
  narration: failed
  retreatTo: "[[parlor]]"
defaultWrongVerbNarration: wrong-verb
phases:
  approaching:
    description: approaching
    transitions:
      - verb: wait
        chipLabel: WAIT
        narration: wait-resolved
        to: resolved
---

## approaching
The footsteps come closer without growing louder.

They stop whenever you move.

## wait-resolved
You stand still.

The steps pass through you with the cold, careful pressure of someone carrying a tray through a dark room. When they are gone, the hallway is shorter by one door.

## wrong-verb
The hallway lengthens. The footsteps begin again from farther away.

## failed
You turn back too quickly and find the parlor waiting with all its chairs facing you.
