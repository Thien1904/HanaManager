// src/app/api/ingredients/route.ts
// Quản lý nguyên liệu: CRUD bảng ingredients
// Dùng trong trang admin/ingredients để thêm/sửa/xóa nguyên liệu và cập nhật tồn kho

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server' // Supabase client bypass RLS
import { ApiResponse, requireRole, assert } from '@/utils/api'   // Helper response + kiểm tra quyền

/**
 * GET /api/ingredients
 * Lấy toàn bộ danh sách nguyên liệu, sắp xếp theo tên
 * Cho phép: admin, chef
 */
export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin', 'chef'])
  if (error) return error

  try {
    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('ingredients')
      .select('id, name, unit, stock_quantity, min_stock_level, updated_at')
      .order('name')

    if (dbError) throw dbError
    return ApiResponse.success(data)

  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * POST /api/ingredients
 * Thêm nguyên liệu mới
 * Body: { name, unit, stock_quantity?, min_stock_level? }
 * Chỉ admin
 */
export async function POST(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { name, unit, stock_quantity, min_stock_level } = await request.json()

    assert(name?.trim(),'Tên nguyên liệu không được trống')
    assert(unit?.trim(),'Đơn vị không được trống')
    assert((stock_quantity ?? 0) >= 0,'Tồn kho không được âm')

    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('ingredients')
      .insert({
        name:            name.trim(),
        unit:            unit.trim(),
        stock_quantity:  stock_quantity ?? 0,
        min_stock_level: min_stock_level ?? 5,
      })
      .select('id, name, unit, stock_quantity, min_stock_level, updated_at')
      .single()

    if (dbError) throw dbError
    return ApiResponse.success(data, 201)

  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * PUT /api/ingredients
 * Cập nhật thông tin hoặc tồn kho nguyên liệu
 * Body: { id, name?, unit?, stock_quantity?, min_stock_level? }
 * Cho phép: admin, chef
 */
export async function PUT(request: NextRequest) {
  const { error } = requireRole(request, ['admin', 'chef'])
  if (error) return error

  try {
    const { id, ...updates } = await request.json()

    assert(id, 'Thiếu id')

    // Chỉ cho phép update các cột hợp lệ trong schema
    const allowed = ['name', 'unit', 'stock_quantity', 'min_stock_level']
    const safeUpdates: Record<string, any> = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    )

    if (safeUpdates.name) safeUpdates.name = safeUpdates.name.trim()
    if (safeUpdates.unit) safeUpdates.unit = safeUpdates.unit.trim()
    safeUpdates.updated_at = new Date().toISOString()

    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('ingredients')
      .update(safeUpdates)
      .eq('id', Number(id))
      .select('id, name, unit, stock_quantity, min_stock_level, updated_at')
      .single()

    if (dbError) throw dbError
    return ApiResponse.success(data)

  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * DELETE /api/ingredients
 * Xóa nguyên liệu — chỉ xóa được nếu không còn dùng trong công thức nào
 * Body: { id }
 * Chỉ admin
 */
export async function DELETE(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { id } = await request.json()
    assert(id, 'Thiếu id')
    const supabase = createAdminClient()
    // Kiểm tra nguyên liệu có đang dùng trong công thức nào không
    const { count } = await supabase
      .from('recipes')
      .select('*', { count: 'exact', head: true })
      .eq('ingredient_id', Number(id))
    assert(
      !count || count === 0,
      `Nguyên liệu đang dùng trong ${count} công thức. Xóa khỏi công thức trước.`
    )

    const { error: dbError } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', Number(id))

    if (dbError) throw dbError
    return ApiResponse.success({ id: Number(id) })

  } catch (err) {
    return ApiResponse.handle(err)
  }
}