import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseGame,
  parseAction,
  parseLightMechanic,
  parseResolveMechanic,
  parseMessages,
  parseParser,
  parseUi,
  parseRoom,
  parseItem,
  parseEnding,
  parseEncounterNarration,
  narration,
  registerEncounterNarrations,
  _resetEncounterNarrationRegistry,
} from './loader'

const GAME_MD = `---
id: halfstreet
title: Halfstreet
description: A gothic mystery.
startingRoom: "[[outside-gate]]"
startingInventory:
  - "[[letter]]"
endingPriority:
  - "true"
  - wrong
transcriptCap: 200
---

## opening-art
HALFSTREET

## help
Help text.

## ended
The story has ended.
`

describe('parseGame', () => {
  it('parses manifest frontmatter and sections', () => {
    const game = parseGame(GAME_MD, 'game.md')
    expect(game).toEqual({
      id: 'halfstreet',
      title: 'Halfstreet',
      description: 'A gothic mystery.',
      startingRoom: 'outside-gate',
      startingInventory: ['letter'],
      endingPriority: ['true', 'wrong'],
      transcriptCap: 200,
      openingArt: 'HALFSTREET',
      helpText: 'Help text.',
      endedText: 'The story has ended.',
    })
  })

  it('throws when a required section is missing', () => {
    const incomplete = GAME_MD.replace('## help\nHelp text.\n\n', '')
    expect(() => parseGame(incomplete, 'game.md')).toThrow(/missing required section.*help/i)
  })
})

const PARSER_MD = `---
directions:
  n: [n, north]
  s: [s, south]
  e: [e, east]
  w: [w, west]
  u: [u, up]
  d: [d, down]
prepositions: [with, on]
stopWords: [the]
noTargetVerbs: [look]
metaVerbs: [restart]
verbs:
  go: [go]
  look: [look, observe]
  take: [take, pick up]
---

# Parser Vocabulary
`

describe('parseParser', () => {
  it('parses parser vocabulary frontmatter', () => {
    const parser = parseParser(PARSER_MD, 'parser.md')
    expect(parser.verbs.look).toEqual(['look', 'observe'])
    expect(parser.verbs.take).toContain('pick up')
    expect(parser.directions.n).toEqual(['n', 'north'])
    expect(parser.noTargetVerbs).toEqual(['look'])
  })

  it('rejects unsupported verb keys', () => {
    const invalid = PARSER_MD.replace('  take: [take, pick up]', '  dance: [dance]')
    expect(() => parseParser(invalid, 'parser.md')).toThrow()
  })
})

const UI_MD = `---
pageTitle: Halfstreet - Ethan J Lewis
description: A gothic mystery.
robots: noindex
themeColor: "#1a0d00"
footer:
  copyright: "© 2026 Ethan J Lewis"
  copyrightHref: https://ethanjlewis.com
  buildLabel: "Build #"
  showBuild: true
  links:
    - label: GNU 3.0
      href: https://half.st/ejlewis/halfstreet/src/branch/main/LICENSE
    - label: Source Code
      href: https://half.st/ejlewis/halfstreet
features:
  chips: true
  lightMeter: true
  typedEffect: true
  roomScroll: true
---

# UI
`

describe('parseUi', () => {
  it('parses site metadata, footer config, and feature toggles', () => {
    const ui = parseUi(UI_MD, 'ui.md')
    expect(ui.pageTitle).toBe('Halfstreet - Ethan J Lewis')
    expect(ui.footer.buildLabel).toBe('Build #')
    expect(ui.footer.links.map((link) => link.label)).toEqual(['GNU 3.0', 'Source Code'])
    expect(ui.features).toEqual({
      chips: true,
      lightMeter: true,
      typedEffect: true,
      roomScroll: true,
    })
  })
})

const LIGHT_MECHANIC_MD = `---
enabled: true
handler: light
maxTurns: 3
burnOn: [wait]
stateKeys:
  lit: isLit
  burn: fuel
ui:
  meter: true
  icon: candle
---

## noLighter
No flame.

## flameDies
Dark again.
`

