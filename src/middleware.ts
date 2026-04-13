// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-edge'
import { UserRole } from '@/types/database'
import { createServerClient } from '@supabase/ssr'

// Cấu hình phân quyền cho các trang giao diện (UI)
const ROUTE_PERMISSIONS: Record<string, { roles: UserRole[]; permission?: string }> = {
  '/admin/menu': { roles: ['admin'], permission: 'menu.read' },
  '/admin': { roles: ['admin'] },
  '/waiter': { roles: ['admin', 'waiter'] },
  '/chef': { roles: ['admin', 'chef'] },
  '/chat': { roles: ['admin', 'waiter', 'chef'] },
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Loại bỏ các Route Public (không cần kiểm tra)
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/test') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // 2. Kiểm tra Session (Token)
  const token = request.cookies.get('pos_session')?.value
  if (!token) {
    // Nếu là API mà không có token -> trả về 401 thay vì redirect
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const session = await verifyToken(token)
  if (!session) {
    const response = pathname.startsWith('/api')
      ? NextResponse.json({ success: false, error: 'Invalid Session' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url))

    response.cookies.delete('pos_session')
    return response
  }

  // 3. Lấy danh sách Permissions từ Supabase (nếu không phải Admin)
  let permissionCodes: string[] = []
  if (session.role !== 'admin') {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!, // Sử dụng Service Role để bypass RLS ở middleware
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
      console.error('[Middleware] Permission fetch error:', err)
    }
  }

  // 4. CHỈ KIỂM TRA ROUTE PERMISSION CHO UI (KHÔNG PHẢI /API)
  // Việc này giúp tránh lỗi 403 khi frontend gọi API mà chưa có token hoặc permission (ví dụ khi refresh trang)
  if (!pathname.startsWith('/api')) {
    for (const [route, config] of Object.entries(ROUTE_PERMISSIONS)) {
      if (pathname.startsWith(route)) {
        const hasValidRole = config.roles.includes(session.role)
        const hasValidPermission = config.permission
          ? permissionCodes.includes(config.permission)
          : true

        if (!hasValidRole && !hasValidPermission) {
          // Rewrite sang trang 403 (URL trên trình duyệt vẫn giữ nguyên)
          const url = request.nextUrl.clone()
          url.pathname = '/403'
          return NextResponse.rewrite(url)
        }
        break // Đã khớp route thì không cần check các route khác trong vòng lặp
      }
    }
  }

  // 5. Đính thông tin vào Header để các Route API sử dụng
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', String(session.userId))
  requestHeaders.set('x-user-role', session.role)
  requestHeaders.set('x-user-permissions', permissionCodes.join(','))

  // Tiếp tục hành trình request với header mới
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

// Chỉ chạy middleware cho các route cần thiết (loại trừ static files)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
