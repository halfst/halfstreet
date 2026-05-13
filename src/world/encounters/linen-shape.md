---
id: linen-shape
startsIn: "[[laundry]]"
initialPhase: hanging
aliases: [linen shape, shape, sheet, sheets, linen]
onResolved:
  setFlags:
    linenShapeEmpty: true
onFailed:
  narration: failed
  retreatTo: "[[servants-passage]]"
defaultWrongVerbNarration: wrong-verb
phases:
  hanging:
    description: hanging
    transitions:
      - verb: wait
        chipLabel: WAIT
        narration: wait-resolved
        to: resolved
---

## hanging
One hanging sheet has the weight and outline of a person standing behind it. The shape shifts when you look straight at it.

## wait-resolved
You wait.

The sheet stirs. Nothing stands behind it. Nothing had stood behind it.

## wrong-verb
The shape seems to lean toward you, then settles back into stillness.

## failed
You push through the hanging sheets and come out in the servants' passage, breathing hard, with damp cloth brushing your face.
