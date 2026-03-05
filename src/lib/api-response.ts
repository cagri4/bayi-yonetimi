import { NextResponse } from 'next/server'

type ApiSuccessResponse<T> = {
  success: true
  data: T
  timestamp: string
}

type ApiErrorResponse = {
  success: false
  error: {
    message: string
    code?: string
  }
  timestamp: string
}

export function apiSuccess<T>(
  data: T,
  status = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true as const,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  )
}

export function apiError(
  message: string,
  status = 500,
  code?: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false as const,
      error: { message, code },
      timestamp: new Date().toISOString(),
    },
    { status }
  )
}

export function apiBadRequest(message: string): NextResponse<ApiErrorResponse> {
  return apiError(message, 400, 'BAD_REQUEST')
}

export function apiUnauthorized(
  message?: string
): NextResponse<ApiErrorResponse> {
  return apiError(message ?? 'Unauthorized', 401, 'UNAUTHORIZED')
}

export function apiNotFound(message?: string): NextResponse<ApiErrorResponse> {
  return apiError(message ?? 'Not found', 404, 'NOT_FOUND')
}

export function apiRateLimited(
  message?: string
): NextResponse<ApiErrorResponse> {
  return apiError(message ?? 'Too many requests', 429, 'RATE_LIMITED')
}
