// Stub. Replaced in Task 10 with the full terminal implementation.
console.info('[halfstreet] terminal placeholder loaded')

const transcript = document.querySelector<HTMLDivElement>('[data-mystery-transcript]')
if (transcript) {
  const line = document.createElement('div')
  line.className = 'narration'
  line.textContent = 'Terminal scaffold loaded. Type wiring lands in the next task.'
  transcript.appendChild(line)
}
