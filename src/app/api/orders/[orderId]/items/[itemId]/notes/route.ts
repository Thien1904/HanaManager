// src/app/api/orders/[orderId]/items/[itemId]/notes/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/utils/api'
import { ApiResponse } from '@/utils/api-response' // Chuẩn hóa response API

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; itemId: string }> },
) {
  const { error } = requireRole(request, ['admin', 'waiter'])
  if (error) return error

  const { itemId } = await params
  const { notes } = await request.json()
  const supabase = createAdminClient()

  const { error: dbError } = await supabase
    .from('order_items')
    .update({ notes })
    .eq('id', parseInt(itemId))

  if (dbError) return ApiResponse.error('Không thể cập nhật ghi chú')
  return ApiResponse.success({ ok: true })
}
