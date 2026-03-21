// src/app/api/orders/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ApiResponse, requireRole, getUserFromRequest } from '@/utils/api'

// GET /api/orders — Lấy danh sách order
export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin', 'waiter', 'chef'])
  if (error) return error

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const tableId = searchParams.get('tableId')
  const status  = searchParams.get('status')

  let query = supabase
    .from('orders')
    .select(`
      id, status, payment_status, total_price, discount_amount, note, created_at,
      tables ( id, table_number ),
      users ( id, full_name ),
      customers ( id, name, phone ),
      order_items (
        id, quantity, subtotal, notes,
        products ( id, name, price )
      )
    `)
    .order('created_at', { ascending: false })

  if (tableId) query = query.eq('table_id', tableId)
  if (status)  query = query.eq('status', status)

  const { data, error: dbError } = await query
  if (dbError) return ApiResponse.error('Không thể tải đơn hàng')

  return ApiResponse.success(data)
}

// POST /api/orders — Tạo order mới
export async function POST(request: NextRequest) {
  const { user, error } = requireRole(request, ['admin', 'waiter'])
  if (error) return error

  const body = await request.json()
  const { tableId, items, note, customerId } = body

  // Validate
  if (!tableId) return ApiResponse.error('Thiếu thông tin bàn')
  if (!items || items.length === 0) return ApiResponse.error('Chưa chọn món nào')

  // Validate từng item
  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity < 1) {
      return ApiResponse.error('Thông tin món không hợp lệ')
    }
  }

  const supabase = createAdminClient()

  // Tính tổng tiền
  // Lấy giá thật từ DB thay vì tin vào client gửi lên (bảo mật)
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, price')
    .in('id', items.map((i: any) => i.productId))

  if (prodError || !products) return ApiResponse.error('Không thể xác minh giá món')

  const priceMap = Object.fromEntries(products.map(p => [p.id, p.price]))

  const totalPrice = items.reduce((sum: number, item: any) => {
    return sum + (priceMap[item.productId] ?? 0) * item.quantity
  }, 0)

  // Tạo order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      table_id:        tableId,
      user_id:         user!.userId,
      customer_id:     customerId ?? null,
      total_price:     totalPrice,
      discount_amount: 0,
      status:          'pending',
      payment_status:  'unpaid',
      note:            note ?? null,
    })
    .select()
    .single()

  if (orderError) return ApiResponse.error('Không thể tạo đơn hàng')

  // Tạo order items
  const orderItems = items.map((item: any) => ({
    order_id:   order.id,
    product_id: item.productId,
    quantity:   item.quantity,
    subtotal:   (priceMap[item.productId] ?? 0) * item.quantity,
    notes:      item.notes ?? '',
  }))

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems)

  if (itemsError) {
    // Rollback: xóa order vừa tạo nếu items lỗi
    await supabase.from('orders').delete().eq('id', order.id)
    return ApiResponse.error('Không thể thêm món vào đơn hàng')
  }

  // Cập nhật trạng thái bàn → occupied
  await supabase
    .from('tables')
    .update({ status: 'occupied' })
    .eq('id', tableId)

  return ApiResponse.success({ orderId: order.id, totalPrice }, 201)
}