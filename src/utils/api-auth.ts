/**
 * src/utils/api-auth.ts
 * Tập hợp các tiện ích xử lý định danh và phân quyền trên Server-side
 */

import { NextRequest } from 'next/server'
import { ApiResponse } from './api-response'
import { UserRole } from '@/types/database'

/**
 * Trích xuất và định dạng thông tin User từ Header
 */
export function getUserFromRequest(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  const role = request.headers.get('x-user-role') as UserRole | null
  const permissions = request.headers.get('x-user-permissions') ?? ''

  if (!userId || !role) return null

  return {
    userId: parseInt(userId),
    role,
    permissions: permissions ? permissions.split(',').map((p) => p.trim()) : [],
  }
}

/**
 * Kiểm tra quyền hạn cụ thể (Sử dụng cho Create, Update, Delete...)
 */
export function requirePermission(request: NextRequest, permissionCode: string) {
  const user = getUserFromRequest(request)
  if (!user) {
    return { user: null, error: ApiResponse.unauthorized() }
  }

  // Admin bypass
  if (user.role === 'admin') {
    return { user, error: null }
  }

  if (!user.permissions.includes(permissionCode)) {
    return {
      user,
      error: ApiResponse.forbidden(`Yêu cầu quyền: ${permissionCode}`),
    }
  }

  return { user, error: null }
}

/**
 * requireAnyPermission — pass nếu có ít nhất 1 trong các permission
 * Dùng: requireAnyPermission(request, ['orders.read', 'orders.create'])
 */
export function requireAnyPermission(request: NextRequest, permissionCodes: string[]) {
  const user = getUserFromRequest(request)
  if (!user) return { user: null, error: ApiResponse.unauthorized() }
  if (user.role === 'admin') return { user, error: null }

  // THÊM LOG ĐỂ SOI
  console.log('--- SO SÁNH QUYỀN ---')
  console.log('Quyền yêu cầu:', permissionCodes)
  console.log('Quyền User có:', user.permissions)

  // Kiểm tra từng quyền một cách tường minh
  const hasAccess = permissionCodes.some((code) => {
    const match = user.permissions.includes(code)
    console.log(`Kiểm tra "${code}": ${match ? 'KHỚP' : 'KHÔNG KHỚP'}`)
    return match
  })

  if (!hasAccess) {
    return { user, error: ApiResponse.forbidden(`Thiếu quyền: ${permissionCodes.join(', ')}`) }
  }

  return { user, error: null }
}
