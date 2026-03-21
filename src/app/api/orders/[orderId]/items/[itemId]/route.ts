// src/app/api/orders/[orderId]/items/[itemId]/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ApiResponse, requireRole } from '@/utils/api'

const BAR_CATEGORIES = ['Đồ uống', 'Đồ uống có cồn']

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; itemId: string }> }
) {
  const { user, error } = requireRole(request, ['admin', 'waiter'])
  if (error) return error

  const { orderId, itemId } = await params
  const orderIdInt = parseInt(orderId)
  const itemIdInt  = parseInt(itemId)
  if (isNaN(orderIdInt) || isNaN(itemIdInt)) return ApiResponse.error('ID không hợp lệ')

  // Lấy số lượng muốn hủy từ body
  const body = await request.json().catch(() => ({}))
  const cancelQty: number = body.cancelQty ?? 1
  const reason: string    = body.reason ?? 'Không rõ'
  
  if (cancelQty < 1) return ApiResponse.error('Số lượng hủy không hợp lệ')

  const supabase = createAdminClient()

  // Lấy order + item
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id, status, table_id, total_price,
      tables ( table_number ),
      order_items (
        id, quantity, subtotal, notes,
        products ( id, name, price,
          categories ( name )
        )
      )
    `)
    .eq('id', orderIdInt)
    .single()

  if (orderError || !order) return ApiResponse.notFound('Đơn hàng')

  const item = (order.order_items as any[]).find(i => i.id === itemIdInt)
  if (!item) return ApiResponse.notFound('Món trong đơn hàng')

  /*if (['paid', 'cancelled'].includes(order.status)) {
    return ApiResponse.error('Không thể hủy món khi đơn hàng đã hoàn tất')
  }*/

  // Không cho hủy quá số lượng hiện có
  const actualCancelQty = Math.min(cancelQty, item.quantity)
  const remainQty       = item.quantity - actualCancelQty
  const unitPrice       = item.products?.price ?? 0
  const tableNumber     = (order as any).tables?.table_number ?? '?'
  const productName     = item.products?.name ?? '?'
  const catName         = item.products?.categories?.name ?? ''
  const printerType     = BAR_CATEGORIES.includes(catName) ? 'bar' : 'kitchen'

  // ── Trường hợp 1: Chưa báo bếp (pending) ──────────────────
  if (order.status === 'pending') {
    if (remainQty === 0) {
      // lưu lý do hủy truớc khi xóa
      console.log('reason trước update:', reason, 'itemIdInt:', itemIdInt)
      console.log('itemIdInt:', itemIdInt, 'remainQty:', remainQty, 'actualCancelQty:', actualCancelQty)
      await supabase.from('order_items').update({
      quantity: 0,subtotal  : 0,
      cancelled_qty: (item.cancelled_qty?? 0) + actualCancelQty,
        cancel_reason: reason,
       
      }).eq('id', itemIdInt)
     // bỏ hàm xóa vì Luôn phải lưu data không thể xóa được để biết ai hủy và hủy lý do gì
    } else {
      // Hủy 1 phần → giảm số lượng
      console.log('reason trước update:', reason, 'itemIdInt:', itemIdInt)
      console.log('itemIdInt:', itemIdInt, 'remainQty:', remainQty, 'actualCancelQty:', actualCancelQty)
        const { error } = await supabase.from('order_items')     
        .update({ quantity: remainQty,
           subtotal: unitPrice * remainQty,
           cancelled_qty: (item.cancelled_qty?? 0) + actualCancelQty,
           cancel_reason: reason
               })
        .eq('id', itemIdInt)
        console.log('Update error:', error)  // ← thêm dòng này
        
    }

    // Tính lại total
    const { data: updatedItems } = await supabase
      .from('order_items').select('subtotal').eq('order_id', orderIdInt)
    const newTotal = (updatedItems ?? []).reduce((s: number, i: any) => s + i.subtotal, 0)

    if (newTotal === 0) {
      // Không còn món → hủy order + bàn về trống
      await supabase.from('orders').update({ status: 'cancelled', total_price: 0 }).eq('id', orderIdInt)
      await supabase.from('tables').update({ status: 'available' }).eq('id', order.table_id)
      return ApiResponse.success({ action: 'order_cancelled', message: 'Đã hủy món cuối — đơn hàng bị hủy, bàn về trống', newTotal: 0 })
    }
// Thêm vào cả 2 trường hợp — sau khi tính lại total:

// Tạo kitchen_ticket thông báo hủy món
await supabase.from('kitchen_tickets').insert({
  order_id:       orderIdInt,
  table_id:       order.table_id,
  sent_by:        user!.userId,
  items_snapshot: [{
    name:     productName,
    quantity: actualCancelQty,
    notes:    `⚠️ HỦY — ${reason}`,
    category: catName,
  }],
  note:   `HỦY MÓN: ${actualCancelQty}x ${productName} — ${reason}`,
  status: 'cancelled',  // ← trạng thái đặc biệt để UI hiện màu đỏ
})

const cancelContent = buildCancelReceipt(tableNumber, productName, actualCancelQty, cancelQty, reason)

const { data: ticket } = await supabase
  .from('kitchen_tickets').select('id')
  .eq('order_id', orderIdInt)
  .order('sent_at', { ascending: false })
  .limit(1).single()

await supabase.from('print_queue').insert({
  ticket_id:    ticket?.id ?? null,
  order_id:     orderIdInt,
  printer_type: printerType,
  content:      cancelContent,
  content_json: { type: 'cancel', productName, cancelQty: actualCancelQty, remainQty, reason },
  status:       'pending',
  priority:     2,
  created_by:   user!.userId,
})

    await supabase.from('orders').update({ total_price: newTotal }).eq('id', orderIdInt)
    return ApiResponse.success({ action: 'item_reduced', message: `Đã hủy ${actualCancelQty} ${productName}`, newTotal })
  }

  // ── Trường hợp 2: Đã báo bếp (sent_to_kitchen / preparing) ──
  //if (['sent_to_kitchen', 'preparing'].includes(order.status)) 
    // Cho phép hủy nhưng phải gửi phiếu hủy về bếp/bar{

    // Cập nhật số lượng trong order_items
    if (remainQty === 0) {
      console.log('reason trước update:', reason, 'itemIdInt:', itemIdInt)
      console.log('itemIdInt:', itemIdInt, 'remainQty:', remainQty, 'actualCancelQty:', actualCancelQty)
      const { data: updateData, error: updateErr } =await supabase.from('order_items').update({
        quantity: 0,
        subtotal: 0,
        cancelled_qty: (item.cancelled_qty?? 0) + actualCancelQty,
        cancel_reason: reason
      }).eq('id', itemIdInt)
      .select()  // ← thêm .select() để xem data trả về
      console.log('updateData:', updateData)  // xem data sau khi update
      console.log('updateErr:', updateErr)  // xem lỗi trả về
     // bỏ hàm xóa vì Luôn phải lưu data không thể xóa được để biết ai hủy và hủy lý do gì
    }
     else {
      console.log('reason trước update:', reason, 'itemIdInt:', itemIdInt)
      console.log('itemIdInt:', itemIdInt, 'remainQty:', remainQty, 'actualCancelQty:', actualCancelQty)
       const { data: updateData, error: updateErr } = await supabase.from('order_items')     
       
        .update({ quantity: remainQty,
           subtotal: unitPrice * remainQty,
           cancelled_qty: (item.cancelled_qty?? 0) + actualCancelQty,
           cancel_reason: reason })
        .eq('id', itemIdInt)
        
        
   }

    // Tính lại total
    console.log('reason trước update tính lại total:', reason, 'itemIdInt:', itemIdInt)
    const { data: updatedItems } = await supabase
      .from('order_items').select('subtotal').eq('order_id', orderIdInt)
    const newTotal = (updatedItems ?? []).reduce((s: number, i: any) => s + i.subtotal, 0)

    if (newTotal === 0) {
      await supabase.from('orders').update({ status: 'cancelled', total_price: 0 }).eq('id', orderIdInt)
      await supabase.from('tables').update({ status: 'available' }).eq('id', order.table_id)
    } else {
      await supabase.from('orders').update({ total_price: newTotal }).eq('id', orderIdInt)
    }
// Thêm vào cả 2 trường hợp — sau khi tính lại total:

// Tạo kitchen_ticket thông báo hủy món
await supabase.from('kitchen_tickets').insert({
  order_id:       orderIdInt,
  table_id:       order.table_id,
  sent_by:        user!.userId,
  items_snapshot: [{
    name:     productName,
    quantity: actualCancelQty,
    notes:    `⚠️ HỦY — ${reason}`,
    category: catName,
  }],
  note:   `HỦY MÓN: ${actualCancelQty}x ${productName} — ${reason}`,
  status: 'cancelled',  // ← trạng thái đặc biệt để UI hiện màu đỏ
})
    // Lấy ticket gần nhất
    const { data: ticket } = await supabase
      .from('kitchen_tickets').select('id')
      .eq('order_id', orderIdInt)
      .order('sent_at', { ascending: false })
      .limit(1).single()

    // In phiếu hủy với đúng số lượng bị hủy
    const cancelContent = buildCancelReceipt(tableNumber, productName, actualCancelQty, cancelQty, reason)

    await supabase.from('print_queue').insert({
      ticket_id:    ticket?.id ?? null,
      order_id:     orderIdInt,
      printer_type: printerType,
      content:      cancelContent,
      content_json: { type: 'cancel', productName, cancelQty: actualCancelQty, remainQty },
      status:       'pending',
      priority:     2,
      created_by:   user!.userId,
    })

    return ApiResponse.success({
      action:  newTotal === 0 ? 'order_cancelled' : 'item_reduced_with_notice',
      message: `Đã hủy ${actualCancelQty} ${productName} — gửi phiếu HỦY đến ${printerType === 'bar' ? 'bar' : 'bếp'}`,
      newTotal,
    })
  }

  
  //return ApiResponse.error('Không thể hủy món ở trạng thái này')
//}

function buildCancelReceipt(tableNumber: string, productName: string, cancelQty: number, totalCancelQty: number, reason: string): string {
  const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return [
    '================================',
    '   *** HUY MON - CANCEL ***',
    '================================',
    `Ban: ${tableNumber}        ${time}`,
    '--------------------------------',
    `HUY: ${cancelQty}x ${productName}`,
    '--------------------------------',
    `Ly do: ${reason}`,
    '  XIN LOI VI SU THAY DOI NAY',
    '================================',
    '',
  ].join('\n')
}