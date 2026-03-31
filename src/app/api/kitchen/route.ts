// src/app/api/kitchen/route.ts
// Báo chế biến — tạo kitchen_ticket và print_queue jobs
// Phân loại in dựa theo print_kitchen, print_bar, print_label của từng product
// Không còn dùng category name để phân loại

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ApiResponse, requireRole } from '@/utils/api'

/**
 * POST /api/kitchen — Báo chế biến
 * Lấy order → lọc món mới chưa báo → tạo ticket → tạo print jobs theo cấu hình từng món
 */
export async function POST(request: NextRequest) {
  const { user, error } = requireRole(request, ['admin', 'waiter'])
  if (error) return error

  const { orderId } = await request.json()
  if (!orderId) return ApiResponse.error('Thiếu orderId')

  const supabase = createAdminClient()

  // Bước 1: Lấy order + items + products (bao gồm cấu hình in)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id, status, note,
      tables ( id, table_number ),
      order_items (
        id, quantity, notes,
        products (
          id, name, price,
          print_kitchen, print_bar, print_label,
          categories ( name )
        )
      )
    `)
    .eq('id', orderId)
    .single()

  if (orderError || !order) return ApiResponse.notFound('Đơn hàng')

  if (!['pending', 'sent_to_kitchen', 'served'].includes(order.status)) {
    return ApiResponse.error(`Đơn hàng đang ở trạng thái "${order.status}", không thể báo bếp`)
  }

  // Bước 2: Lấy các order_item_id đã báo bếp — dùng id thay vì tên để tránh trùng
  const { data: prevTickets } = await supabase
    .from('kitchen_tickets')
    .select('items_snapshot')
    .eq('order_id', orderId)
    .in('status', ['sent', 'acknowledged', 'completed'])

  // Set các order_item_id đã báo
  const reportedItemIds = new Set<number>(
    (prevTickets ?? []).flatMap((t) =>
      (t.items_snapshot as any[]).map((i: any) => i.order_item_id).filter(Boolean)
    )
  )

  // Lọc món mới chưa báo và còn quantity > 0
  const allItems  = (order.order_items as any[]) ?? []
  const newItems  = allItems.filter((item: any) =>
    item.quantity > 0 && !reportedItemIds.has(item.id)
  )

  if (newItems.length === 0) {
    return ApiResponse.error('Không có món mới cần báo bếp')
  }

  // Bước 3: Phân loại theo cấu hình in của từng product
  const kitchenItems = newItems.filter((i: any) => i.products?.print_kitchen)
  const barItems     = newItems.filter((i: any) => i.products?.print_bar)
  const labelItems   = newItems.filter((i: any) => i.products?.print_label)

  const tableNumber = (order.tables as any)?.table_number ?? '?'
  const timeStr     = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  // Bước 4: Tạo kitchen_ticket — lưu order_item_id để lần sau filter đúng
  const { data: ticket, error: ticketError } = await supabase
    .from('kitchen_tickets')
    .insert({
      order_id:       orderId,
      table_id:       (order.tables as any)?.id,
      sent_by:        user!.userId,
      items_snapshot: newItems.map((i: any) => ({
        order_item_id: i.id,          // ← lưu id để filter chính xác
        name:          i.products?.name ?? '',
        quantity:      i.quantity,
        notes:         i.notes ?? '',
        category:      i.products?.categories?.name ?? '',
        print_kitchen: i.products?.print_kitchen ?? false,
        print_bar:     i.products?.print_bar     ?? false,
        print_label:   i.products?.print_label   ?? false,
      })),
      note:   order.note,
      status: 'sent',
    })
    .select()
    .single()

  if (ticketError) return ApiResponse.error('Không thể tạo phiếu bếp')

  // Bước 5: Cập nhật order status
  await supabase.from('orders').update({ status: 'sent_to_kitchen' }).eq('id', orderId)

  // Bước 6: Tạo print_queue jobs theo cấu hình từng món
  const printJobs: any[] = []

  // In phiếu bếp — chỉ các món có print_kitchen = true
  if (kitchenItems.length > 0) {
    printJobs.push({
      ticket_id:    ticket.id,
      order_id:     orderId,
      printer_type: 'kitchen',
      content:      buildKitchenReceipt({ tableNumber, timeStr, items: kitchenItems, note: order.note }),
      content_json: { tableNumber, timeStr, items: kitchenItems },
      status:       'pending',
      priority:     1,
      created_by:   user!.userId,
    })
  }

  // In phiếu bar — chỉ các món có print_bar = true
  if (barItems.length > 0) {
    printJobs.push({
      ticket_id:    ticket.id,
      order_id:     orderId,
      printer_type: 'bar',
      content:      buildBarReceipt({ tableNumber, timeStr, items: barItems }),
      content_json: { tableNumber, timeStr, items: barItems },
      status:       'pending',
      priority:     1,
      created_by:   user!.userId,
    })
  }

  // In tem dán ly — chỉ các món có print_label = true, 1 tem/ly
  if (labelItems.length > 0) {
    for (const item of labelItems) {
      for (let i = 1; i <= item.quantity; i++) {
        printJobs.push({
          ticket_id:    ticket.id,
          order_id:     orderId,
          printer_type: 'label',
          content:      buildLabelReceipt({
            tableNumber, timeStr,
            itemName: item.products?.name ?? '',
            notes:    item.notes ?? '',
            index:    i,
            total:    item.quantity,
          }),
          content_json: {
            tableNumber,
            itemName: item.products?.name,
            notes:    item.notes,
            index:    i,
          },
          status:     'pending',
          priority:   0,
          created_by: user!.userId,
        })
      }
    }
  }

  if (printJobs.length > 0) {
    await supabase.from('print_queue').insert(printJobs)
  }

  return ApiResponse.success({
    ticketId:      ticket.id,
    kitchenItems:  kitchenItems.length,
    barItems:      barItems.length,
    labelItems:    labelItems.reduce((s: number, i: any) => s + i.quantity, 0),
    printJobs:     printJobs.length,
  })
}

/**
 * GET /api/kitchen — Màn hình bếp lấy danh sách ticket
 */
export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin', 'waiter', 'chef'])
  if (error) return error

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'sent,acknowledged'

  const { data, error: dbError } = await supabase
    .from('kitchen_tickets')
    .select(`
      id, status, sent_at, note, items_snapshot,
      orders ( id, note ),
      tables ( table_number ),
      users!kitchen_tickets_sent_by_fkey ( full_name )
    `)
    .in('status', status.split(','))
    .order('sent_at', { ascending: true })

  if (dbError) return ApiResponse.error('Không thể tải phiếu bếp')
  return ApiResponse.success(data)
}

/**
 * PATCH /api/kitchen — Bếp xác nhận / hoàn thành ticket
 */
export async function PATCH(request: NextRequest) {
  const { user, error } = requireRole(request, ['admin', 'chef', 'waiter'])
  if (error) return error

  const { ticketId, action } = await request.json()
  if (!ticketId || !action) return ApiResponse.error('Thiếu thông tin')

  const ACTION_MAP: Record<string, string> = {
    acknowledge: 'acknowledged',
    complete:    'completed',
    cancel:      'cancelled',
    dismiss:     'dismissed',
  }
  const newStatus = ACTION_MAP[action]
  if (!newStatus) return ApiResponse.error('Action không hợp lệ')

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const updateData: any = { status: newStatus }

  if (newStatus === 'acknowledged') {
    updateData.acknowledged_by = user!.userId
    updateData.acknowledged_at = now
  } else if (newStatus === 'completed') {
    updateData.completed_by = user!.userId
    updateData.completed_at = now
  }

  const { data, error: dbError } = await supabase
    .from('kitchen_tickets')
    .update(updateData)
    .eq('id', ticketId)
    .select()
    .single()

  if (dbError) return ApiResponse.error('Không thể cập nhật phiếu bếp')

  if (newStatus === 'acknowledged') {
    await supabase.from('orders').update({ status: 'preparing' }).eq('id', data.order_id)
  } else if (newStatus === 'completed') {
    await supabase.from('orders').update({ status: 'served' }).eq('id', data.order_id)
  }

  return ApiResponse.success(data)
}

// ── Helpers tạo nội dung in ESC/POS ──────────────────────────

function buildKitchenReceipt({ tableNumber, timeStr, items, note }: any) {
  return [
    '================================',
    '      PHIEU CHE BIEN - BEP',
    '================================',
    `Ban: ${tableNumber}          ${timeStr}`,
    '--------------------------------',
    ...items.map((i: any) =>
      `${i.quantity}x ${i.products?.name ?? ''}` +
      (i.notes ? `\n   -> ${i.notes}` : '')
    ),
    '--------------------------------',
    note ? `Ghi chu: ${note}` : '',
    '================================\n',
  ].filter(Boolean).join('\n')
}

function buildBarReceipt({ tableNumber, timeStr, items }: any) {
  return [
    '================================',
    '      PHIEU PHA CHE - BAR',
    '================================',
    `Ban: ${tableNumber}          ${timeStr}`,
    '--------------------------------',
    ...items.map((i: any) =>
      `${i.quantity}x ${i.products?.name ?? ''}` +
      (i.notes ? `\n   -> ${i.notes}` : '')
    ),
    '================================\n',
  ].join('\n')
}

function buildLabelReceipt({ tableNumber, timeStr, itemName, notes, index, total }: any) {
  return [
    `[${tableNumber}] ${timeStr}`,
    itemName.substring(0, 18),
    notes ? notes.substring(0, 18) : '',
    total > 1 ? `(${index}/${total})` : '',
  ].filter(Boolean).join('\n')
}