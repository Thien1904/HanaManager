// src/app/api/suppliers/route.ts
// Quản lý nhà cung cấp nguyên liệu — CRUD bảng suppliers
// Dùng trong trang nhập nguyên liệu để chọn nhà cung cấp

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ApiResponse, requireRole, assert } from '@/utils/api'

/**
 * GET /api/suppliers — Lấy danh sách nhà cung cấp
 */
export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('suppliers')
      .select('id, name, contact_name, phone, address, created_at')
      .order('name')

    if (dbError) throw dbError
    return ApiResponse.success(data)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * POST /api/suppliers — Thêm nhà cung cấp mới
 * Body: { name, contact_name?, phone?, address? }
 */
export async function POST(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { name, contact_name, phone, address } = await request.json()

    assert(name?.trim(), 'Tên nhà cung cấp không được trống')

    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('suppliers')
      .insert({
        name:         name.trim(),
        contact_name: contact_name?.trim() ?? null,
        phone:        phone?.trim() ?? null,
        address:      address?.trim() ?? null,
      })
      .select('id, name, contact_name, phone, address, created_at')
      .single()

    if (dbError) throw dbError
    return ApiResponse.success(data, 201)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * PUT /api/suppliers — Cập nhật nhà cung cấp
 * Body: { id, name?, contact_name?, phone?, address? }
 */
export async function PUT(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { id, name, contact_name, phone, address } = await request.json()

    assert(id, 'Thiếu id')
    assert(name?.trim(), 'Tên nhà cung cấp không được trống')

    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('suppliers')
      .update({
        name:         name.trim(),
        contact_name: contact_name?.trim() ?? null,
        phone:        phone?.trim() ?? null,
        address:      address?.trim() ?? null,
      })
      .eq('id', Number(id))
      .select('id, name, contact_name, phone, address, created_at')
      .single()

    if (dbError) throw dbError
    return ApiResponse.success(data)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * DELETE /api/suppliers — Xóa nhà cung cấp
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { id } = await request.json()
    assert(id, 'Thiếu id')

    const supabase = createAdminClient()

    // Kiểm tra còn đơn nhập hàng không
    const { count } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', Number(id))

    assert(!count || count === 0, `Nhà cung cấp còn ${count} đơn nhập hàng, không thể xóa`)

    const { error: dbError } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', Number(id))

    if (dbError) throw dbError
    return ApiResponse.success({ id: Number(id) })
  } catch (err) {
    return ApiResponse.handle(err)
  }
}