describe('parseLightMechanic', () => {
  it('parses configurable light mechanic frontmatter and messages', () => {
    const light = parseLightMechanic(LIGHT_MECHANIC_MD, 'mechanics/light.md')
    expect(light.enabled).toBe(true)
    expect(light.maxTurns).toBe(3)
    expect(light.burnOn).toEqual(['wait'])
    expect(light.stateKeys).toEqual({ lit: 'isLit', burn: 'fuel' })
    expect(light.messages?.noLighter).toBe('No flame.')
    expect(light.messages?.flameDies).toBe('Dark again.')
  })

  it('rejects unknown light message sections', () => {
    const invalid = `${LIGHT_MECHANIC_MD}
## typo
No.
`
    expect(() => parseLightMechanic(invalid, 'mechanics/light.md')).toThrow(/unknown light mechanic section "## typo"/)
  })
})

const RESOLVE_MECHANIC_MD = `---
enabled: true
handler: resolve
ladder: [steady, shaken, reeling, returning]
wrongVerbCost: 2
safeRooms:
  recoverySteps: 2
failure:
  retreatAt: returning
  afterRetreat: reeling
---

# Resolve
`

describe('parseResolveMechanic', () => {
  it('parses configurable resolve mechanic frontmatter', () => {
    const resolve = parseResolveMechanic(RESOLVE_MECHANIC_MD, 'mechanics/resolve.md')
    expect(resolve.enabled).toBe(true)
    expect(resolve.ladder).toEqual(['steady', 'shaken', 'reeling', 'returning'])
    expect(resolve.wrongVerbCost).toBe(2)
    expect(resolve.safeRooms.recoverySteps).toBe(2)
    expect(resolve.failure.afterRetreat).toBe('reeling')
  })

  it('rejects failure levels outside the ladder', () => {
    const invalid = RESOLVE_MECHANIC_MD.replace('ladder: [steady, shaken, reeling, returning]', 'ladder: [steady, shaken]')
    expect(() => parseResolveMechanic(invalid, 'mechanics/resolve.md')).toThrow(/failure\.retreatAt must be present in ladder/)
  })
})

const ACTION_MD = `---
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

## success
The letter catches at one corner. In a few breaths it is ash.

## spent
The matchbook is empty.
`

const HANDLER_ACTION_MD = `---
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

## success
You drink from the bottle.

## secretFoundPassOut
The faceless man steps backward.

## tooManyMovesPassOut
The rooms keep turning.

## reset
The bottle is not with you.
`

