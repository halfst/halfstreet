---
id: reflection
startsIn: "[[flooded-passage]]"
initialPhase: following
aliases: [reflection, water, black water, face, reflected figure]
onResolved:
  setFlags:
    reflectionObscured: true
onFailed:
  narration: failed
  retreatTo: "[[ossuary]]"
defaultWrongVerbNarration: wrong-verb
phases:
  following:
    description: following
    transitions:
      - verb: use
        target: reflection
        chipLabel: USE SHEET
        chipCommand: use water with sheet
        requires:
          item: "[[damp-sheet]]"
        narration: obscure-water-resolved
        to: resolved
---

## following
Your reflection in the black water is a half-second late. When you stop, it finishes the motion after you.

## obscure-water-resolved
You spread the damp sheet across the water.

The cloth drinks the reflection into itself. For a moment a face presses up beneath the linen, then slackens into ordinary wet cloth.

## wrong-verb
The reflected figure takes a step you have not taken.

## failed
The water rises without rising. You stumble back into the ossuary before the face below reaches the surface.
