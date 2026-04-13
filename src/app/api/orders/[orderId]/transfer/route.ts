// src/app/api/orders/[orderId]/transfer/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/utils/api'
import { ApiResponse } from '@/utils/api-response' // Chuẩn hóa response API

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { error } = requireRole(request, ['admin', 'waiter'])
  if (error) return error

  const { orderId } = await params
  const { toTableId } = await request.json()
  if (!toTableId) return ApiResponse.error('Thiếu bàn đích')

  const supabase = createAdminClient()

  // Lấy order
  const { data: order } = await supabase
    .from('orders')
    .select('id, table_id')
    .eq('id', parseInt(orderId))
    .single()
  if (!order) return ApiResponse.notFound('Đơn hàng')

  // Kiểm tra bàn đích còn trống
  const { data: toTable } = await supabase
    .from('tables')
    .select('id, status, table_number')
    .eq('id', toTableId)
    .single()
  if (!toTable) return ApiResponse.notFound('Bàn đích')
  if (toTable.status !== 'available')
    return ApiResponse.error(`Bàn ${toTable.table_number} đang có khách`)

  // Chuyển order sang bàn mới
  await supabase.from('orders').update({ table_id: toTableId }).eq('id', order.id)

  // Bàn cũ về available, bàn mới thành occupied
  await supabase.from('tables').update({ status: 'available' }).eq('id', order.table_id)
  await supabase.from('tables').update({ status: 'occupied' }).eq('id', toTableId)

  return ApiResponse.success({ message: `Đã chuyển sang bàn ${toTable.table_number}` })
}
