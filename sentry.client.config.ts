import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
  replaysSessionSampleRate: 0, // No session replays (save quota)
  replaysOnErrorSampleRate: 0, // No error replays
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN, // Graceful no-op if DSN not set
})
