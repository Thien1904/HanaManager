// src/lib/api.ts
// Helper functions dùng trong API routes

import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@/types/database'
import { ApiResponse } from '@/utils/api-response'

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

//LẤY THÔNG TIN USER TỪ HEADER DO MIDDLEWARE ĐÍNH VÀO
export function getUserFromRequest(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  const role = request.headers.get('x-user-role') as UserRole | null
  const permissions = request.headers.get('x-user-permissions') ?? ''

  if (!userId || !role) return null
  return {
    userId: parseInt(userId),
    role,
    // Admin luôn có full quyền — permissions header có thể rỗng với admin
    permissions: permissions ? permissions.split(',') : [],
  }
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
/**
 * requireAnyPermission — pass nếu có ít nhất 1 trong các permission
 * Dùng: requireAnyPermission(request, ['orders.read', 'orders.create'])
 */
export function requireAnyPermission(request: NextRequest, permissions: string[]) {
  const user = getUserFromRequest(request)
  if (!user) return { user: null, error: ApiResponse.unauthorized() }

  if (user.role === 'admin') return { user, error: null }

  const hasAny = permissions.some((p) => user.permissions.includes(p))
  if (!hasAny) return { user, error: ApiResponse.forbidden() }
  return { user, error: null }
}

const API_BASE = '/api/v1'

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  const json = await res.json()

  if (!res.ok) {
    throw new Error(json.error || 'API error')
  }

  return json
}
