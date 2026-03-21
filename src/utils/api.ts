// src/utils/api.ts
// Helper functions dùng trong API routes
// Cung cấp: getUserFromRequest, requireRole, assert, ApiResponse

import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@/types/database'

// Lỗi validation tự định nghĩa — phân biệt với lỗi hệ thống khi dùng trong handle()
export class ValidationError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ValidationError'
    this.status = status
  }
}

/**
 * assert — throw ValidationError nếu điều kiện không thỏa
 * Tách ra ngoài ApiResponse vì TypeScript không cho 'asserts' trong object literal (ts2775)
 * Dùng: assert(name?.trim(), 'Tên không được trống')
 */
export function assert(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new ValidationError(message, status)
}

// Lấy user từ header (proxy.ts đã đính kèm x-user-id và x-user-role)
export function getUserFromRequest(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  const role   = request.headers.get('x-user-role') as UserRole | null
  if (!userId || !role) return null
  return { userId: parseInt(userId), role }
}

// Kiểm tra role trong API route — trả về { user, error }
export function requireRole(request: NextRequest, roles: UserRole[]) {
  const user = getUserFromRequest(request)
  if (!user) return { user: null, error: ApiResponse.unauthorized() }
  if (!roles.includes(user.role)) return { user, error: ApiResponse.forbidden() }
  return { user, error: null }
}

export const ApiResponse = {
  // Trả về response thành công với data
  success: <T>(data: T, status = 200) =>
    NextResponse.json({ success: true, data }, { status }),

  // Trả về response lỗi với message
  error: (message: string, status = 400) =>
    NextResponse.json({ success: false, error: message }, { status }),

  // 401 — chưa đăng nhập
  unauthorized: () =>
    NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 401 }),

  // 403 — không đủ quyền
  forbidden: () =>
    NextResponse.json({ success: false, error: 'Không đủ quyền thực hiện' }, { status: 403 }),

  // 404 — không tìm thấy
  notFound: (resource = 'Dữ liệu') =>
    NextResponse.json({ success: false, error: `${resource} không tồn tại` }, { status: 404 }),

  /**
   * handle — xử lý lỗi trong catch block
   * ValidationError  → 400 với message từ assert()
   * Lỗi Supabase     → xử lý theo error code
   * Lỗi khác         → 500
   */
  handle(err: unknown) {
    if (err instanceof ValidationError)
      return NextResponse.json({ success: false, error: err.message }, { status: err.status })

    if (err && typeof err === 'object' && 'code' in err) {
      const e = err as { code: string; message?: string }
      switch (e.code) {
        case '23505':    return ApiResponse.error('Dữ liệu đã tồn tại')
        case 'PGRST116': return ApiResponse.notFound()
      }
    }

    console.error('🔥 API Error:', err)
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống không xác định'
    return ApiResponse.error(message, 500)
  },
}