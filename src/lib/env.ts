/**
 * Runtime environment variable validation using Zod.
 *
 * This module validates all environment variables at import time.
 * If required variables are missing or invalid, the process logs a
 * human-readable error table and throws — preventing silent failures
 * at random call sites deep in the application.
 *
 * Usage:
 *   import { env } from '@/lib/env'
 *   // env.ANTHROPIC_API_KEY is typed string, guaranteed present
 *
 * For client-safe (NEXT_PUBLIC_*) vars:
 *   import { publicEnv } from '@/lib/env'
 */
import { z } from 'zod'

// ─── Server-side schema (never exposed to browser) ───────────────────────────

const serverEnvSchema = z.object({
  // Supabase — required
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // AI — required
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),

  // Cron jobs — required
  CRON_SECRET: z.string().min(1, 'CRON_SECRET is required'),

  // Site URL — optional (used in password reset emails)
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  // Telegram bots — optional (agents degrade gracefully if token missing)
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_TOKEN_EGITIMCI: z.string().optional(),
  TELEGRAM_BOT_TOKEN_SATIS: z.string().optional(),
  TELEGRAM_BOT_TOKEN_MUHASEBECI: z.string().optional(),
  TELEGRAM_BOT_TOKEN_DEPO_SORUMLUSU: z.string().optional(),
  TELEGRAM_BOT_TOKEN_GENEL_MUDUR: z.string().optional(),
  TELEGRAM_BOT_TOKEN_TAHSILAT_UZMANI: z.string().optional(),
  TELEGRAM_BOT_TOKEN_DAGITIM_KOORDINATORU: z.string().optional(),
  TELEGRAM_BOT_TOKEN_SAHA_SATIS: z.string().optional(),
  TELEGRAM_BOT_TOKEN_PAZARLAMACI: z.string().optional(),
  TELEGRAM_BOT_TOKEN_URUN_YONETICISI: z.string().optional(),
  TELEGRAM_BOT_TOKEN_SATIN_ALMA: z.string().optional(),
  TELEGRAM_BOT_TOKEN_IADE_KALITE: z.string().optional(),

  // Sihirbaz (Onboarding Wizard) bot
  TELEGRAM_BOT_TOKEN_SIHIRBAZ: z.string().optional(),
  TELEGRAM_BOT_USERNAME_SIHIRBAZ: z.string().optional(),

  // Error tracking — optional (used by Plan 05 Sentry integration)
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
})

// ─── Public-only schema (safe for client bundle) ─────────────────────────────

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
})

// ─── Parsed exports ───────────────────────────────────────────────────────────

export type ServerEnv = z.infer<typeof serverEnvSchema>
export type PublicEnv = z.infer<typeof publicEnvSchema>

/**
 * Validated server-side environment variables.
 * Throws at module load time if any required variable is missing or invalid.
 *
 * Import this in server-only code (API routes, Server Actions, agent code).
 * Never import this in client components — it exposes server secrets.
 */
let env: ServerEnv

try {
  env = serverEnvSchema.parse(process.env)
} catch (err) {
  if (err instanceof z.ZodError) {
    const missing = err.issues.map((issue) => {
      const field = issue.path.join('.')
      return `  - ${field}: ${issue.message}`
    })

    console.error(
      '\n[env] ============================================================\n' +
      '[env] FATAL: Required environment variables are missing or invalid.\n' +
      '[env] ============================================================\n' +
      '[env] Missing / invalid variables:\n' +
      missing.join('\n') +
      '\n[env]\n' +
      '[env] Copy .env.example to .env.local and fill in the values.\n' +
      '[env] ============================================================\n'
    )
  }
  throw err
}

export { env }

/**
 * Validated public environment variables (NEXT_PUBLIC_* only).
 * Safe to import in client components and shared code.
 */
export const publicEnv: PublicEnv = publicEnvSchema.parse(process.env)

export { serverEnvSchema, publicEnvSchema }
