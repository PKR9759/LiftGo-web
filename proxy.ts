// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const protectedRoutes = [
  '/dashboard',
  '/profile',
  '/rides/new',
  '/seeks/new',
  '/bookings',
]

export function proxy(request: NextRequest) {
  const token = request.cookies.get('liftgo_token')?.value
  const { pathname } = request.nextUrl

  const isProtected = protectedRoutes.some(route =>
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
    '/seeks/new',
    '/bookings/:path*',
  ],
}