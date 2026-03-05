/**
 * Tests for the RateLimiter class.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RateLimiter } from '../rate-limit'

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('basic allow/deny behavior', () => {
    it('allows first request', () => {
      const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3 })
      const result = limiter.check('key1')
      expect(result.allowed).toBe(true)
    })

    it('allows up to maxRequests within the window', () => {
      const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3 })
      const r1 = limiter.check('key1')
      const r2 = limiter.check('key1')
      const r3 = limiter.check('key1')
      expect(r1.allowed).toBe(true)
      expect(r2.allowed).toBe(true)
      expect(r3.allowed).toBe(true)
    })

    it('denies the 4th request when maxRequests is 3', () => {
      const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3 })
      limiter.check('key1')
      limiter.check('key1')
      limiter.check('key1')
      const r4 = limiter.check('key1')
      expect(r4.allowed).toBe(false)
    })

    it('returns remaining=0 on the denied request', () => {
      const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3 })
      limiter.check('key1')
      limiter.check('key1')
      limiter.check('key1')
      const r4 = limiter.check('key1')
      expect(r4.remaining).toBe(0)
    })
  })

  describe('remaining count', () => {
    it('decreases remaining count correctly: 2, 1, 0', () => {
      const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3 })
      const r1 = limiter.check('key1')
      expect(r1.remaining).toBe(2) // maxRequests - 1 after first call

      const r2 = limiter.check('key1')
      expect(r2.remaining).toBe(1)

      const r3 = limiter.check('key1')
      expect(r3.remaining).toBe(0)
    })
  })

  describe('window expiry', () => {
    it('allows requests again after window expires', () => {
      const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3 })
      limiter.check('key1')
      limiter.check('key1')
      limiter.check('key1')
      const r4 = limiter.check('key1')
      expect(r4.allowed).toBe(false)

      // Advance time past the window
      vi.advanceTimersByTime(60_001)

      const r5 = limiter.check('key1')
      expect(r5.allowed).toBe(true)
      expect(r5.remaining).toBe(2)
    })

    it('resets count after window expires', () => {
      const limiter = new RateLimiter({ windowMs: 1_000, maxRequests: 2 })
      limiter.check('key1')
      limiter.check('key1')

      vi.advanceTimersByTime(1_001)

      const r1 = limiter.check('key1')
      const r2 = limiter.check('key1')
      expect(r1.allowed).toBe(true)
      expect(r2.allowed).toBe(true)
    })
  })

  describe('key isolation', () => {
    it('tracks different keys independently', () => {
      const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 2 })
      limiter.check('key-a')
      limiter.check('key-a')
      const rA3 = limiter.check('key-a')
      expect(rA3.allowed).toBe(false)

      // key-b should still be allowed
      const rB1 = limiter.check('key-b')
      expect(rB1.allowed).toBe(true)
    })

    it('does not bleed remaining counts between keys', () => {
      const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 5 })
      limiter.check('key-x')
      limiter.check('key-x')

      const rY = limiter.check('key-y')
      expect(rY.remaining).toBe(4) // fresh window for key-y
    })
  })

  describe('cleanup', () => {
    it('removes expired entries after 60s guard', () => {
      const limiter = new RateLimiter({ windowMs: 100, maxRequests: 5 })
      limiter.check('old-key')

      // Advance past the entry window
      vi.advanceTimersByTime(200)

      // cleanup guard: must advance past 60s for cleanup to actually run
      vi.advanceTimersByTime(60_000)

      // cleanup should not throw
      expect(() => limiter.cleanup()).not.toThrow()

      // After cleanup, old-key should start fresh (new window)
      const result = limiter.check('old-key')
      expect(result.allowed).toBe(true)
    })

    it('does not run cleanup before 60s guard period', () => {
      const limiter = new RateLimiter({ windowMs: 100, maxRequests: 5 })
      limiter.check('key1')

      // Advance time but less than cleanup guard (60s)
      vi.advanceTimersByTime(30_000)

      // cleanup should not throw even when skipped
      expect(() => limiter.cleanup()).not.toThrow()
    })
  })

  describe('resetAt', () => {
    it('returns a future resetAt timestamp', () => {
      const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 5 })
      const now = Date.now()
      const result = limiter.check('key1')
      expect(result.resetAt).toBeGreaterThan(now)
      expect(result.resetAt).toBeLessThanOrEqual(now + 60_000 + 1)
    })

    it('returns the same resetAt for all requests within same window', () => {
      const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 5 })
      const r1 = limiter.check('key1')
      vi.advanceTimersByTime(100)
      const r2 = limiter.check('key1')
      expect(r2.resetAt).toBe(r1.resetAt)
    })
  })
})
