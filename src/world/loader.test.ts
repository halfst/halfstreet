import { describe, it, expect, beforeEach } from 'vitest'
import { parseRoom, parseItem, parseEnding, parseEncounterNarration, narration, registerEncounterNarrations, _resetEncounterNarrationRegistry } from './loader'

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
---

## lurking
A heavy rat watches you from the third step. Its eyes catch the light.

## attack-resolved
You stamp. The rat squeals and is gone into the dark.

## wait-stays
The rat does not move. Neither do you.
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
    })
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
