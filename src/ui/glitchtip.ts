import * as Sentry from '@sentry/browser'

const dsn = import.meta.env.PUBLIC_GLITCHTIP_DSN as string | undefined
const release = import.meta.env.PUBLIC_GLITCHTIP_RELEASE as string | undefined

export function initGlitchTip(): void {
  if (!dsn) return

  Sentry.init({
    dsn,
    release,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.01,
  })
}
