---
id: child-beneath-well
startsIn: "[[well-shaft]]"
initialPhase: climbing
aliases: [child, well child, child beneath well, barefoot child]
onResolved:
  setFlags:
    childPassedWell: true
onFailed:
  narration: failed
  retreatTo: "[[well]]"
defaultWrongVerbNarration: wrong-verb
phases:
  climbing:
    description: climbing
    transitions:
      - verb: hold
        target: "[[toy-dog]]"
        chipLabel: SHOW DOG
        chipCommand: hold dog
        requires:
          item: "[[toy-dog]]"
        narration: hold-toy-dog-resolved
        setFlags:
          woofReturned: true
        to: resolved
      - verb: wait
        chipLabel: WAIT
        narration: wait-resolved
        to: resolved
---

## climbing
Something moves below before you do.

A child emerges from the tunnel beneath the well, barefoot and breathless, one hand against the stone wall as it climbs past you. It does not stop. A draft of cold air follows after it.

Then it is gone upward toward the garden.

## hold-toy-dog-resolved
The child pauses at the garden gate.

"You found Woof."

Or perhaps: "Wolf."

The child takes the toy carefully and disappears into the overgrowth.

The garden grows quieter afterward.

## wait-resolved
You let the child climb past.

Small bare feet find the rungs without looking. The cold draft follows upward, and after a while the shaft is only stone again.

## wrong-verb
The child does not look at you. It climbs as if something below still has its name.

## failed
The cold rises too quickly. You climb back to the well with your hands numb around the rungs.
