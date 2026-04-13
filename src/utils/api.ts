// src/utils/api.ts
// Helper functions dùng trong API routes

import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@/types/database'
import { ApiResponse } from '@/utils/api-response'
import { getUserFromRequest } from '@/utils/api-auth'
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

/**
 * requireRole — kiểm tra role trong API route (dùng cho các route chỉ cần role)
 * Trả về { user, error }
 */
export function requireRole(request: NextRequest, roles: UserRole[]) {
  const user = getUserFromRequest(request)
  if (!user) return { user: null, error: ApiResponse.unauthorized() }
  if (!roles.includes(user.role)) return { user, error: ApiResponse.forbidden() }
  return { user, error: null }
}
