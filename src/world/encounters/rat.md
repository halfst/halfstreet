---
id: rat
startsIn: "[[cellar-stair]]"
initialPhase: lurking
onResolved:
  setFlags:
    ratGone: true
defaultWrongVerbNarration: wrong-verb
phases:
  lurking:
    description: lurking
    transitions:
      - verb: attack
        target: rat
        chipLabel: ATTACK RAT
        chipCommand: attack rat
        narration: attack-rat-resolved
        to: resolved
      - verb: wait
        chipLabel: WAIT
        narration: wait-stays
        to: lurking
---
## lurking
A heavy rat watches you from the third step. Its eyes catch the light.

## attack-rat-resolved
You stamp. The rat squeals and is gone into the dark.

## wait-stays
The rat does not move. Neither do you.

## wrong-verb
The rat watches.
