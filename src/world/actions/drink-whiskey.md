---
id: drink-whiskey
verbs: [drink]
handler: drunk-transition
requires:
  allHeld:
    - "[[whiskey]]"
consumes:
  inventory:
    - "[[whiskey]]"
drunkTransition:
  destinationRoom: "[[drunk-hall]]"
  maxMoves: 20
  wakeRoom: "[[foyer]]"
  resetRoom: "[[kitchen]]"
---

# Drink Whiskey

## success
You drink from the bottle. It tastes of smoke, sugar, and rainwater left too long in a pipe.

## missingRequired
You'd have to be carrying it.

## secretFoundPassOut
The faceless man steps backward into the dark. The floor rises under you, or you fall toward it.

## tooManyMovesPassOut
The rooms keep turning until they become one room. Then even that room is gone.

## reset
The bottle is not with you. Somewhere in the kitchen, it is half full again.
