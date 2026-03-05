/**
 * Health Check Endpoint — GET /api/health
 *
 * Public endpoint (no auth required — middleware excludes /api/ routes).
 * Used by uptime monitoring services (Uptime Robot, Better Uptime, etc.).
 *
 * Checks:
 * 1. Database connectivity — SELECT 1 via service client
 * 2. Env validation — verifies all required env vars are present
 *
 * Response: 200 (healthy) or 503 (degraded)
 * Cache-Control: no-store (always fresh)
 */
import { createServiceClient } from '@/lib/supabase/service-client'

export const dynamic = 'force-dynamic'

interface CheckResult {
  status: 'ok' | 'error'
  latency_ms?: number
  missing?: string[]
  error?: string
}

interface HealthResponse {
  status: 'healthy' | 'degraded'
  timestamp: string
  version: string
  checks: {
    database: CheckResult
    env: CheckResult
  }
}

export async function GET(): Promise<Response> {
  const timestamp = new Date().toISOString()
  const version = '1.0.0'

  let overallStatus: 'healthy' | 'degraded' = 'healthy'

  // ── Check 1: Database connectivity ─────────────────────────────────────────
  let dbCheck: CheckResult

  try {
    const supabase = createServiceClient()
    const start = performance.now()

    const { error } = await supabase
      .from('companies')
      .select('id')
      .limit(1)

    const latency = Math.round(performance.now() - start)

    if (error) {
      dbCheck = { status: 'error', latency_ms: latency, error: error.message }
      overallStatus = 'degraded'
    } else {
      dbCheck = { status: 'ok', latency_ms: latency }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    dbCheck = { status: 'error', error: message }
    overallStatus = 'degraded'
  }

  // ── Check 2: Env validation ─────────────────────────────────────────────────
  // Dynamic import avoids crashing the route if env vars are missing —
  // we want to REPORT the problem, not propagate the throw.
  let envCheck: CheckResult

  try {
    // Validate required env vars without importing the throwing env module
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'ANTHROPIC_API_KEY',
      'CRON_SECRET',
    ]

    const missing = requiredVars.filter((varName) => !process.env[varName])

    if (missing.length > 0) {
      envCheck = { status: 'error', missing }
      overallStatus = 'degraded'
    } else {
      envCheck = { status: 'ok', missing: [] }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    envCheck = { status: 'error', error: message }
    overallStatus = 'degraded'
  }

  // ── Build response ──────────────────────────────────────────────────────────

  const body: HealthResponse = {
    status: overallStatus,
    timestamp,
    version,
    checks: {
      database: dbCheck,
      env: envCheck,
    },
  }

  const httpStatus = overallStatus === 'healthy' ? 200 : 503

  return new Response(JSON.stringify(body), {
    status: httpStatus,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}
