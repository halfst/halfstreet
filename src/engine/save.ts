import type { GameState } from './types'
import { SCHEMA_VERSION, TRANSCRIPT_CAP } from './types'

export const SAVE_KEY = 'halfstreet:save:v1'

/** Save the state to localStorage, truncating the transcript to TRANSCRIPT_CAP. */
export function saveState(state: GameState): void {
  const trimmed: GameState = {
    ...state,
    transcript:
      state.transcript.length > TRANSCRIPT_CAP
        ? state.transcript.slice(-TRANSCRIPT_CAP)
        : state.transcript,
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(trimmed))
  } catch (err) {
    // Quota exceeded or storage disabled — silently fail. The game still runs;
    // the player just won't have persistence.
    if (typeof console !== 'undefined') console.warn('halfstreet save failed', err)
  }
}

/** Load the state, or return null if nothing is saved or the save is unusable. */
export function loadState(): GameState | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(SAVE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    clearSave()
    return null
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as { schemaVersion?: unknown }).schemaVersion !== SCHEMA_VERSION
  ) {
    clearSave()
    return null
  }

  // Older saves may carry fields no longer in GameState (e.g. `theme` before
  // it became a UI-only preference). TypeScript ignores extra fields at runtime;
  // bump SCHEMA_VERSION only when the meaning of an existing field changes.
  return parsed as GameState
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // ignore
  }
}
