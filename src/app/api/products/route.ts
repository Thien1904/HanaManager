// src/app/api/products/route.ts
// Quản lý món ăn: CRUD bảng products
// Bao gồm cấu hình in: print_kitchen, print_bar, print_label
// Trả về kèm variants (size + giá) cho từng món

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ApiResponse, requireRole, assert } from '@/utils/api'

/**
 * GET /api/products — Lấy danh sách món ăn kèm variants
 * ?all=true → lấy cả món ẩn (admin)
 * ?category_id=1 → filter theo danh mục
 */
export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin', 'waiter', 'chef'])
  if (error) return error

  try {
    const { searchParams }   = new URL(request.url)
    const categoryId         = searchParams.get('category_id')
    const includeUnavailable = searchParams.get('all') === 'true'

    const supabase = createAdminClient()

    let query = supabase
      .from('products')
      .select(`
        id, name, description, price, image_url, is_available,
        category_id, print_kitchen, print_bar, print_label,
        categories ( id, name ),
        product_variants (
          id, name, price, is_default, is_active, sort_order
        )
      `)
      .eq('is_deleted', false)
      .order('name')

    if (!includeUnavailable) query = query.eq('is_available', true)
    if (categoryId) query = query.eq('category_id', Number(categoryId))

    const { data, error: dbError } = await query
    if (dbError) throw dbError

    // Chỉ giữ variant đang active, sort theo sort_order
    const products = (data ?? []).map((p) => ({
      ...p,
      variants: (p.product_variants ?? [])
        .filter((v: any) => v.is_active)
        .sort((a: any, b: any) => a.sort_order - b.sort_order),
    }))

    return ApiResponse.success(products)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * POST /api/products — Thêm món mới
 */
export async function POST(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const body = await request.json()
    const { name, category_id, price, description, image_url, is_available,
            print_kitchen, print_bar, print_label } = body

    assert(name?.trim(), 'Tên món không được trống')
    assert(category_id,  'Chọn danh mục')
    assert(price >= 0,   'Giá không hợp lệ')

    const supabase = createAdminClient()   
    const { data, error: dbError } = await supabase
      .from('products')
      .insert({
        name:          name.trim(),
        category_id:   Number(category_id),
        price,
        description:   description?.trim() ?? null,
        image_url:     image_url ?? null,
        is_available:  is_available ?? true,
        print_kitchen: print_kitchen ?? true,
        print_bar:     print_bar     ?? false,
        print_label:   print_label   ?? false,
      })
      .select(`
        id, name, description, price, image_url, is_available,
        category_id, print_kitchen, print_bar, print_label,
        categories ( id, name ),
        product_variants ( id, name, price, is_default, is_active, sort_order )
      `)
      .single()

    if (dbError) throw dbError
    return ApiResponse.success({ ...data, variants: [] }, 201)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * PUT /api/products — Cập nhật món
 */
export async function PUT(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const body = await request.json()
    const { id, ...updates } = body

    assert(id, 'Thiếu id')

    const allowed = [
      'name', 'category_id', 'price', 'description',
      'image_url', 'is_available',
      'print_kitchen', 'print_bar', 'print_label',
    ]
    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    )
    if (safeUpdates.name)        safeUpdates.name = (safeUpdates.name as string).trim()
    if (safeUpdates.category_id) safeUpdates.category_id = Number(safeUpdates.category_id)

    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('products')
      .update(safeUpdates)
      .eq('id', Number(id))
      .eq('is_deleted', false)
      .select(`
        id, name, description, price, image_url, is_available,
        category_id, print_kitchen, print_bar, print_label,
        categories ( id, name ),
        product_variants ( id, name, price, is_default, is_active, sort_order )
      `)
      .single()

    if (dbError) throw dbError

    const result = {
      ...data,
      variants: (data.product_variants ?? [])
        .filter((v: any) => v.is_active)
        .sort((a: any, b: any) => a.sort_order - b.sort_order),
    }

    return ApiResponse.success(result)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * DELETE /api/products — Soft delete món
 */
export async function DELETE(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { id } = await request.json()
    assert(id, 'Thiếu id')

    const supabase = createAdminClient()

    const { data: product } = await supabase
      .from('products')
      .select('image_url')
      .eq('id', Number(id))
      .single()

    if (product?.image_url) {
      const path = product.image_url.split('/storage/v1/object/public/products/')[1]
      if (path) await supabase.storage.from('products').remove([path])
    }

    const { error: dbError } = await supabase
      .from('products')
      .update({ is_deleted: true, is_available: false, image_url: null })
      .eq('id', Number(id))

    if (dbError) throw dbError
    return ApiResponse.success({ id: Number(id) })
  } catch (err) {
    return ApiResponse.handle(err)
  }
}