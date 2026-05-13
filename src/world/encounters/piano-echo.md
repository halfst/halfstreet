---
id: piano-echo
startsIn: "[[music-room]]"
initialPhase: listening
aliases: [piano echo, piano, note, key]
onResolved:
  setFlags:
    musicSolved: true
onFailed:
  narration: failed
  retreatTo: "[[hallway]]"
defaultWrongVerbNarration: wrong-verb
phases:
  listening:
    description: listening
    transitions:
      - verb: play
        target: piano-echo
        chipLabel: PLAY NOTE
        chipCommand: play note
        narration: play-piano-echo-resolved
        to: resolved
---

## listening
The held piano key waits under your eye. A second note answers from a room you have not found.

## play-piano-echo-resolved
You play the waiting note.

The answer comes at once, nearer than before. A narrow part of the wall settles back into shadow.

## wrong-verb
The answering note repeats, patient and exact. It sounds as if it has not moved at all.

## failed
The wrong chord goes through the floorboards. You climb back to the hallway before the echo finishes.
