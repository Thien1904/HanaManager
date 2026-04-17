// src/app/api/permissions/route.ts
// Quản lý phân quyền user
// GET: lấy tất cả permissions + permissions của user
// PUT: cập nhật permissions cho user

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, assert } from '@/utils/api'
import { ApiResponse } from '@/utils/api-response' // Chuẩn hóa response API

/**
 * GET /api/permissions?user_id=1
 * Lấy toàn bộ danh sách permissions và permissions hiện tại của user
 * Chỉ admin
 */
export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    const supabase = createAdminClient()

    // Lấy tất cả permissions nhóm theo grp
    const { data: allPerms, error: permsError } = await supabase
      .from('permissions')
      .select('id, code, name, group_name, created_at')
      .order('group_name')
      .order('name')

    if (permsError) throw permsError

    // Nếu có user_id → lấy thêm permissions của user đó
    let userPermIds: number[] = []
    if (userId) {
      const { data: userPerms } = await supabase
        .from('user_permissions')
        .select('permission_id')
        .eq('user_id', Number(userId))

      userPermIds = (userPerms ?? []).map((p) => p.permission_id)
    }

    return ApiResponse.success({
      permissions: allPerms ?? [],
      userPermissionIds: userPermIds,
    })
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * PUT /api/permissions — Cập nhật permissions cho user
 * Body: { user_id, permission_ids: number[] }
 * Chỉ admin
 */
export async function PUT(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { user_id, permission_ids } = await request.json()

    assert(user_id, 'Thiếu user_id')
    assert(Array.isArray(permission_ids), 'permission_ids phải là mảng')

    const supabase = createAdminClient()

    // Xóa hết permissions cũ của user
    await supabase.from('user_permissions').delete().eq('user_id', Number(user_id))

    // Insert permissions mới
    if (permission_ids.length > 0) {
      const { error: insertError } = await supabase.from('user_permissions').insert(
        permission_ids.map((pid: number) => ({
          user_id: Number(user_id),
          permission_id: pid,
        })),
      )
      if (insertError) throw insertError
    }

    return ApiResponse.success({ user_id: Number(user_id), count: permission_ids.length })
  } catch (err) {
    return ApiResponse.handle(err)
  }
}
