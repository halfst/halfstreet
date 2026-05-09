import { describe, it, expect } from 'vitest'
import { parseRoom } from './loader'

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
})
