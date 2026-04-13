// src/app/api/recipes/route.ts
// Quản lý công thức món ăn: CRUD bảng recipes
// Mỗi record = 1 nguyên liệu trong công thức của 1 món
// Dùng trong RecipeModal khi admin bấm "Xem công thức" trên từng món

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server' // Supabase client bypass RLS
import { requireRole, assert } from '@/utils/api' // Helper response + kiểm tra quyền
import { ApiResponse } from '@/utils/api-response' // Chuẩn hóa response API

/**
 * GET /api/recipes?product_id=1
 * Lấy toàn bộ nguyên liệu trong công thức của 1 món
 * Cho phép: admin, chef
 */
export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin', 'chef'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('product_id')

    assert(productId, 'Thiếu product_id')

    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('recipes')
      .select(
        `
        id, quantity_needed,
        ingredients ( id, name, unit, stock_quantity )
      `,
      )
      .eq('product_id', Number(productId))
      .order('id')

    if (dbError) throw dbError
    return ApiResponse.success(data)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * POST /api/recipes
 * Thêm 1 nguyên liệu vào công thức của món
 * Body: { product_id, ingredient_id, quantity_needed }
 * Chỉ admin
 */
export async function POST(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { product_id, ingredient_id, quantity_needed } = await request.json()

    assert(product_id, 'Thiếu product_id')
    assert(ingredient_id, 'Thiếu ingredient_id')
    assert(quantity_needed > 0, 'Số lượng phải lớn hơn 0')

    const supabase = createAdminClient()

    // Kiểm tra nguyên liệu này đã có trong công thức chưa
    const { count } = await supabase
      .from('recipes')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', Number(product_id))
      .eq('ingredient_id', Number(ingredient_id))

    assert(!count || count === 0, 'Nguyên liệu này đã có trong công thức')

    const { data, error: dbError } = await supabase
      .from('recipes')
      .insert({
        product_id: Number(product_id),
        ingredient_id: Number(ingredient_id),
        quantity_needed,
      })
      .select(
        `
        id, quantity_needed,
        ingredients ( id, name, unit, stock_quantity )
      `,
      )
      .single()

    if (dbError) throw dbError
    return ApiResponse.success(data, 201)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * PUT /api/recipes
 * Cập nhật số lượng nguyên liệu trong công thức
 * Body: { id, quantity_needed }
 * Chỉ admin
 */
export async function PUT(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { id, quantity_needed } = await request.json()

    assert(id, 'Thiếu id')
    assert(quantity_needed > 0, 'Số lượng phải lớn hơn 0')

    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('recipes')
      .update({ quantity_needed })
      .eq('id', Number(id))
      .select(
        `
        id, quantity_needed,
        ingredients ( id, name, unit, stock_quantity )
      `,
      )
      .single()

    if (dbError) throw dbError
    return ApiResponse.success(data)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * DELETE /api/recipes
 * Xóa 1 nguyên liệu khỏi công thức
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
    const { error: dbError } = await supabase.from('recipes').delete().eq('id', Number(id))

    if (dbError) throw dbError
    return ApiResponse.success({ id: Number(id) })
  } catch (err) {
    return ApiResponse.handle(err)
  }
}
