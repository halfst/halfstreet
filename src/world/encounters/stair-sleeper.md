---
id: stair-sleeper
startsIn: "[[stair-up]]"
initialPhase: seated
aliases: [stair sleeper, sleeper, figure, person, body]
onResolved:
  setFlags:
    hallwayShifted: true
onFailed:
  narration: failed
  retreatTo: "[[parlor]]"
defaultWrongVerbNarration: wrong-verb
phases:
  seated:
    description: seated
    transitions:
      - verb: wait
        chipLabel: WAIT
        narration: wait-resolved
        to: resolved
---

## seated
Someone sits halfway up the stair with their back to you. Their head rests against the banister. One hand lies open on the runner.

## wait-resolved
You do not speak.

After a while, the figure leans aside, not waking. The stair above is not the same stair, but it is open.

## wrong-verb
The seated figure draws one breath. The sound is too small for the body that made it.

## failed
The sleeper turns before you see the face. The stair folds down under your feet, and the parlor receives you again.
