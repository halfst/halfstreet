---
id: portrait-woman
startsIn: "[[burial-gallery]]"
initialPhase: watching
aliases: [portrait woman, woman, portrait, portraits, veil, funeral veil]
onResolved:
  setFlags:
    familyResemblanceSeen: true
onFailed:
  narration: failed
  retreatTo: "[[root-chamber]]"
defaultWrongVerbNarration: wrong-verb
phases:
  watching:
    description: watching
    transitions:
      - verb: examine
        target: portrait-woman
        chipLabel: EXAMINE PORTRAITS
        chipCommand: examine portraits
        narration: examine-portraits-resolved
        to: resolved
---

## watching
One ruined portrait has not lost its eyes. The woman in it watches from behind a funeral veil, though the paint around her face has split to canvas.

## examine-portraits-resolved
You examine the portraits one by one.

Damage has made a family resemblance where blood may not have. Then the veiled woman's mouth, still painted, shows you the part you did not want to see: your own expression, waiting inside hers.

## wrong-verb
The veiled portrait watches you with patient, damaged eyes.

## failed
The veil lifts though nothing touches it. You step back into the root chamber before the face beneath can finish becoming familiar.
