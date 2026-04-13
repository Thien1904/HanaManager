// src/app/api/orders/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/utils/api'
import { ApiResponse } from '@/utils/api-response' // Chuẩn hóa response API
import { getUserFromRequest } from '@/utils/api-auth'
// GET /api/orders — Lấy danh sách order
export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin', 'waiter', 'chef'])
  if (error) return error

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const tableId = searchParams.get('tableId')
  const status = searchParams.get('status')

  let query = supabase
    .from('orders')
    .select(
      `
      id, status, payment_status, total_price, discount_amount, note, created_at,
      tables ( id, table_number ),
      users ( id, full_name ),
      customers ( id, name, phone ),
      order_items (
        id, quantity, subtotal, notes,
        products ( id, name, price )
      )
    `,
    )
    .order('created_at', { ascending: false })

  if (tableId) query = query.eq('table_id', tableId)
  if (status) query = query.eq('status', status)

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

  // Thành — ưu tiên giá variant từ client, fallback về DB
  const productIds = [...new Set(items.map((i: any) => i.productId))]
  const variantIds = items.map((i: any) => i.variantId).filter(Boolean)

  const { data: products } = await supabase
    .from('products')
    .select('id, price')
    .in('id', productIds)

  // Lấy giá variant từ DB để đảm bảo không bị giả mạo
  let variantPriceMap: Record<number, number> = {}
  if (variantIds.length > 0) {
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, price')
      .in('id', variantIds)
    variantPriceMap = Object.fromEntries((variants ?? []).map((v) => [v.id, v.price]))
  }

  const priceMap = Object.fromEntries((products ?? []).map((p) => [p.id, p.price]))

  // Tính giá đúng: variant price > product price
  const getItemPrice = (item: any) =>
    item.variantId
      ? (variantPriceMap[item.variantId] ?? priceMap[item.productId] ?? 0)
      : (priceMap[item.productId] ?? 0)

  const totalPrice = items.reduce(
    (sum: number, item: any) => sum + getItemPrice(item) * item.quantity,
    0,
  )
  // Tạo order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      table_id: tableId,
      user_id: user!.userId,
      customer_id: customerId ?? null,
      total_price: totalPrice,
      discount_amount: 0,
      status: 'pending',
      payment_status: 'unpaid',
      note: note ?? null,
    })
    .select()
    .single()

  if (orderError) return ApiResponse.error('Không thể tạo đơn hàng')

  // Tạo order items
  // Tạo order items chuẩn với Variant Name và Subtotal đúng
  // Vì hàm map này không async nên ta dùng dữ liệu đã fetch ở trên (priceMap & variantPriceMap)
  const orderItems = await Promise.all(
    items.map(async (item: any) => {
      const unitPrice = getItemPrice(item)
      // Lấy tên variant để lưu snapshot
      let vName = null
      if (item.variantId) {
        const { data: v } = await supabase
          .from('product_variants')
          .select('name')
          .eq('id', item.variantId)
          .single()
        vName = v?.name
      }

      return {
        order_id: order.id,
        product_id: item.productId,
        variant_id: item.variantId ?? null,
        variant_name: vName, // LƯU TÊN VARIANT VÀO ĐÂY
        quantity: item.quantity,
        subtotal: unitPrice * item.quantity, // GIÁ CHUẨN (VARIANT HOẶC GỐC)
        notes: item.notes ?? '',
      }
    }),
  )

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems)

  if (itemsError) {
    // Rollback: xóa order vừa tạo nếu items lỗi
    await supabase.from('orders').delete().eq('id', order.id)
    return ApiResponse.error('Không thể thêm món vào đơn hàng')
  }

  // Cập nhật trạng thái bàn → occupied
  await supabase.from('tables').update({ status: 'occupied' }).eq('id', tableId)

  return ApiResponse.success({ orderId: order.id, totalPrice }, 201)
}
