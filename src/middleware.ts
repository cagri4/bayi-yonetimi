import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { apiLimiter, telegramLimiter, cronLimiter } from '@/lib/rate-limit'

export async function middleware(request: NextRequest) {
  // Generate unique request ID for every request
  const requestId = crypto.randomUUID()

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/forgot-password', '/reset-password', '/api/']
  const isPublicPath = publicPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Rate limiting for /api/ routes (runs before auth checks)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown'

    const pathname = request.nextUrl.pathname
    let result: { allowed: boolean; remaining: number; resetAt: number }

    if (pathname.startsWith('/api/telegram/')) {
      telegramLimiter.cleanup()
      result = telegramLimiter.check(ip)
    } else if (pathname.startsWith('/api/cron/')) {
      cronLimiter.cleanup()
      result = cronLimiter.check(ip)
    } else {
      apiLimiter.cleanup()
      result = apiLimiter.check(ip)
    }

    if (!result.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Too many requests',
            code: 'RATE_LIMITED',
          },
        },
        {
          status: 429,
          headers: {
            'x-request-id': requestId,
            'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }

    // Allowed: proceed (rate limit remaining header added to supabaseResponse below)
    const { supabaseResponse } = await updateSession(request)
    supabaseResponse.headers.set('x-request-id', requestId)
    supabaseResponse.headers.set('X-RateLimit-Remaining', String(result.remaining))
    return supabaseResponse
  }

  const { supabaseResponse, user, supabase } = await updateSession(request)

  // If not authenticated and trying to access protected route
  if (!user && !isPublicPath && request.nextUrl.pathname !== '/') {
    const loginUrl = new URL('/login', request.url)
    const redirectResponse = NextResponse.redirect(loginUrl)
    redirectResponse.headers.set('x-request-id', requestId)
    return redirectResponse
  }

  // If authenticated and trying to access auth pages
  if (user && isPublicPath) {
    // Get user role to determine redirect
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const redirectUrl = profile?.role === 'admin' ? '/admin' : '/catalog'
    const redirectResponse = NextResponse.redirect(new URL(redirectUrl, request.url))
    redirectResponse.headers.set('x-request-id', requestId)
    return redirectResponse
  }

  // Handle root path
  if (request.nextUrl.pathname === '/') {
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      const redirectUrl = profile?.role === 'admin' ? '/admin' : '/catalog'
      const redirectResponse = NextResponse.redirect(new URL(redirectUrl, request.url))
      redirectResponse.headers.set('x-request-id', requestId)
      return redirectResponse
    } else {
      const redirectResponse = NextResponse.redirect(new URL('/login', request.url))
      redirectResponse.headers.set('x-request-id', requestId)
      return redirectResponse
    }
  }

  // Admin route protection
  if (request.nextUrl.pathname.startsWith('/admin') && user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      const redirectResponse = NextResponse.redirect(new URL('/catalog', request.url))
      redirectResponse.headers.set('x-request-id', requestId)
      return redirectResponse
    }
  }

  supabaseResponse.headers.set('x-request-id', requestId)
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
