// src/middleware.ts
// Middleware xác thực JWT và phân quyền
// Lấy permissions của user từ DB → đính vào header x-user-permissions
// middleware.ts là file middleware cho Next.js 16

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken,getHomeByRole } from '@/lib/auth-edge'
import { UserRole } from '@/types/database'
import { createServerClient } from '@supabase/ssr'
const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/admin': ['admin'],
  '/waiter': ['admin', 'waiter'],
  '/chef': ['admin', 'chef'],
  '/chat': ['admin', 'waiter', 'chef'],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Route public — không cần auth
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/test') ||
    pathname.startsWith('/api/print/queue') ||
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

  // Kiểm tra role có được vào route không
  for (const [route, allowedRoles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(route) && !allowedRoles.includes(session.role)) {
      return NextResponse.redirect(new URL(getHomeByRole(session.role), request.url))
    }
  }

  // Lấy permissions của user từ Supabase
  // Admin luôn có full quyền — không cần query DB
  let permissionCodes: string[] = []

  if (session.role !== 'admin') {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            getAll: () => [],
            setAll: () => {},
          },
        },
      )

      const { data } = await supabase
        .from('user_permissions')
        .select('permissions(code)')
        .eq('user_id', session.userId)

      permissionCodes = (data ?? []).map((p: any) => p.permissions?.code).filter(Boolean)
    } catch (err) {
      console.error('[Middleware] Failed to load permissions:', err)
    }
  }

  // Đính thông tin user + permissions vào header
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', String(session.userId))
  requestHeaders.set('x-user-role', session.role)
  requestHeaders.set('x-user-permissions', permissionCodes.join(','))

  return NextResponse.next({ request: { headers: requestHeaders } })
}



export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
