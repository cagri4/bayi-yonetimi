import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request)

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/forgot-password', '/reset-password']
  const isPublicPath = publicPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  // If not authenticated and trying to access protected route
  if (!user && !isPublicPath && request.nextUrl.pathname !== '/') {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
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
    return NextResponse.redirect(new URL(redirectUrl, request.url))
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
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    } else {
      return NextResponse.redirect(new URL('/login', request.url))
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
      return NextResponse.redirect(new URL('/catalog', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
