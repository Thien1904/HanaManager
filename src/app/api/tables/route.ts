// src/app/api/tables/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ApiResponse, requireRole } from '@/utils/api'

// GET /api/tables — Lấy danh sách tất cả bàn
// Ai gọi được: admin + waiter (xem trong proxy.ts → ROUTE_PERMISSIONS)
export async function GET(request: NextRequest) {

  // Kiểm tra quyền — chỉ admin và waiter mới xem được bàn
  const { error } = requireRole(request, ['admin', 'waiter', 'chef'])
  if (error) return error

  const supabase = createAdminClient()

  // Query bảng tables — lấy thêm thông tin order đang active nếu có
  // LEFT JOIN: bàn không có order vẫn hiện ra (không bị mất)
  const { data, error: dbError } = await supabase
    .from('tables')
    .select(`
      id,
      table_number,
      status,
      orders (
        id,
        status,
        total_price,
        created_at,
        users ( full_name )
      )
    `)
    // Chỉ lấy order chưa thanh toán — tránh hiện order cũ đã paid
    .not('orders.payment_status', 'eq', 'paid')
    .not('orders.status', 'eq', 'cancelled')
    .order('table_number')

  if (dbError) {
    console.error('Tables query error:', dbError)
    return ApiResponse.error('Không thể tải danh sách bàn')
  }

  // Xử lý data: mỗi bàn chỉ lấy order mới nhất (nếu có nhiều)
  const tables = data.map(table => ({
    ...table,
    activeOrder: table.orders?.[0] ?? null,
    orders: undefined,
  }))

  // Tự động fix bàn bị kẹt:
  // occupied nhưng không còn order active → reset về available
  // Xảy ra khi hủy hết món sau khi bếp đã nhận
  const stuckTables = tables.filter(
    t => t.status === 'occupied' && !t.activeOrder
  )

  if (stuckTables.length > 0) {
    await supabase
      .from('tables')
      .update({ status: 'available' })
     .in('orders.status', ['pending', 'sent_to_kitchen', 'preparing'])
    // Cập nhật lại status trong response luôn — không cần client refresh thêm lần nữa
    stuckTables.forEach(t => { t.status = 'available' })
  }

  return ApiResponse.success(tables)
}

// PATCH /api/tables — Cập nhật trạng thái bàn
// Dùng khi: waiter đổi bàn từ available → occupied hoặc ngược lại
export async function PATCH(request: NextRequest) {

  const { user, error } = requireRole(request, ['admin', 'waiter'])
  if (error) return error

  const { tableId, status } = await request.json()

  if (!tableId || !status) {
    return ApiResponse.error('Thiếu tableId hoặc status')
  }

  // Chỉ cho phép các trạng thái hợp lệ
  const validStatuses = ['available', 'occupied', 'reserved']
  if (!validStatuses.includes(status)) {
    return ApiResponse.error('Trạng thái không hợp lệ')
  }

  const supabase = createAdminClient()

  const { data, error: dbError } = await supabase
    .from('tables')
    .update({ status })
    .eq('id', tableId)
    .select()
    .single()

  if (dbError) return ApiResponse.error('Không thể cập nhật trạng thái bàn')

  return ApiResponse.success(data)
}