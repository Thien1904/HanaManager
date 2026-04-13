// src/app/api/reports/summary/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/utils/api'
import { ApiResponse } from '@/utils/api-response' // Chuẩn hóa response API

export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  const supabase = createAdminClient()
  // 1. Lấy ngày hiện tại dưới dạng chuỗi YYYY-MM-DD theo giờ VN
  const now = new Date()
  const vnDateStr = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
  }).format(now) // Kết quả: "2026-03-16" (sv-SE cho định dạng YYYY-MM-DD)

  // 2. Tạo mốc bắt đầu ngày (00:00:00 GMT+7)
  const todayStart = new Date(`${vnDateStr}T00:00:00+07:00`).toISOString()

  // 3. Tạo mốc kết thúc ngày (23:59:59 GMT+7)
  const todayEnd = new Date(`${vnDateStr}T23:59:59+07:00`).toISOString()

  // 4. Chuỗi ngày để hiển thị hoặc log
  const todayStr = vnDateStr

  console.log('Bắt đầu:', todayStart) // Sẽ là 2026-03-15T17:00:00.000Z (Vì 17h hôm trước + 7h = 0h hôm nay)
  console.log('Kết thúc:', todayEnd)
  // 1. Số đơn hôm nay + doanh thu
  const { data: todayOrders } = await supabase
    .from('orders')
    .select('id, total_price, discount_amount, status, payment_status, created_at')
    .gte('created_at', todayStart)
    .lte('created_at', todayEnd)
    .neq('status', 'cancelled')

  const totalOrders = todayOrders?.length ?? 0
  const totalRevenue = (todayOrders ?? [])
    .filter((o) => o.payment_status === 'paid')
    .reduce((s, o) => s + (o.total_price - (o.discount_amount ?? 0)), 0)

  // 2. Số món hủy hôm nay — từ print_queue loại cancel
  const { data: cancelledItems } = await supabase
    .from('print_queue')
    .select('id, content_json, created_at, order_id')
    .eq('status', 'pending')
    .contains('content_json', { type: 'cancel' })
    .gte('created_at', todayStart)
    .lte('created_at', todayEnd)

  const totalCancelled = (cancelledItems ?? []).reduce((s, i) => {
    return s + ((i.content_json as any)?.cancelQty ?? 1)
  }, 0)

  // 3. Top 10 món bán chạy hôm nay
  const { data: topItems } = await supabase
    .from('order_items')
    .select(
      `
      quantity,
      products ( id, name ),
      orders!inner ( created_at, status )
    `,
    )
    .gte('orders.created_at', todayStart)
    .lte('orders.created_at', todayEnd)
    .neq('orders.status', 'cancelled')

  // Group theo tên món
  const productMap: Record<string, { name: string; qty: number }> = {}
  for (const item of topItems ?? []) {
    const name = (item.products as any)?.name ?? 'Không rõ'
    if (!productMap[name]) productMap[name] = { name, qty: 0 }
    productMap[name].qty += item.quantity
  }
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10)

  // 4. Hoạt động giảm giá gần đây (10 bill gần nhất có discount)
  const PAGE_SIZE = 10
  const { data: discountOrders } = await supabase
    .from('orders')
    .select('id, total_price, discount_amount, created_at, tables(table_number), users(full_name)')
    .gt('discount_amount', 0)
    .eq('payment_status', 'paid')
    .order('created_at', { ascending: false })
    .limit(50)

  // 5. Chi tiết món hủy hôm nay
  const cancelledDetail = (cancelledItems ?? []).map((i) => ({
    id: i.id,
    orderId: i.order_id,
    productName: (i.content_json as any)?.productName ?? '?',
    cancelQty: (i.content_json as any)?.cancelQty ?? 1,
    createdAt: i.created_at,
  }))

  return ApiResponse.success({
    today: {
      date: todayStr,
      totalOrders,
      totalRevenue,
      totalCancelled,
    },
    topProducts,
    discountOrders: discountOrders ?? [],
    cancelledDetail,
  })
}
