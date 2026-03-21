// src/app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ApiResponse, requireRole } from '@/utils/api'

// GET /api/products — Lấy danh sách món ăn
export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin', 'waiter', 'chef'])
  if (error) return error

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get('category_id')
  const includeUnavailable = searchParams.get('all') === 'true' // admin dùng ?all=true

  let query = supabase
    .from('products')
    .select(`
      id, name, description, price, image_url, is_available,category_id,
      categories ( id, name )
    `)
    .eq('is_deleted', false)
    .order('name')

  if (!includeUnavailable) query = query.eq('is_available', true)
  if (categoryId) query = query.eq('category_id', Number(categoryId))

  const { data, error: dbError } = await query
  if (dbError) return ApiResponse.error('Không thể tải danh sách món')

  return ApiResponse.success(data)
}

// POST /api/products — Thêm món mới
export async function POST(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  const body = await request.json()
  const { name, category_id, price, description, image_url, is_available } = body

  if (!name?.trim()) return ApiResponse.error('Tên món không được trống', 400)
  if (!category_id) return ApiResponse.error('Chọn danh mục', 400)
  if (!price || price <= 0) return ApiResponse.error('Giá phải lớn hơn 0', 400)

  const supabase = createAdminClient()

  const { data, error: dbError } = await supabase
    .from('products')
    .insert({
      name: name.trim(),
      category_id: Number(category_id),
      price,
      description: description?.trim() ?? null,
      image_url: image_url ?? null,
      is_available: is_available ?? true,
    })
    .select(`
      id, name, description, price, image_url, is_available,
      categories ( id, name )
    `)
    .single()

  if (dbError) return ApiResponse.error('Không thể thêm món')

  return ApiResponse.success(data, 201)
}

// PUT /api/products — Cập nhật món
export async function PUT(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) return ApiResponse.error('Thiếu id', 400)

  // Chỉ update các cột hợp lệ trong schema
  const allowed = ['name', 'category_id', 'price', 'description', 'image_url', 'is_available']
  const safeUpdates = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  )

  if (safeUpdates.name) safeUpdates.name = (safeUpdates.name as string).trim()
  if (safeUpdates.category_id) safeUpdates.category_id = Number(safeUpdates.category_id)

  const supabase = createAdminClient()

  const { data, error: dbError } = await supabase
    .from('products')
    .update(safeUpdates)
    .eq('id', Number(id))
    .eq('is_deleted', false)
    .select(`
      id, name, description, price, image_url, is_available,
      categories ( id, name )
    `)
    .single()

  if (dbError) return ApiResponse.error('Không thể cập nhật món')

  return ApiResponse.success(data)
}

// DELETE /api/products — Soft delete món
export async function DELETE(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  const body = await request.json()
  const { id } = body

  if (!id) return ApiResponse.error('Thiếu id', 400)

  const supabase = createAdminClient()

  // Lấy image_url để xóa ảnh trên storage
  const { data: product } = await supabase
    .from('products')
    .select('image_url')
    .eq('id', Number(id))
    .single()

  if (product?.image_url) {
    const path = product.image_url.split('/storage/v1/object/public/products/')[1]
    if (path) await supabase.storage.from('products').remove([path])
  }

  // Soft delete — giữ FK với order_items
  const { error: dbError } = await supabase
    .from('products')
    .update({ is_deleted: true, is_available: false, image_url: null })
    .eq('id', Number(id))

  if (dbError) return ApiResponse.error('Không thể xóa món')

  return ApiResponse.success({ id })
}