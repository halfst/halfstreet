---
id: bone-keeper
startsIn: "[[ossuary]]"
initialPhase: arranging
aliases: [bone keeper, keeper, hands, bones, ribs]
onResolved:
  setFlags:
    burialRingPlaced: true
onFailed:
  narration: failed
  retreatTo: "[[tunnel]]"
defaultWrongVerbNarration: wrong-verb
phases:
  arranging:
    description: arranging
    transitions:
      - verb: drop
        target: "[[burial-ring]]"
        chipLabel: LEAVE RING
        chipCommand: leave ring
        requires:
          item: "[[burial-ring]]"
        narration: leave-burial-ring-resolved
        to: resolved
---

## arranging
Something kneels before the shelves of bone. It has no face you can make out, only hands, and the hands are placing ribs in order of size.

## leave-burial-ring-resolved
You set the ring among the bones.

The hands stop their work. One finger touches the crest, gently, and the shelves settle as if relieved of a small but unbearable error.

## wrong-verb
The arranging hands pause. A rib turns slowly in their grip.

## failed
The bones clatter all at once. You retreat to the tunnel with the sound following you in pieces.