describe('parseAction', () => {
  it('parses a declarative action with wikilinks and sections', () => {
    const action = parseAction(ACTION_MD, 'actions/burn-letter.md')
    expect(action.id).toBe('burn-letter')
    expect(action.verbs).toEqual(['use'])
    expect(action.requires?.allVisibleOrHeld).toEqual(['letter', 'matches'])
    expect(action.consumes?.inventory).toEqual(['letter'])
    expect(action.decrements).toEqual({ item: 'matches', stateKey: 'uses' })
    expect(action.setsFlags).toEqual({ letterBurned: true })
    expect(action.messages.success).toContain('ash')
  })

  it('parses a handler-backed drunk transition action', () => {
    const action = parseAction(HANDLER_ACTION_MD, 'actions/drink-whiskey.md')
    expect(action.id).toBe('drink-whiskey')
    expect(action.handler).toBe('drunk-transition')
    expect(action.requires?.allHeld).toEqual(['whiskey'])
    expect(action.consumes?.inventory).toEqual(['whiskey'])
    expect(action.drunkTransition).toEqual({
      destinationRoom: 'drunk-hall',
      maxMoves: 20,
      wakeRoom: 'foyer',
      resetRoom: 'kitchen',
    })
    expect(action.messages.tooManyMovesPassOut).toContain('turning')
  })

  it('requires a success section', () => {
    const invalid = ACTION_MD.replace(/## success[\s\S]*?## spent/, '## spent')
    expect(() => parseAction(invalid, 'actions/burn-letter.md')).toThrow(/missing required section "## success"/)
  })

  it('requires handler-specific sections for drunk transition actions', () => {
    const invalid = HANDLER_ACTION_MD.replace(/## tooManyMovesPassOut[\s\S]*?## reset/, '## reset')
    expect(() => parseAction(invalid, 'actions/drink-whiskey.md')).toThrow(
      /missing required section "## tooManyMovesPassOut" for handler "drunk-transition"/,
    )
  })
})

const MESSAGES_MD = `## unknown-verb
No.

## inventory-empty
Nothing held.
`

describe('parseMessages', () => {
  it('parses keyed message sections', () => {
    expect(parseMessages(MESSAGES_MD, 'messages.md')).toEqual({
      'unknown-verb': 'No.',
      'inventory-empty': 'Nothing held.',
    })
  })

  it('rejects unknown message keys', () => {
    const invalid = `## typo-key
No.
`
    expect(() => parseMessages(invalid, 'messages.md')).toThrow(/unknown message section "## typo-key"/)
  })
})

const FOYER_MD = `---
id: foyer
title: "[ Foyer ]"
exitN: "[[hallway]]"
exitS: null
exitE: null
exitW: null
exitU: null
exitD: null
items:
  - "[[letter]]"
encounter: null
safe: true
---

## first-visit
You stand in the foyer. A folded letter lies on a table.

A hallway leads north.

## revisit
The foyer.

## examined
A foyer with peeling paper.
`

describe('parseRoom', () => {
  it('parses frontmatter and strips wikilinks', () => {
    const room = parseRoom(FOYER_MD, 'rooms/foyer.md')
    expect(room.id).toBe('foyer')
    expect(room.title).toBe('[ Foyer ]')
    expect(room.exits).toEqual({ n: 'hallway' })
    expect(room.items).toEqual(['letter'])
    expect(room.safe).toBe(true)
    expect(room.encounter).toBeUndefined()
  })

  it('captures all three description sections with multi-paragraph prose', () => {
    const room = parseRoom(FOYER_MD, 'rooms/foyer.md')
    expect(room.descriptions.firstVisit).toBe(
      'You stand in the foyer. A folded letter lies on a table.\n\nA hallway leads north.',
    )
    expect(room.descriptions.revisit).toBe('The foyer.')
    expect(room.descriptions.examined).toBe('A foyer with peeling paper.')
  })

  it('throws when a required section is missing', () => {
    const incomplete = FOYER_MD.replace('## examined\nA foyer with peeling paper.\n', '')
    expect(() => parseRoom(incomplete, 'rooms/foyer.md')).toThrow(/missing required section.*examined/i)
  })

  it('throws on malformed frontmatter', () => {
    expect(() => parseRoom('## first-visit\nhi', 'rooms/x.md')).toThrow()
  })

  it('parses a locked exit into lockedExits', () => {
    const md = `---
id: r
title: "[ R ]"
exitN: null
exitS: null
exitE: null
exitW: null
exitU: null
exitD: "[[vault]]"
exitDRequires: "[[rusted-key]]"
exitDLockedText: The door is locked.
items: []
---

## first-visit
.
## revisit
.
## examined
.
`
    const room = parseRoom(md, 'rooms/r.md')
    expect(room.exits).toEqual({ d: 'vault' })
    expect(room.lockedExits).toEqual({
      d: { requires: 'rusted-key', lockedNarration: 'The door is locked.' },
    })
  })

  it('strips aliased wikilinks like [[id|display text]] to just the id', () => {
    const md = `---
id: foyer
title: "[ Foyer ]"
exitN: "[[hallway|the long hallway]]"
exitS: null
exitE: null
exitW: null
exitU: null
exitD: null
items:
  - "[[letter|the folded letter]]"
encounter: null
---

## first-visit
.
## revisit
.
## examined
.
`
    const room = parseRoom(md, 'rooms/foyer.md')
    expect(room.exits).toEqual({ n: 'hallway' })
    expect(room.items).toEqual(['letter'])
  })

  it('throws when locked text is set without requires', () => {
    const md = `---
id: r
title: "[ R ]"
exitN: null
exitS: null
exitE: null
exitW: null
exitU: null
exitD: "[[vault]]"
exitDLockedText: The door is locked.
items: []
---

## first-visit
.
## revisit
.
## examined
.
`
    expect(() => parseRoom(md, 'rooms/r.md')).toThrow(/exitDLockedText is set but exitDRequires is missing/)
  })

  it('throws when requires is set without locked text', () => {
    const md = `---
id: r
title: "[ R ]"
exitN: null
exitS: null
exitE: null
exitW: null
exitU: null
exitD: "[[vault]]"
exitDRequires: "[[rusted-key]]"
items: []
---

## first-visit
.
## revisit
.
## examined
.
`
    expect(() => parseRoom(md, 'rooms/r.md')).toThrow(/exitDRequires is set but exitDLockedText is missing/)
  })
})

// Add to the bottom of loader.test.ts

const LAMP_MD = `---
id: lamp
names: [lamp, oil lamp, torch]
short: an oil lamp
takeable: true
initialState:
  lit: false
---

An iron oil lamp with a glass chimney. Currently unlit.
`

describe('parseItem', () => {
  it('parses an item with state', () => {
    const item = parseItem(LAMP_MD, 'items/lamp.md')
    expect(item).toEqual({
      id: 'lamp',
      names: ['lamp', 'oil lamp', 'torch'],
      short: 'an oil lamp',
      long: 'An iron oil lamp with a glass chimney. Currently unlit.',
      initialState: { lit: false },
      takeable: true,
    })
  })

  it('uses empty initialState when omitted', () => {
    const md = `---
id: x
names: [x]
short: x
takeable: false
---

The long description.
`
    const item = parseItem(md, 'items/x.md')
    expect(item.initialState).toEqual({})
  })

  it('throws when body is empty', () => {
    const md = `---
id: x
names: [x]
short: x
takeable: false
---
`
    expect(() => parseItem(md, 'items/x.md')).toThrow(/empty long description/i)
  })
})

const TRUE_ENDING_MD = `---
id: true
whenFlags:
  ratGone: true
---

You stand at the top of the stair. The thing below has settled.

The door behind you opens, and outside, finally, is morning.
`

describe('parseEnding', () => {
  it('parses an ending with flags and prose', () => {
    const result = parseEnding(TRUE_ENDING_MD, 'endings/true.md')
    expect(result.id).toBe('true')
    expect(result.ending.whenFlags).toEqual({ ratGone: true })
    expect(result.ending.narration).toBe(
      'You stand at the top of the stair. The thing below has settled.\n\nThe door behind you opens, and outside, finally, is morning.',
    )
  })

  it('accepts an empty body (unreachable ending stub)', () => {
    const md = `---
id: wrong
whenFlags: {}
---
`
    const result = parseEnding(md, 'endings/wrong.md')
    expect(result.ending.narration).toBe('')
  })
})

const RAT_MD = `---
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
        narration: attack-resolved
        to: resolved
      - verb: wait
        chipLabel: WAIT
        narration: wait-stays
        to: lurking
---

## lurking
A heavy rat watches you from the third step. Its eyes catch the light.

## attack-resolved
You stamp. The rat squeals and is gone into the dark.

## wait-stays
The rat does not move. Neither do you.

## wrong-verb
The rat watches.
`

describe('parseEncounterNarration', () => {
  it('parses frontmatter and narration sections', () => {
    const doc = parseEncounterNarration(RAT_MD, 'encounters/rat.md')
    expect(doc.id).toBe('rat')
    expect(doc.startsIn).toBe('cellar-stair')
    expect(doc.initialPhase).toBe('lurking')
    expect(doc.narrations).toEqual({
      lurking: 'A heavy rat watches you from the third step. Its eyes catch the light.',
      'attack-resolved': 'You stamp. The rat squeals and is gone into the dark.',
      'wait-stays': 'The rat does not move. Neither do you.',
      'wrong-verb': 'The rat watches.',
    })
    expect(doc.encounter).toMatchObject({
      id: 'rat',
      startsIn: 'cellar-stair',
      initialPhase: 'lurking',
      onResolved: { setFlags: { ratGone: true } },
      defaultWrongVerbNarration: 'The rat watches.',
    })
    const lurking = doc.encounter?.phases.lurking
    expect(lurking).toBeDefined()
    expect(lurking?.description).toContain('heavy rat')
    expect(lurking?.transitions).toEqual([
      {
        verb: 'attack',
        target: 'rat',
        chipLabel: 'ATTACK RAT',
        chipCommand: 'attack rat',
        narration: 'You stamp. The rat squeals and is gone into the dark.',
        to: 'resolved',
      },
      {
        verb: 'wait',
        chipLabel: 'WAIT',
        narration: 'The rat does not move. Neither do you.',
        to: 'lurking',
      },
    ])
  })

  it('throws when encounter frontmatter points at a missing prose section', () => {
    const invalid = RAT_MD.replace('narration: attack-resolved', 'narration: missing-key')
    expect(() => parseEncounterNarration(invalid, 'encounters/rat.md')).toThrow(
      /frontmatter references missing section "## missing-key"/,
    )
  })

  it('throws when no sections are present', () => {
    const md = `---
id: x
startsIn: room
initialPhase: p
---
`
    expect(() => parseEncounterNarration(md, 'encounters/x.md')).toThrow(/no narration sections/i)
  })
})

describe('narration registry', () => {
  beforeEach(() => {
    _resetEncounterNarrationRegistry()
  })

  it('returns prose for a registered encounter and key', () => {
    registerEncounterNarrations([
      { id: 'rat', startsIn: 'cellar-stair', initialPhase: 'lurking', narrations: { lurking: 'watches' } },
    ])
    expect(narration('rat', 'lurking')).toBe('watches')
  })

  it('throws with available keys when key is missing', () => {
    registerEncounterNarrations([
      { id: 'rat', startsIn: 'cellar-stair', initialPhase: 'lurking', narrations: { lurking: 'a', resolved: 'b' } },
    ])
    expect(() => narration('rat', 'sleping')).toThrow(/no matching section.*Available: lurking, resolved/i)
  })

  it('throws when encounter is unknown', () => {
    expect(() => narration('ghost', 'whatever')).toThrow(/unknown encounter id "ghost"/i)
  })
})

describe('parseItem — body sections', () => {
  it('extracts ## read into readableText', () => {
    const md = `---
id: letter
names: [letter, note]
short: a folded letter
takeable: true
readable: true
---

A folded letter, sealed with wax.

## read
You loved Halfstreet, the letter says. I loved it too.
`
    const item = parseItem(md, 'items/letter.md')
    expect(item.long).toBe('A folded letter, sealed with wax.')
    expect(item.readable).toBe(true)
    expect(item.readableText).toBe('You loved Halfstreet, the letter says. I loved it too.')
  })

  it('extracts ## lit and ## extinguished', () => {
    const md = `---
id: lamp
names: [lamp]
short: an oil lamp
takeable: true
lightable: true
initialState:
  lit: false
---

An iron oil lamp.

## lit
The wick catches; warm yellow light fills the space.

## extinguished
You smother the flame. The room darkens.
`
    const item = parseItem(md, 'items/lamp.md')
    expect(item.long).toBe('An iron oil lamp.')
    expect(item.litText).toBe('The wick catches; warm yellow light fills the space.')
    expect(item.extinguishedText).toBe('You smother the flame. The room darkens.')
  })

  it('extracts ## lighter-empty', () => {
    const md = `---
id: matches
names: [matches]
short: a matchbook
takeable: true
lighter: true
lighterUses: 4
---

A matchbook from the Halfstreet Hotel.

## lighter-empty
The last match flares and dies. The book is empty.
`
    const item = parseItem(md, 'items/matches.md')
    expect(item.lighterEmptyText).toBe('The last match flares and dies. The book is empty.')
  })

  it('throws when readable: true but ## read is missing', () => {
    const md = `---
id: x
names: [x]
short: x
takeable: true
readable: true
---

A thing.
`
    expect(() => parseItem(md, 'items/x.md')).toThrow(/## read.*required when readable/i)
  })

  it('still parses items with no body sections (back-compat)', () => {
    const md = `---
id: lamp
names: [lamp]
short: an oil lamp
takeable: true
---

An iron oil lamp with a glass chimney.
`
    const item = parseItem(md, 'items/lamp.md')
    expect(item.long).toBe('An iron oil lamp with a glass chimney.')
    expect(item.readable).toBeUndefined()
    expect(item.readableText).toBeUndefined()
  })

  it('throws for unknown section keys', () => {
    const md = `---
id: x
names: [x]
short: x
takeable: true
---

A thing.

## badkey
Content.
`
    expect(() => parseItem(md, 'items/x.md')).toThrow(/unknown item section "## badkey".*Allowed:.*read.*lit.*extinguished.*lighter-empty/i)
  })
})

describe('parseRoom invalid headers', () => {
  it('throws a clear error when a header has spaces', () => {
    const md = `---
id: r
title: "[ R ]"
exitN: null
exitS: null
exitE: null
exitW: null
exitU: null
exitD: null
items: []
---

## first visit
This is the first visit.
## revisit
.
## examined
.
`
    expect(() => parseRoom(md, 'rooms/r.md')).toThrow(
      /invalid section header "## first visit".*letters, digits, hyphens/,
    )
  })

  it('throws a clear error when a header has dots', () => {
    const md = `---
id: r
title: "[ R ]"
exitN: null
exitS: null
exitE: null
exitW: null
exitU: null
exitD: null
items: []
---

## v2.0
.
## first-visit
.
## revisit
.
## examined
.
`
    expect(() => parseRoom(md, 'rooms/r.md')).toThrow(/invalid section header "## v2\.0"/)
  })
})
