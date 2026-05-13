---
id: burn-letter
verbs: [use]
requires:
  allVisibleOrHeld:
    - "[[letter]]"
    - "[[matches]]"
consumes:
  inventory:
    - "[[letter]]"
decrements:
  item: "[[matches]]"
  stateKey: uses
setsFlags:
  letterBurned: true
---

# Burn Letter

## success
The letter catches at one corner. In a few breaths it is ash.

## spent
The matchbook is empty.

## missingRequired
You don't see the letter here.
