---
id: creaking-floorboard
startsIn: "[[drunk-landing]]"
initialPhase: creaking
aliases: [creaking floorboard, floorboard, board, creak, secret door, faceless man, man, voice]
defaultWrongVerbNarration: wrong-verb
phases:
  creaking:
    description: creaking
    transitions:
      - verb: listen
        chipLabel: LISTEN
        chipCommand: listen
        narration: listen-resolved
        setFlags:
          drunkSecretFound: true
          facelessManMet: true
          houseDebtNamed: true
        to: resolved
      - verb: open
        target: creaking-floorboard
        chipLabel: OPEN BOARD
        chipCommand: open floorboard
        narration: listen-resolved
        setFlags:
          drunkSecretFound: true
          facelessManMet: true
          houseDebtNamed: true
        to: resolved
---

## creaking
One floorboard creaks after you have stopped moving.

It creaks again, softer, from under the wrong foot.

## listen-resolved
You listen.

The board lifts by itself. Beneath it is a narrow door, and behind the door a man without a face sits with his hands folded.

"Halfstreet keeps what is owed," he whispers. "It does not know the difference between a debt and a child."

## wrong-verb
The floorboard waits until you breathe, then creaks beneath that too.
