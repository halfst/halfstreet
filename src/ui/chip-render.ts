import type { Chip } from './chips'

const CHIP_CONTAINER = '.mystery-chips[data-mystery-chips]'

export function renderChips(chips: Chip[], onSelect: (command: string) => void): void {
  const container = document.querySelector<HTMLDivElement>(CHIP_CONTAINER)
  if (!container) return
  container.innerHTML = ''
  for (const chip of chips) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'mystery-chip'
    btn.dataset['chipKind'] = chip.kind
    btn.textContent = chip.label
    if (chip.disabled) btn.disabled = true
    else btn.addEventListener('click', () => onSelect(chip.command))
    container.appendChild(btn)
  }
}
