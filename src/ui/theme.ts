const STORAGE_KEY = 'halfstreet:theme:v1'

type Theme = 'amber' | 'ansi'

function getStored(): Theme {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) === 'ansi' ? 'ansi' : 'amber'
  } catch {
    return 'amber'
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

const initial = getStored()
setTheme(initial)

document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const next = (btn.dataset['themeChoice'] as Theme | undefined) ?? 'amber'
    setTheme(next)
  })
})

// Allow the engine's `theme` meta-command (handled in terminal.ts) to flip
// without going through the button by listening for a custom event.
document.addEventListener('halfstreet-toggle-theme', () => {
  const current = (document.documentElement.getAttribute('data-mystery-theme') as Theme | null) ?? 'amber'
  setTheme(current === 'amber' ? 'ansi' : 'amber')
})

export {}
