---
id: basilisk
startsIn: "[[chapel]]"
initialPhase: sleeping
aliases: [basilisk, creature, eye, altar, coil]
onResolved:
  setFlags:
    basiliskSpared: true
onFailed:
  narration: failed
  retreatTo: "[[vault]]"
defaultWrongVerbNarration: wrong-verb
phases:
  sleeping:
    description: sleeping
    transitions:
      - verb: pour
        target: silver-vial
        chipLabel: POUR VIAL
        chipCommand: pour vial on basilisk
        requires:
          item: "[[silver-vial]]"
        narration: pour-vial-resolved
        to: resolved
      - verb: use
        target: basilisk
        chipLabel: USE VIAL
        chipCommand: use basilisk with vial
        requires:
          item: "[[silver-vial]]"
        narration: pour-vial-resolved
        to: resolved
---

## sleeping
Something large is coiled beneath the altar.

You become aware of the eye first.

Not glowing. Merely open.

## pour-vial-resolved
The wax breaks beneath your thumb.

You pour the vial over the cracked altar stone. The clear liquid disappears into it without running. Beneath the altar, the coil withdraws slowly, scale against stone, until there is only the smell of rain on dust.

The eye closes last.

## wrong-verb
The open eye receives the motion without interest.

Your own eyes begin to water. You look away too late.

## failed
The chapel floor tilts under you. When you find the wall, you are back in the vault with the taste of stone in your mouth.
