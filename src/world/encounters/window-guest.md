---
id: window-guest
startsIn: "[[dining-room]]"
initialPhase: standing-outside
aliases: [guest, window guest, curtains, curtain, window]
onResolved:
  setFlags:
    curtainsClosed: true
onFailed:
  narration: failed
  retreatTo: "[[hallway]]"
defaultWrongVerbNarration: wrong-verb
phases:
  standing-outside:
    description: standing-outside
    transitions:
      - verb: close
        target: window-guest
        chipLabel: CLOSE CURTAINS
        chipCommand: close curtains
        narration: close-window-guest-resolved
        to: resolved
---

## standing-outside
Rain touches the dining-room window from the wrong side. Someone stands beyond the glass with their head bowed. Their coat is too dark to make out properly.

## close-window-guest-resolved
You draw the curtains together before you look closely.

For a moment, cloth and rain hold the same shape. Then there is only the table behind you.

## wrong-verb
The figure outside lifts its face a little, as if disappointed by your hesitation.

## failed
The glass shows too much. For one instant there is a second dining room beyond it. Then you are back in the hallway with rain in your mouth.
