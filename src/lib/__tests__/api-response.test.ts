/**
 * Tests for API response helper functions.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiUnauthorized,
  apiNotFound,
  apiRateLimited,
} from '../api-response'

// Helper to parse NextResponse body
async function parseBody(response: Response): Promise<unknown> {
  return response.json()
}

describe('apiSuccess', () => {
  it('returns 200 status by default', async () => {
    const res = apiSuccess({ id: 1 })
    expect(res.status).toBe(200)
  })

  it('returns correct body shape with data', async () => {
    const res = apiSuccess({ id: 1 })
    const body = await parseBody(res) as { success: boolean; data: unknown; timestamp: string }
    expect(body.success).toBe(true)
    expect(body.data).toEqual({ id: 1 })
    expect(typeof body.timestamp).toBe('string')
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp)
  })

  it('returns custom status code', async () => {
    const res = apiSuccess({ created: true }, 201)
    expect(res.status).toBe(201)
  })

  it('includes timestamp as valid ISO string', async () => {
    const before = new Date().toISOString()
    const res = apiSuccess(null)
    const after = new Date().toISOString()
    const body = await parseBody(res) as { timestamp: string }
    expect(body.timestamp >= before).toBe(true)
    expect(body.timestamp <= after).toBe(true)
  })
})

describe('apiError', () => {
  it('returns correct error body shape', async () => {
    const res = apiError('Bad request', 400)
    const body = await parseBody(res) as { success: boolean; error: { message: string; code?: string }; timestamp: string }
    expect(body.success).toBe(false)
    expect(body.error.message).toBe('Bad request')
    expect(typeof body.timestamp).toBe('string')
  })

  it('returns specified status code', async () => {
    const res = apiError('Something wrong', 400)
    expect(res.status).toBe(400)
  })

  it('includes error code when provided', async () => {
    const res = apiError('Not found', 404, 'NOT_FOUND')
    const body = await parseBody(res) as { error: { code?: string } }
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('defaults to status 500', async () => {
    const res = apiError('Server error')
    expect(res.status).toBe(500)
  })
})

describe('apiBadRequest', () => {
  it('returns 400 status', async () => {
    const res = apiBadRequest('Invalid input')
    expect(res.status).toBe(400)
  })

  it('includes BAD_REQUEST code', async () => {
    const res = apiBadRequest('x')
    const body = await parseBody(res) as { error: { code: string; message: string }; success: boolean }
    expect(body.error.code).toBe('BAD_REQUEST')
    expect(body.error.message).toBe('x')
    expect(body.success).toBe(false)
  })
})

describe('apiUnauthorized', () => {
  it('returns 401 status', async () => {
    const res = apiUnauthorized()
    expect(res.status).toBe(401)
  })

  it('includes UNAUTHORIZED code', async () => {
    const res = apiUnauthorized()
    const body = await parseBody(res) as { error: { code: string } }
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('uses default message when none provided', async () => {
    const res = apiUnauthorized()
    const body = await parseBody(res) as { error: { message: string } }
    expect(body.error.message).toBe('Unauthorized')
  })

  it('uses custom message when provided', async () => {
    const res = apiUnauthorized('Token expired')
    const body = await parseBody(res) as { error: { message: string } }
    expect(body.error.message).toBe('Token expired')
  })
})

describe('apiNotFound', () => {
  it('returns 404 status', async () => {
    const res = apiNotFound()
    expect(res.status).toBe(404)
  })

  it('includes NOT_FOUND code', async () => {
    const res = apiNotFound()
    const body = await parseBody(res) as { error: { code: string } }
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('uses default message when none provided', async () => {
    const res = apiNotFound()
    const body = await parseBody(res) as { error: { message: string } }
    expect(body.error.message).toBe('Not found')
  })
})

describe('apiRateLimited', () => {
  it('returns 429 status', async () => {
    const res = apiRateLimited()
    expect(res.status).toBe(429)
  })

  it('includes RATE_LIMITED code', async () => {
    const res = apiRateLimited()
    const body = await parseBody(res) as { error: { code: string } }
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('uses default message when none provided', async () => {
    const res = apiRateLimited()
    const body = await parseBody(res) as { error: { message: string } }
    expect(body.error.message).toBe('Too many requests')
  })
})
