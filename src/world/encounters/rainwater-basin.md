---
id: rainwater-basin
startsIn: "[[rain-room]]"
initialPhase: reflecting
aliases: [rainwater basin, basin, water, rainwater, reflection]
onResolved:
  setFlags:
    rainRoomEntered: true
    houseAcceptedYou: true
onFailed:
  narration: failed
  retreatTo: "[[wrong-hallway]]"
defaultWrongVerbNarration: wrong-verb
phases:
  reflecting:
    description: reflecting
    transitions:
      - verb: look
        target: rainwater-basin
        chipLabel: LOOK BASIN
        chipCommand: look basin
        narration: look-resolved
        to: resolved
      - verb: examine
        target: rainwater-basin
        chipLabel: EXAMINE BASIN
        chipCommand: examine basin
        narration: look-resolved
        to: resolved
---

## reflecting
The basin shows no ceiling. It shows a hallway instead, and in that hallway a lamp going out.

## look-resolved
You look into the rainwater.

Rooms gather there one beneath another: nursery, chapel, vault, gate. For a moment they fit together correctly. Then your reflection enters them from the wrong side, and every door in the image opens inward.

When you look up, the room has learned you.

## wrong-verb
Rain touches your hands, though you are not beneath it.

## failed
The rain rises without filling the basin. You step back into the wrong hallway before it reaches your mouth.
