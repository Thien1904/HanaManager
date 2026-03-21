// src/app/api/categories/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ApiResponse, requireRole } from '@/utils/api'

// GET /api/categories — Lấy danh sách danh mục
export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin', 'waiter', 'chef'])
  if (error) return error

  const supabase = createAdminClient()

  const { data, error: dbError } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')

  if (dbError) return ApiResponse.error('Không thể tải danh mục', 500)

  return ApiResponse.success(data)
}

// POST /api/categories — Thêm danh mục mới
export async function POST(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  const body = await request.json()
  const name = body.name?.trim()

  if (!name) return ApiResponse.error('Tên danh mục không được trống')

  const supabase = createAdminClient()

  const { data, error: dbError } = await supabase
    .from('categories')
    .insert({ name })
    .select('id, name')
    .single()

  if (dbError) {
    if (dbError.code === '23505') return ApiResponse.error('Tên danh mục đã tồn tại')
    return ApiResponse.error('Không thể thêm danh mục', 500)
  }

  return ApiResponse.success(data, 201)
}

// PUT /api/categories — Đổi tên danh mục
export async function PUT(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  const body = await request.json()
  const name = body.name?.trim()

  if (!body.id) return ApiResponse.error('Thiếu id')
  if (!name) return ApiResponse.error('Tên danh mục không được trống')

  const supabase = createAdminClient()

  const { data, error: dbError } = await supabase
    .from('categories')
    .update({ name })
    .eq('id', Number(body.id))
    .select('id, name')
    .single()

  if (dbError) {
    if (dbError.code === '23505') return ApiResponse.error('Tên danh mục đã tồn tại')
    return ApiResponse.error('Không thể cập nhật danh mục', 500)
  }

  return ApiResponse.success(data)
}

// DELETE /api/categories — Xóa danh mục
export async function DELETE(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  const body = await request.json()
  if (!body.id) return ApiResponse.error('Thiếu id')

  const supabase = createAdminClient()

  // Kiểm tra còn món đang hoạt động không
  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', Number(body.id))
    .eq('is_deleted', false)

  if (count && count > 0)
    return ApiResponse.error(`Danh mục còn ${count} món. Hãy chuyển hoặc xóa món trước.`)

  const { error: dbError } = await supabase
    .from('categories')
    .delete()
    .eq('id', Number(body.id))

  if (dbError) return ApiResponse.error('Không thể xóa danh mục', 500)

  return ApiResponse.success({ id: Number(body.id) })
}