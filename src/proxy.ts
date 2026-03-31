// src/proxy.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-edge'
import { UserRole } from '@/types/database'

const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/admin':  ['admin'],
  '/waiter': ['admin', 'waiter'],
  '/chef':   ['admin', 'chef'],
  '/chat':   ['admin', 'waiter', 'chef'],
}

// ✅ Next.js 16: phải đặt tên là "proxy" thay vì "middleware"
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Route public — không cần auth
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/test') ||
     pathname.startsWith('/api/test') || 
     pathname.startsWith('/api/print/queue')||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get('pos_session')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const session = await verifyToken(token)
  if (!session) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('pos_session')
    return response
  }

  for (const [route, allowedRoles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(route) && !allowedRoles.includes(session.role)) {
      return NextResponse.redirect(new URL(getHomeByRole(session.role), request.url))
    }
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id',   String(session.userId))
  requestHeaders.set('x-user-role', session.role)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export function getHomeByRole(role: UserRole): string {
  switch (role) {
    case 'admin':  return '/admin/reports'
    case 'waiter': return '/waiter/tables'
    case 'chef':   return '/chef/kitchen'
    default:       return '/login'
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}