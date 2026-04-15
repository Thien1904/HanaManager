// src/app/api/tables/route.ts
// Quản lý bàn ăn — CRUD bảng tables
// Chỉ admin được thêm/sửa/xóa bàn
// Waiter chỉ đọc (GET) qua useTables hook

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, assert } from '@/utils/api'
import { ApiResponse } from '@/utils/api-response' // Chuẩn hóa response API

/**
 * GET /api/tables — Lấy danh sách bàn kèm order đang active
 * Cho phép: admin, waiter
 */
export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin', 'waiter', 'chef'])
  if (error) return error

  try {
    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('tables')
      .select(
        `
        id, table_number, status,
        orders (
          id, status, total_price, created_at,
          users ( id, full_name )
        )
      `,
      )
      // Tối ưu: Chỉ lấy các đơn hàng chưa hoàn tất để giảm tải dữ liệu
      .not('orders.status', 'in', '(paid,cancelled)')
      .order('table_number')

    if (dbError) throw dbError

    const tables = data.map((t) => ({
      ...t,
      // Vì đã lọc ở query phía trên, orders array giờ chỉ chứa tối đa 1 order đang active
      activeOrder: (t.orders as any[])?.[0] ?? null,
    }))

    return ApiResponse.success(tables)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * POST /api/tables — Thêm bàn mới
 * Body: { table_number }
 * Chỉ admin
 */
export async function POST(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { table_number } = await request.json()

    assert(table_number?.toString().trim(), 'Số/tên bàn không được trống')

    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('tables')
      .insert({
        table_number: table_number.toString().trim(),
        status: 'available',
      })
      .select('id, table_number, status')
      .single()

    if (dbError) throw dbError
    return ApiResponse.success(data, 201)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * PUT /api/tables — Đổi tên bàn
 * Body: { id, table_number }
 * Chỉ admin — không cho đổi status ở đây (waiter tự đổi qua order flow)
 */
export async function PUT(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { id, table_number } = await request.json()

    assert(id, 'Thiếu id')
    assert(table_number?.toString().trim(), 'Số/tên bàn không được trống')

    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('tables')
      .update({ table_number: table_number.toString().trim() })
      .eq('id', Number(id))
      .select('id, table_number, status')
      .single()

    if (dbError) throw dbError
    return ApiResponse.success(data)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * DELETE /api/tables — Xóa bàn
 * Body: { id }
 * Chỉ xóa được bàn đang available và không có order nào
 * Chỉ admin
 */
export async function DELETE(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { id } = await request.json()
    assert(id, 'Thiếu id')

    const supabase = createAdminClient()

    // Kiểm tra bàn có đang occupied không
    const { data: table } = await supabase
      .from('tables')
      .select('status, table_number')
      .eq('id', Number(id))
      .single()

    assert(table, 'Không tìm thấy bàn')
    assert(
      table.status === 'available',
      `Bàn ${table.table_number} đang có khách hoặc đã đặt trước, không thể xóa`,
    )

    // Kiểm tra còn order chưa thanh toán không
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('table_id', Number(id))

      .not('status', 'in', '(paid,cancelled)')

    assert(!count || count === 0, `Bàn còn ${count} order chưa xử lý, không thể xóa`)

    const { error: dbError } = await supabase.from('tables').delete().eq('id', Number(id))

    if (dbError) throw dbError
    return ApiResponse.success({ id: Number(id) })
  } catch (err) {
    return ApiResponse.handle(err)
  }
}
