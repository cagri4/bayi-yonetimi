/**
 * Tests for env validation schema.
 *
 * Strategy: We test `serverEnvSchema` directly by importing it with the
 * required env vars already set via vi.stubEnv. This avoids the module-level
 * parse from failing in the test environment.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// Minimum valid env for module-level parse to succeed
const VALID_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  ANTHROPIC_API_KEY: 'sk-test-key',
  CRON_SECRET: 'test-cron-secret',
}

let serverEnvSchema: (typeof import('../env'))['serverEnvSchema']

beforeAll(async () => {
  // Stub env vars so the module-level parse succeeds on import
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', VALID_ENV.NEXT_PUBLIC_SUPABASE_URL)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', VALID_ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', VALID_ENV.SUPABASE_SERVICE_ROLE_KEY)
  vi.stubEnv('ANTHROPIC_API_KEY', VALID_ENV.ANTHROPIC_API_KEY)
  vi.stubEnv('CRON_SECRET', VALID_ENV.CRON_SECRET)

  const mod = await import('../env')
  serverEnvSchema = mod.serverEnvSchema
})

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('serverEnvSchema', () => {
  it('passes validation with all required fields', () => {
    const result = serverEnvSchema.safeParse(VALID_ENV)
    expect(result.success).toBe(true)
  })

  it('fails when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _omitted, ...rest } = VALID_ENV
    const result = serverEnvSchema.safeParse(rest)
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0])
      expect(fields).toContain('SUPABASE_SERVICE_ROLE_KEY')
    }
  })

  it('fails when ANTHROPIC_API_KEY is missing', () => {
    const { ANTHROPIC_API_KEY: _omitted, ...rest } = VALID_ENV
    const result = serverEnvSchema.safeParse(rest)
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0])
      expect(fields).toContain('ANTHROPIC_API_KEY')
    }
  })

  it('fails when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    const { NEXT_PUBLIC_SUPABASE_URL: _omitted, ...rest } = VALID_ENV
    const result = serverEnvSchema.safeParse(rest)
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0])
      expect(fields).toContain('NEXT_PUBLIC_SUPABASE_URL')
    }
  })

  it('fails when NEXT_PUBLIC_SUPABASE_URL is not a valid URL', () => {
    const result = serverEnvSchema.safeParse({
      ...VALID_ENV,
      NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0])
      expect(fields).toContain('NEXT_PUBLIC_SUPABASE_URL')
    }
  })

  it('passes when optional TELEGRAM_BOT_TOKEN is omitted', () => {
    const result = serverEnvSchema.safeParse(VALID_ENV)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.TELEGRAM_BOT_TOKEN).toBeUndefined()
      expect(result.data.TELEGRAM_BOT_TOKEN_EGITIMCI).toBeUndefined()
    }
  })

  it('passes when optional TELEGRAM_BOT_TOKEN is provided', () => {
    const result = serverEnvSchema.safeParse({
      ...VALID_ENV,
      TELEGRAM_BOT_TOKEN: 'bot123:token',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.TELEGRAM_BOT_TOKEN).toBe('bot123:token')
    }
  })

  it('passes when ANTHROPIC_API_KEY starts with sk-', () => {
    const result = serverEnvSchema.safeParse({
      ...VALID_ENV,
      ANTHROPIC_API_KEY: 'sk-ant-api03-validkey',
    })
    expect(result.success).toBe(true)
  })

  it('fails when ANTHROPIC_API_KEY is empty string', () => {
    const result = serverEnvSchema.safeParse({
      ...VALID_ENV,
      ANTHROPIC_API_KEY: '',
    })
    expect(result.success).toBe(false)
  })
})
