type RateLimitConfig = {
  windowMs: number    // Time window in milliseconds
  maxRequests: number // Max requests per window
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

class RateLimiter {
  private store: Map<string, RateLimitEntry>
  private lastCleanup: number

  constructor(private config: RateLimitConfig) {
    this.store = new Map()
    this.lastCleanup = Date.now()
  }

  check(key: string): RateLimitResult {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || now > entry.resetAt) {
      // New window
      const resetAt = now + this.config.windowMs
      this.store.set(key, { count: 1, resetAt })
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetAt,
      }
    }

    // Within existing window
    entry.count++
    const allowed = entry.count <= this.config.maxRequests
    const remaining = Math.max(0, this.config.maxRequests - entry.count)

    return {
      allowed,
      remaining,
      resetAt: entry.resetAt,
    }
  }

  cleanup(): void {
    const now = Date.now()
    // Run cleanup at most every 60 seconds
    if (now - this.lastCleanup < 60_000) return

    this.lastCleanup = now
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key)
      }
    }
  }
}

// Pre-configured instances (module-level — survives across requests within same serverless instance)
export const apiLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 60 })
export const telegramLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 30 })
export const cronLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 5 })

export { RateLimiter }
export type { RateLimitConfig, RateLimitResult }
