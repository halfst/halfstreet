---
id: vault-memory
startsIn: "[[vault]]"
initialPhase: buried
aliases: [vault memory, memory, bed, photograph, photo, thing, buried thing]
defaultWrongVerbNarration: wrong-verb
phases:
  buried:
    description: buried
    transitions:
      - verb: read
        target: family-register
        chipLabel: READ REGISTER
        chipCommand: read register
        requires:
          item: "[[family-register]]"
        narration: read-register-resolved
        setFlags:
          nameSpoken: true
        to: resolved
      - verb: take
        target: vault-memory
        chipLabel: TAKE PHOTO
        chipCommand: take photograph
        narration: take-photograph-resolved
        setFlags:
          tookPhotograph: true
        to: resolved
      - verb: attack
        target: vault-memory
        chipLabel: ATTACK BED
        chipCommand: attack bed
        narration: attack-bed-resolved
        setFlags:
          disturbedVault: true
        to: resolved
---

## buried
The bed waits in the center of the vault. The photograph lies face down on the coverlet.

The family register feels heavier here, as if all its missing pages have returned at once.

## read-register-resolved
You read the name from the register.

The letters are difficult only until you say them. Then they seem to have been waiting in your mouth since the gate.

## take-photograph-resolved
You take the photograph.

It is dry and light and terribly easy to lift.

## attack-bed-resolved
You strike the little bed.

The sound is small. The house hears it anyway.

## wrong-verb
The photograph remains face down. The bedclothes do not stir.
