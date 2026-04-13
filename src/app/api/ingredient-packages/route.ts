import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, assert } from '@/utils/api'
import { ApiResponse } from '@/utils/api-response'

/**
 * GET /api/ingredient-packages
 * Lấy danh sách quy cách (có thể lọc theo ingredient_id nếu cần)
 */
export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin', 'chef'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const ingredientId = searchParams.get('ingredient_id')

    const supabase = createAdminClient()
    let query = supabase.from('ingredient_packages').select('*')

    if (ingredientId) {
      query = query.eq('ingredient_id', Number(ingredientId))
    }

    const { data, error: dbError } = await query.order('id')

    if (dbError) throw dbError
    return ApiResponse.success(data)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * POST /api/ingredient-packages
 * Thêm quy cách mới cho một nguyên liệu
 * Body: { ingredient_id, package_name, conversion_factor }
 */
export async function POST(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { ingredient_id, package_name, conversion_factor } = await request.json()

    assert(ingredient_id, 'Thiếu ID nguyên liệu')
    assert(package_name?.trim(), 'Tên quy cách không được trống')
    assert(Number(conversion_factor) > 0, 'Tỷ lệ quy đổi phải lớn hơn 0')

    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('ingredient_packages')
      .insert({
        ingredient_id: Number(ingredient_id),
        package_name: package_name.trim(),
        conversion_factor: Number(conversion_factor),
      })
      .select()
      .single()

    if (dbError) throw dbError
    return ApiResponse.success(data, 201)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * PUT /api/ingredient-packages
 * Sửa tên quy cách hoặc tỷ lệ quy đổi
 */
export async function PUT(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { id, package_name, conversion_factor } = await request.json()
    assert(id, 'Thiếu ID quy cách')

    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('ingredient_packages')
      .update({
        package_name: package_name?.trim(),
        conversion_factor: Number(conversion_factor),
      })
      .eq('id', Number(id))
      .select()
      .single()

    if (dbError) throw dbError
    return ApiResponse.success(data)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * DELETE /api/ingredient-packages
 * Xóa quy cách (Lưu ý: Chỉ xóa được nếu chưa có lịch sử nhập hàng liên quan)
 */
export async function DELETE(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { id } = await request.json()
    assert(id, 'Thiếu ID quy cách')

    const supabase = createAdminClient()
    const { error: dbError } = await supabase
      .from('ingredient_packages')
      .delete()
      .eq('id', Number(id))

    if (dbError) throw dbError
    return ApiResponse.success({ id: Number(id) })
  } catch (err) {
    return ApiResponse.handle(err)
  }
}
