import { parse } from '../engine/parser'
import type { ParserContext } from '../engine/parser'
import { dispatch, initialStateFor } from '../engine/dispatcher'
import { saveState, loadState, clearSave } from '../engine/save'
import { world } from '../world'
import type { GameState, TranscriptLine } from '../engine/types'
import { TRANSCRIPT_CAP } from '../engine/types'
import { computeChips } from './chips'
import { renderChips } from './chip-render'

const transcriptEl = document.querySelector<HTMLDivElement>('[data-mystery-transcript]')
const inputEl = document.querySelector<HTMLInputElement>('[data-mystery-input]')

if (!transcriptEl || !inputEl) {
  console.error('[halfstreet] terminal mount points missing')
} else {
  const restored = loadState()
  let state: GameState = restored ?? initialStateFor(world)
  let lastState: GameState | null = null   // for one-step undo

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

  const buildParserContext = (s: GameState): ParserContext => {
    const room = world.rooms[s.location]
    const visibleNouns: { id: string; aliases: string[] }[] = []
    if (room) {
      for (const id of room.items) {
        const it = world.items[id]
        if (it) visibleNouns.push({ id, aliases: it.names })
      }
      if (room.encounter && s.encounterState[room.encounter]) {
        visibleNouns.push({ id: room.encounter, aliases: [room.encounter] })
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
  inputEl.focus()

  inputEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const raw = inputEl.value
    inputEl.value = ''
    if (!raw.trim()) return
    appendLines([{ kind: 'player', text: raw }])

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
      return
    }
    if (trimmed === 'undo') {
      if (lastState) {
        state = lastState
        lastState = null
        appendLines([{ kind: 'system', text: '(undone)' }])
        saveState(state)
        refreshChips()
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
