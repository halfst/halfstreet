const STORAGE_KEY = 'halfstreet:theme:v1'
const CURSOR_STORAGE_KEY = 'halfstreet:cursor:v1'
const CHIPS_STORAGE_KEY = 'halfstreet:chips:v1'

type Theme = 'amber' | 'ansi'
type Cursor = 'bar' | 'block' | 'underscore'
type Chips = 'on' | 'off'

function getStored(): Theme {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) === 'ansi' ? 'ansi' : 'amber'
  } catch {
    return 'amber'
  }
}

function getStoredCursor(): Cursor {
  try {
    const stored = localStorage.getItem(CURSOR_STORAGE_KEY)
    return stored === 'block' || stored === 'underscore' ? stored : 'bar'
  } catch {
    return 'bar'
  }
}

function getStoredChips(): Chips {
  try {
    return localStorage.getItem(CHIPS_STORAGE_KEY) === 'off' ? 'off' : 'on'
  } catch {
    return 'on'
  }
}

function setTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-mystery-theme', theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore
  }
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]')) {
    btn.setAttribute('aria-pressed', btn.dataset['themeChoice'] === theme ? 'true' : 'false')
  }
}

function setCursor(cursor: Cursor): void {
  document.documentElement.setAttribute('data-mystery-cursor', cursor)
  try {
    localStorage.setItem(CURSOR_STORAGE_KEY, cursor)
  } catch {
    // ignore
  }
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-cursor-choice]')) {
    btn.setAttribute('aria-pressed', btn.dataset['cursorChoice'] === cursor ? 'true' : 'false')
  }
}

function setChips(chips: Chips): void {
  document.documentElement.setAttribute('data-mystery-chips-state', chips)
  try {
    localStorage.setItem(CHIPS_STORAGE_KEY, chips)
  } catch {
    // ignore
  }
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-chips-choice]')) {
    btn.setAttribute('aria-pressed', btn.dataset['chipsChoice'] === chips ? 'true' : 'false')
  }
}

const initial = getStored()
setTheme(initial)
setCursor(getStoredCursor())
setChips(getStoredChips())

const optionsRoot = document.querySelector<HTMLElement>('[data-mystery-options]')
const optionsToggle = document.querySelector<HTMLButtonElement>('[data-options-toggle]')
const optionsMenu = document.querySelector<HTMLElement>('[data-options-menu]')

function setOptionsOpen(open: boolean): void {
  if (!optionsToggle || !optionsMenu) return
  optionsToggle.setAttribute('aria-expanded', open ? 'true' : 'false')
  optionsMenu.hidden = !open
  document.documentElement.toggleAttribute('data-mystery-options-open', open)
}

optionsToggle?.addEventListener('click', () => {
  setOptionsOpen(optionsToggle.getAttribute('aria-expanded') !== 'true')
})

document.addEventListener('click', (event) => {
  if (!optionsRoot || !optionsRoot.contains(event.target as Node)) {
    setOptionsOpen(false)
  }
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setOptionsOpen(false)
})

document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const next = (btn.dataset['themeChoice'] as Theme | undefined) ?? 'amber'
    setTheme(next)
  })
})

document.querySelectorAll<HTMLButtonElement>('[data-cursor-choice]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const next = (btn.dataset['cursorChoice'] as Cursor | undefined) ?? 'bar'
    setCursor(next)
  })
})

document.querySelectorAll<HTMLButtonElement>('[data-chips-choice]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const next = (btn.dataset['chipsChoice'] as Chips | undefined) ?? 'on'
    setChips(next)
  })
})

document.querySelector<HTMLButtonElement>('[data-restart-choice]')?.addEventListener('click', () => {
  setOptionsOpen(false)
  document.dispatchEvent(new CustomEvent('halfstreet-restart'))
})

// Allow the engine's `theme` meta-command (handled in terminal.ts) to flip
// without going through the button by listening for a custom event.
document.addEventListener('halfstreet-toggle-theme', () => {
  const current = (document.documentElement.getAttribute('data-mystery-theme') as Theme | null) ?? 'amber'
  setTheme(current === 'amber' ? 'ansi' : 'amber')
})

export {}
