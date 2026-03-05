# Phase 13: Production Readiness — Research

## Current State Assessment

All 71 v3.0 requirements complete (Phases 8-12). The app is deployed and functional on Vercel + Supabase, but lacks production hardening.

## Gap Analysis by Area

### 1. Error Handling (Coverage: 40% — HIGH RISK)

**Exists:** All 15 API routes have try/catch. Agent dispatcher has comprehensive error handling with Turkish fallback messages. Token budget checks fail-open gracefully.

**Missing:**
- No error.tsx or not-found.tsx pages (zero React error boundaries)
- No structured error logging — only console.error/warn
- No request ID tracking for log correlation
- No retry logic on failed Telegram sends or API calls
- Inconsistent error response shapes across API routes

### 2. Environment Variables (Coverage: 30% — HIGH RISK)

**Exists:** NEXT_PUBLIC_ prefix correctly used. Service role key isolated to service-client.ts.

**Missing:**
- No env validation at startup — app silently breaks if vars missing
- .env.example only lists 2 vars, code uses 20+ (CRON_SECRET, ANTHROPIC_API_KEY, 15x TELEGRAM_BOT_TOKEN_*, etc.)
- No runtime validation when Telegram tokens are unconfigured

### 3. Security (Coverage: 60% — MEDIUM RISK)

**Exists:** RLS on all tables (25 policies). Auth middleware protects routes. JWT claim injection for multi-tenant. Telegram idempotency via UNIQUE constraint.

**Missing:**
- No rate limiting on any endpoint (agents vulnerable to abuse)
- No CORS headers configured
- No CSRF protection on forms
- No audit logging for sensitive data access
- No API key rotation mechanism

### 4. Monitoring & Logging (Coverage: 20% — HIGH RISK)

**Exists:** Prefixed console logs ([token-budget], [dispatcher], etc.). Token usage tracked to DB. Soft limit warnings logged.

**Missing:**
- No Sentry or error tracking service
- No health check endpoints (/health, /api/health)
- No centralized log aggregation (Vercel logs expire in 24-48h)
- No APM or response time monitoring
- No alerting on error spikes

### 5. Performance (Coverage: 50% — MEDIUM RISK)

**Exists:** next/image used. Agent prompt caching (ephemeral cache_control). Conversation compression (50-message rolling window). Service client singleton.

**Missing:**
- No bundle size analysis
- No database query optimization review
- No static content caching strategy
- No pagination on large dataset queries

### 6. Testing (Coverage: 0% — CRITICAL)

**Exists:** Zod validation schemas (53 safeParse instances).

**Missing:** Zero test files, no Jest/Vitest config, no E2E tests, no CI test pipeline.

### 7. CI/CD (Coverage: 30% — HIGH RISK)

**Exists:** Vercel auto-deploy on push. Cron config in vercel.json. ESLint config present.

**Missing:**
- No GitHub Actions workflows
- No pre-commit hooks
- No branch protection
- No staging environment
- No rollback strategy documented

### 8. Database (Coverage: 70% — MEDIUM RISK)

**Exists:** 11 migrations applied. RLS policies. Composite indexes. Cascading deletes.

**Missing:**
- No automated backup strategy (relying on Supabase defaults)
- No disaster recovery plan
- No schema documentation / ERD
- No data retention policy

### 9. Agent Infrastructure (Coverage: 80% — LOW-MEDIUM RISK)

**Exists:** Token budget enforcement (50K soft/100K hard). Prompt caching. Idempotency. 50-message rolling window with auto-summarization. Multi-role routing. Async dispatch via after().

**Missing:**
- No retry logic on failures
- No tool execution timeouts
- No agent performance metrics
- No conversation reset mechanism for dealers

### 10. TypeScript (Coverage: 40% — MEDIUM RISK)

**Exists:** strict: true in tsconfig.json. Auto-generated database types.

**Missing:** 432 instances of `any` type throughout codebase. Type casting instead of proper typing in many places.

## Recommended Scope for Phase 13

Based on risk and impact, these are the highest-value production readiness items:

### Must-Have (P0)
1. **Env validation** — Zod schema checking all required env vars at startup
2. **Error boundaries** — error.tsx + not-found.tsx for graceful UI failures
3. **Health check endpoint** — /api/health for uptime monitoring
4. **Rate limiting** — Middleware-level protection on API routes + Telegram webhooks
5. **Structured logging** — Request ID middleware + consistent log format
6. **GitHub Actions CI** — Lint + type-check + build on every push

### Should-Have (P1)
7. **Error tracking** — Sentry integration for runtime errors
8. **Complete .env.example** — Document all 20+ env vars
9. **API response standardization** — Consistent error/success response format
10. **Database backup verification** — Confirm Supabase PITR is enabled, document recovery

### Nice-to-Have (P2)
11. **Basic test suite** — Vitest config + critical path tests (auth, orders)
12. **Agent retry logic** — Exponential backoff on Telegram send failures
13. **Performance audit** — Lighthouse CI + bundle analysis

## Technology Recommendations

### Rate Limiting
- **@upstash/ratelimit** with Vercel KV — serverless-native, no infrastructure
- Alternative: In-memory Map with sliding window (simpler, resets on cold start)
- Recommended: Upstash for production, in-memory for MVP

### Error Tracking
- **Sentry** — @sentry/nextjs has official Next.js integration
- Free tier: 5K errors/month (sufficient for this scale)

### Logging
- Request ID via crypto.randomUUID() in middleware
- Structured JSON logs for Vercel log drains

### CI/CD
- GitHub Actions with: lint → tsc → build pipeline
- ~2 min total for this project size

### Testing
- Vitest (faster than Jest for Next.js projects)
- @testing-library/react for component tests
- Playwright for E2E (if time permits)

## Implementation Notes

- Vercel Edge middleware supports rate limiting natively
- Supabase has built-in Point-in-Time Recovery on Pro plan
- Next.js 16 has built-in error boundary support via error.tsx convention
- All changes should be backward-compatible with existing deployment
