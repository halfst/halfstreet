import { parse } from '../engine/parser'
import type { ParserContext } from '../engine/parser'
import { dispatch, initialStateFor, getItemsInRoom, getLightStatus, LIGHT_TURNS_MAX } from '../engine/dispatcher'
import { saveState, loadState, clearSave } from '../engine/save'
import { world } from '../world'
import type { GameState, TranscriptLine } from '../engine/types'
import { TRANSCRIPT_CAP } from '../engine/types'
import { computeChips } from './chips'
import { renderChips } from './chip-render'
import LIGHT_ICON_SVG from '../assets/noun-candle-6409709.svg?raw'

const transcriptEl = document.querySelector<HTMLDivElement>('[data-mystery-transcript]')
const inputEl = document.querySelector<HTMLInputElement>('[data-mystery-input]')
const inputDisplayEl = document.querySelector<HTMLSpanElement>('[data-mystery-input-display]')
const lightMeterEl = document.querySelector<HTMLDivElement>('[data-mystery-light-meter]')

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

if (!transcriptEl || !inputEl || !inputDisplayEl) {
  console.error('[halfstreet] terminal mount points missing')
} else {
  const restored = loadState()
  let state: GameState = restored ?? initialStateFor(world)
  let lastState: GameState | null = null   // for one-step undo
  let transientHelpEl: HTMLDivElement | null = null
  let commandHistory: string[] = []
  let historyIndex: number | null = null
  let historyDraft = ''
  let idleHintTimer: number | null = null

  const syncLightMeter = (): void => {
    if (!lightMeterEl) return
    const status = getLightStatus(state, world)
    lightMeterEl.hidden = !status
    if (!status) {
      lightMeterEl.innerHTML = ''
      lightMeterEl.dataset['lit'] = 'false'
      lightMeterEl.dataset['turnsLeft'] = '0'
      return
    }

    lightMeterEl.innerHTML = ''
    lightMeterEl.dataset['lit'] = 'true'
    lightMeterEl.dataset['turnsLeft'] = String(status.turnsLeft)

    const icon = document.createElement('div')
    icon.className = 'mystery-light-icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.innerHTML = LIGHT_ICON_SVG
    lightMeterEl.appendChild(icon)

    const leds = document.createElement('div')
    leds.className = 'mystery-light-leds'
    const turnsLeft = Math.max(0, Math.min(LIGHT_TURNS_MAX, status.turnsLeft))
    for (let i = 0; i < LIGHT_TURNS_MAX; i++) {
      const segment = document.createElement('span')
      segment.className = 'mystery-light-segment'
      const lit = i < turnsLeft
      segment.dataset['segmentState'] = lit ? 'lit' : 'dim'
      segment.style.backgroundColor = lit ? 'var(--m-fg)' : 'var(--m-dim)'
      segment.style.boxShadow = lit ? '0 0 7px var(--m-fg)' : '0 0 0 1px rgba(0, 0, 0, 0.15) inset'
      segment.style.opacity = lit ? '1' : '0.45'
      leds.appendChild(segment)
    }
    lightMeterEl.appendChild(leds)
  }

  if (!restored) {
    // Fresh state already includes the opening narration in its transcript.
  } else if (restored.transcript.length === 0) {
    // Edge case: a restored state with no transcript (older save discarded
    // and we fell back to fresh — handled above — or a corrupted slice).
    state = initialStateFor(world)
  }

  function refreshChips(): void {
    renderChips(computeChips(state, world), (command) => {
      clearIdleHint()
      inputEl!.value = command
      syncCommandLine()
      if (command.endsWith(' ')) {
        inputEl!.focus()
        inputEl!.setSelectionRange(command.length, command.length)
        return
      }
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

  const syncCommandLine = (): void => {
    const visibleText = inputEl.value || inputEl.placeholder
    inputDisplayEl.textContent = visibleText
    inputDisplayEl.dataset['placeholder'] = inputEl.value ? 'false' : inputEl.placeholder ? 'true' : 'false'
  }

  const syncInputFocus = (focused: boolean): void => {
    document.documentElement.toggleAttribute('data-mystery-input-focused', focused)
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
      if (line.kind === 'system' && line.text.includes('|_| |_|')) {
        el.classList.add('ascii-art')
      }
      el.textContent = line.text
      transcriptEl.appendChild(el)
    }
    transcriptEl.scrollTop = transcriptEl.scrollHeight
  }

  const clearIdleHint = (): void => {
    if (idleHintTimer !== null) {
      window.clearTimeout(idleHintTimer)
      idleHintTimer = null
    }
    inputEl.placeholder = ''
    syncCommandLine()
  }

  const scheduleIdleHint = (): void => {
    clearIdleHint()
    idleHintTimer = window.setTimeout(() => {
      inputEl.placeholder = 'type here...'
      syncCommandLine()
    }, 30000)
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
    el.dataset['transientHelp'] = 'true'

    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'mystery-help-close'
    close.dataset['helpClose'] = 'true'
    close.setAttribute('aria-label', 'Close help')
    close.textContent = 'x'
    close.addEventListener('click', (e) => {
      e.stopPropagation()
      clearTransientHelp()
      return
    })

    const text = document.createElement('div')
    text.className = 'mystery-help-body'
    text.textContent = HELP_TEXT
    el.append(close, text)
    transcriptEl.appendChild(el)
    transientHelpEl = el
    transcriptEl.scrollTop = transcriptEl.scrollHeight
  }

  document.addEventListener('pointerdown', (e) => {
    if (!transientHelpEl) return
    const target = e.target as Node | null
    if (target && transientHelpEl.contains(target)) return
    clearTransientHelp()
  })

  const hideHelpOnInput = (): void => {
    if (!transientHelpEl) return
    window.setTimeout(() => {
      if (inputEl.value.trim().length > 0) clearTransientHelp()
    })
  }

  // For UI-originated lines (player input, restart/undo/quit messages, error
  // notices). Pushes into state.transcript so they survive reload, then renders.
  // Engine-originated lines (from dispatch) are already in state.transcript;
  // those use renderAll directly.
  const appendLines = (lines: TranscriptLine[]): void => {
    state = { ...state, transcript: [...state.transcript, ...lines].slice(-TRANSCRIPT_CAP) }
    renderAll(lines)
  }

  const restart = (): void => {
    const confirmed = confirm('Restart? Your progress will be lost.')
    if (!confirmed) {
      appendLines([{ kind: 'system', text: '(restart cancelled)' }])
      return
    }
    clearSave()
    state = initialStateFor(world)
    transcriptEl.innerHTML = ''
    inputEl.value = ''
    syncCommandLine()
    renderAll(state.transcript)
    saveState(state)
    refreshChips()
    syncLightMeter()
    syncEndedUI()
  }

  renderAll(state.transcript)
  refreshChips()
  syncLightMeter()
  syncEndedUI()
  syncCommandLine()
  scheduleIdleHint()

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (commandHistory.length === 0) return
      e.preventDefault()
      if (historyIndex === null) {
        historyDraft = inputEl.value
        historyIndex = commandHistory.length
      }
      if (e.key === 'ArrowUp') {
        historyIndex = Math.max(0, historyIndex - 1)
      } else {
        historyIndex = Math.min(commandHistory.length, historyIndex + 1)
      }
      inputEl.value = historyIndex === commandHistory.length ? historyDraft : commandHistory[historyIndex]!
      inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length)
      syncCommandLine()
      return
    }
    if (e.key !== 'Enter') return
    e.preventDefault()
    const raw = inputEl.value
    inputEl.value = ''
    syncCommandLine()
    if (!raw.trim()) return
    clearTransientHelp()
    clearIdleHint()
    commandHistory = [...commandHistory, raw].slice(-50)
    historyIndex = null
    historyDraft = ''
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
      restart()
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
        syncLightMeter()
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
      syncLightMeter()
      syncEndedUI()
    } catch (err) {
      console.error('[halfstreet] dispatch error', err)
      appendLines([{ kind: 'system', text: '[ The terminal hums and resets. ]' }])
    }
  })

  inputEl.addEventListener('input', syncCommandLine)
  inputEl.addEventListener('focus', () => {
    syncInputFocus(true)
    clearIdleHint()
  })
  inputEl.addEventListener('blur', () => {
    syncInputFocus(false)
  })
  inputEl.addEventListener('pointerdown', clearIdleHint)

  inputEl.parentElement?.addEventListener('pointerdown', () => {
    inputEl.focus()
  })

  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement | null
    const isEditable =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable === true
    if (e.key === '/' && !isEditable) {
      e.preventDefault()
      clearIdleHint()
      inputEl.focus()
      inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length)
      return
    }
    if (e.key === 'Escape') {
      if (transientHelpEl) {
        e.preventDefault()
        clearTransientHelp()
        return
      }
      saveState(state)
      window.location.href = '/'
    }
  })

  document.addEventListener('halfstreet-restart', restart)
  inputEl.addEventListener('input', hideHelpOnInput)
}
