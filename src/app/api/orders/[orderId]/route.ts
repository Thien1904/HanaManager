// src/app/api/orders/[orderId]/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/utils/api'
import { ApiResponse } from '@/utils/api-response' // Chuẩn hóa response API
import { promises } from 'dns'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { error } = requireRole(request, ['admin', 'waiter', 'chef'])
  if (error) return error
  if (error) return error

  const supabase = createAdminClient()
  const { orderId: id } = await params
  const orderId = parseInt(id)
  if (isNaN(orderId)) return ApiResponse.error('orderId không hợp lệ')

  const { data, error: dbError } = await supabase
    .from('orders')
    .select(
      `
      id, status, payment_status, total_price, discount_amount, note, created_at,
      tables      ( table_number ),
      users       ( full_name ),
      customers   ( name, phone ),
      order_items (
        id,
         quantity,
         subtotal,
         notes,
         variant_id,
         variant_name,   
        products ( id, name, price ),
        product_variants ( name )
      
      )
    `,
    )
    .eq('id', orderId)
    .single()

  if (dbError || !data) return ApiResponse.notFound('Đơn hàng')

  return ApiResponse.success(data)
}

// PATCH /api/orders/[orderId] — Cập nhật ghi chú order
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { error } = requireRole(request, ['admin', 'waiter'])
  if (error) return error

  const { orderId } = await params
  const body = await request.json()
  const supabase = createAdminClient()

  const { data, error: dbError } = await supabase
    .from('orders')
    .update({ note: body.note })
    .eq('id', parseInt(orderId))
    .select()
    .single()

  if (dbError) return ApiResponse.error('Không thể cập nhật ghi chú')
  return ApiResponse.success(data)
}
