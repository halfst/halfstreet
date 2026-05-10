import { parse } from '../engine/parser'
import type { ParserContext } from '../engine/parser'
import { dispatch, initialStateFor, getItemsInRoom } from '../engine/dispatcher'
import { saveState, loadState, clearSave } from '../engine/save'
import { world } from '../world'
import type { GameState, TranscriptLine } from '../engine/types'
import { TRANSCRIPT_CAP } from '../engine/types'
import { computeChips } from './chips'
import { renderChips } from './chip-render'

const transcriptEl = document.querySelector<HTMLDivElement>('[data-mystery-transcript]')
const inputEl = document.querySelector<HTMLInputElement>('[data-mystery-input]')

const HELP_TEXT = `You arrive at the address, but you do not remember what has happened. The road behind you is gone...

This is a text adventure. Type short commands to act in the house.

Common commands:
look                    describe the room again
n, s, e, w, u, d        move by direction
take lamp               pick something up
examine letter          inspect something nearby or held
read letter             read a readable object
inventory               see what you carry
light lamp with matches use one thing with another
wait                    let the room continue
undo                    step back once
restart                 begin again
theme                   change the terminal colors

Most commands are verb first, then the thing: examine gate, take lamp, use key on door.`

if (!transcriptEl || !inputEl) {
  console.error('[halfstreet] terminal mount points missing')
} else {
  const restored = loadState()
  let state: GameState = restored ?? initialStateFor(world)
  let lastState: GameState | null = null   // for one-step undo
  let transientHelpEl: HTMLDivElement | null = null

  if (!restored) {
    // Fresh state already includes the opening narration in its transcript.
  } else if (restored.transcript.length === 0) {
    // Edge case: a restored state with no transcript (older save discarded
    // and we fell back to fresh — handled above — or a corrupted slice).
    state = initialStateFor(world)
  }

  function refreshChips(): void {
    renderChips(computeChips(state, world), (command) => {
      inputEl!.value = command
      inputEl!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    })
  }

  const syncEndedUI = (): void => {
    // Don't disable the input — the player still needs to type `restart` or
    // `undo`. A `disabled` input rejects keydown events entirely. Use a class
    // for visual styling instead; the keydown handler enforces the input
    // restriction.
    inputEl!.classList.toggle('ended', state.endedWith !== null)
  }

  const buildParserContext = (s: GameState): ParserContext => {
    const room = world.rooms[s.location]
    const visibleNouns: { id: string; aliases: string[] }[] = []
    if (room) {
      for (const id of getItemsInRoom(s, world, s.location)) {
        const it = world.items[id]
        if (it) visibleNouns.push({ id, aliases: it.names })
      }
      if (room.encounter && s.encounterState[room.encounter]) {
        const encounter = world.encounters[room.encounter]
        visibleNouns.push({
          id: room.encounter,
          aliases: [room.encounter, room.encounter.replace(/-/g, ' '), ...(encounter?.aliases ?? [])],
        })
      }
    }
    for (const inst of s.inventory) {
      const it = world.items[inst.id]
      if (it) visibleNouns.push({ id: inst.id, aliases: it.names })
    }
    return {
      knownItems: Object.keys(world.items),
      knownEncounters: Object.keys(world.encounters),
      visibleNouns,
      inventoryItemIds: s.inventory.map((i) => i.id),
      lastNoun: s.lastNoun,
      awaitingDisambiguation: s.pendingDisambiguation,
    }
  }

  const renderAll = (lines: TranscriptLine[]): void => {
    if (!transcriptEl) return
    for (const line of lines) {
      const el = document.createElement('div')
      el.className = line.kind
      el.textContent = line.text
      transcriptEl.appendChild(el)
    }
    transcriptEl.scrollTop = transcriptEl.scrollHeight
  }

  const clearTransientHelp = (): void => {
    transientHelpEl?.remove()
    transientHelpEl = null
  }

  const renderTransientHelp = (): void => {
    if (!transcriptEl) return
    clearTransientHelp()
    const el = document.createElement('div')
    el.className = 'system help'
    el.dataset.transientHelp = 'true'
    el.textContent = HELP_TEXT
    transcriptEl.appendChild(el)
    transientHelpEl = el
    transcriptEl.scrollTop = transcriptEl.scrollHeight
  }

  // For UI-originated lines (player input, restart/undo/quit messages, error
  // notices). Pushes into state.transcript so they survive reload, then renders.
  // Engine-originated lines (from dispatch) are already in state.transcript;
  // those use renderAll directly.
  const appendLines = (lines: TranscriptLine[]): void => {
    state = { ...state, transcript: [...state.transcript, ...lines].slice(-TRANSCRIPT_CAP) }
    renderAll(lines)
  }

  renderAll(state.transcript)
  refreshChips()
  syncEndedUI()
  inputEl.focus()

  inputEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const raw = inputEl.value
    inputEl.value = ''
    if (!raw.trim()) return
    clearTransientHelp()
    appendLines([{ kind: 'player', text: raw }])

    // Once the game has ended, only restart and undo are allowed.
    if (state.endedWith !== null) {
      const lower = raw.trim().toLowerCase()
      if (lower !== 'restart' && lower !== 'undo') {
        appendLines([{ kind: 'system', text: 'The story has ended. Type `restart` or `undo`.' }])
        return
      }
    }

    // Engine-level meta-commands handled here so the engine stays pure.
    const trimmed = raw.trim().toLowerCase()
    if (trimmed === 'restart') {
      const confirmed = confirm('Restart? Your progress will be lost.')
      if (!confirmed) {
        appendLines([{ kind: 'system', text: '(restart cancelled)' }])
        return
      }
      clearSave()
      state = initialStateFor(world)
      transcriptEl.innerHTML = ''
      renderAll(state.transcript)
      saveState(state)
      refreshChips()
      syncEndedUI()
      return
    }
    if (trimmed === 'help') {
      renderTransientHelp()
      return
    }
    if (trimmed === 'undo') {
      if (lastState) {
        state = lastState
        lastState = null
        appendLines([{ kind: 'system', text: '(undone)' }])
        saveState(state)
        refreshChips()
        syncEndedUI()
      } else {
        appendLines([{ kind: 'system', text: 'There is no further back.' }])
      }
      return
    }
    if (trimmed === 'quit') {
      saveState(state)
      window.location.href = '/'
      return
    }

    // Engine dispatch — wrapped so a thrown error doesn't kill the terminal.
    try {
      const ctx = buildParserContext(state)
      const command = parse(raw, ctx)
      lastState = state
      const result = dispatch(state, command, world)
      state = result.state
      renderAll(result.appended)  // dispatch already pushed these into state.transcript
      saveState(state)
      transcriptEl.scrollTop = transcriptEl.scrollHeight
      if (raw.trim().toLowerCase() === 'theme') {
        document.dispatchEvent(new CustomEvent('halfstreet-toggle-theme'))
      }
      refreshChips()
      syncEndedUI()
    } catch (err) {
      console.error('[halfstreet] dispatch error', err)
      appendLines([{ kind: 'system', text: '[ The terminal hums and resets. ]' }])
    }
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      saveState(state)
      window.location.href = '/'
    }
  })
}
