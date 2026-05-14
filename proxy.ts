// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const getProtectedRoutes = () => {
  if (process.env.PROTECTED_ROUTES) {
    return process.env.PROTECTED_ROUTES.split(',').map(s => s.trim()).filter(Boolean)
  }
  return [
    '/dashboard',
    '/profile',
    '/rides/new',
    '/bookings',
  ]
}

export function proxy(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value || request.cookies.get('refresh_token')?.value
  const { pathname } = request.nextUrl

  const routes = getProtectedRoutes()
  const isProtected = routes.some(route =>
    pathname.startsWith(route)
  )

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/profile/:path*',
    '/rides/new',
    '/bookings/:path*',
  ],
}