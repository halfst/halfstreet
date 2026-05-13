---
id: ivy-figure
startsIn: "[[conservatory]]"
initialPhase: hidden
aliases: [ivy figure, figure, ivy, vines, vine]
onResolved:
  setFlags:
    conservatoryVinesCut: true
onFailed:
  narration: failed
  retreatTo: "[[dining-room]]"
defaultWrongVerbNarration: wrong-verb
phases:
  hidden:
    description: hidden
    transitions:
      - verb: cut
        target: ivy-figure
        chipLabel: CUT VINES
        chipCommand: cut vines
        requires:
          item: "[[pruning-shears]]"
        narration: cut-ivy-figure-resolved
        to: resolved
      - verb: use
        target: ivy-figure
        chipLabel: USE SHEARS
        chipCommand: use vines with shears
        requires:
          item: "[[pruning-shears]]"
        narration: cut-ivy-figure-resolved
        to: resolved
---

## hidden
The ivy has gathered itself into the suggestion of a person. Leaves cling where eyes should be.

## cut-ivy-figure-resolved
The shears close with a sound like teeth.

The figure falls apart leaf by leaf. Behind it, the glass is only glass.

## wrong-verb
The vines tighten without moving. Their silence feels deliberate.

## failed
The ivy catches at your wrists. When you pull free, you are back among the cold plates of the dining room, with leaves clinging to your sleeves.
