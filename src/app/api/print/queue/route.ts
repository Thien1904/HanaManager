// src/app/api/print-queue/route.ts
// API cho Print Agent poll lệnh in pending và cập nhật trạng thái
// Print Agent dùng endpoint này để lấy job và báo kết quả

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/utils/api'
import { ApiResponse } from '@/utils/api-response' // Chuẩn hóa response API

/**
 * GET /api/print-queue?printer_type=kitchen&limit=10
 * Lấy các job in đang pending — Print Agent poll endpoint này
 * Cho phép: admin (agent dùng service role key qua header)
 */
export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin', 'waiter', 'chef'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const printer_type = searchParams.get('printer_type')
    const limit = Number(searchParams.get('limit') ?? 10)

    const supabase = createAdminClient()

    let query = supabase
      .from('print_queue')
      .select(
        'id, printer_type, printer_id, content, content_json, priority, retry_count, max_retries, created_at',
      )
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit)

    if (printer_type) query = query.eq('printer_type', printer_type)

    const { data, error: dbError } = await query
    if (dbError) throw dbError

    // Lọc job chưa vượt max_retries
    const jobs = (data ?? []).filter((j) => j.retry_count < j.max_retries)
    return ApiResponse.success(jobs)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * PATCH /api/print-queue — Cập nhật trạng thái job sau khi in
 * Body: { id, status: 'printed' | 'failed', error_message? }
 * Print Agent gọi sau khi in xong hoặc lỗi
 */
export async function PATCH(request: NextRequest) {
  const { error } = requireRole(request, ['admin', 'waiter', 'chef'])
  if (error) return error

  try {
    const body = await request.json()
    const { id, status, error_message } = body

    if (!id) return ApiResponse.error('Thiếu id')
    if (!['printed', 'failed'].includes(status)) return ApiResponse.error('Status không hợp lệ')

    const supabase = createAdminClient()

    if (status === 'printed') {
      // In thành công
      await supabase
        .from('print_queue')
        .update({ status: 'printed', printed_at: new Date().toISOString() })
        .eq('id', Number(id))
    } else {
      // In thất bại — tăng retry_count, nếu vượt max thì đánh dấu failed
      const { data: job } = await supabase
        .from('print_queue')
        .select('retry_count, max_retries')
        .eq('id', Number(id))
        .single()

      if (job) {
        const newRetry = job.retry_count + 1
        await supabase
          .from('print_queue')
          .update({
            retry_count: newRetry,
            error_message: error_message ?? 'Unknown error',
            status: newRetry >= job.max_retries ? 'failed' : 'pending',
          })
          .eq('id', Number(id))
      }
    }

    return ApiResponse.success({ id: Number(id), status })
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * DELETE /api/print-queue — Xóa job đã in hoặc thất bại
 * Body: { id } hoặc { older_than_days: 7 } để dọn dẹp hàng loạt
 */
export async function DELETE(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (body.older_than_days) {
      // Xóa job cũ hơn N ngày
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - body.older_than_days)
      await supabase
        .from('print_queue')
        .delete()
        .in('status', ['printed', 'failed'])
        .lt('created_at', cutoff.toISOString())
    } else {
      await supabase.from('print_queue').delete().eq('id', Number(body.id))
    }

    return ApiResponse.success({ deleted: true })
  } catch (err) {
    return ApiResponse.handle(err)
  }
}
