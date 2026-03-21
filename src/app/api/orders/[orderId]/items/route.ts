// src/app/api/orders/[orderId]/items/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ApiResponse, requireRole } from '@/utils/api'

const BAR_CATEGORIES = ['Đồ uống', 'Đồ uống có cồn']

// POST /api/orders/[orderId]/items — Thêm món vào order đang có
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { user, error } = requireRole(request, ['admin', 'waiter'])
  if (error) return error

  const { orderId } = await params
  const orderIdInt = parseInt(orderId)
  if (isNaN(orderIdInt)) return ApiResponse.error('orderId không hợp lệ')

  const body = await request.json()
  const { items, sendToKitchen = false } = body
  // items: [{ productId, quantity, notes }]
  // sendToKitchen: true → tạo kitchen_ticket luôn sau khi thêm món

  if (!items || items.length === 0) return ApiResponse.error('Chưa chọn món nào')

  const supabase = createAdminClient()

  // Kiểm tra order tồn tại + chưa thanh toán
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, table_id, total_price, tables(table_number)')
    .eq('id', orderIdInt)
    .single()

  if (orderError || !order) return ApiResponse.notFound('Đơn hàng')

  if (['paid', 'cancelled'].includes(order.status)) {
    return ApiResponse.error('Không thể thêm món vào đơn hàng đã hoàn tất')
  }

  // Lấy giá thật từ DB — không tin giá từ client
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, price, name, categories(name)')
    .in('id', items.map((i: any) => i.productId))

  if (prodError || !products) return ApiResponse.error('Không thể xác minh giá món')

  const priceMap = Object.fromEntries(products.map(p => [p.id, p]))

  // Kiểm tra tất cả productId đều hợp lệ
  for (const item of items) {
    if (!priceMap[item.productId]) {
      return ApiResponse.error(`Món ID ${item.productId} không tồn tại`)
    }
  }

  // INSERT order_items mới
  const newItems = items.map((item: any) => ({
    order_id:   orderIdInt,
    product_id: item.productId,
    quantity:   item.quantity,
    subtotal:   priceMap[item.productId].price * item.quantity,
    notes:      item.notes ?? '',
  }))

  const { data: insertedItems, error: insertError } = await supabase
    .from('order_items')
    .insert(newItems)
    .select('id, quantity, notes, product_id, products(id, name, categories(name))')

  if (insertError || !insertedItems) return ApiResponse.error('Không thể thêm món')

  // Tính lại total_price
  const { data: allItems } = await supabase
    .from('order_items')
    .select('subtotal')
    .eq('order_id', orderIdInt)

  const newTotal = (allItems ?? []).reduce((s: number, i: any) => s + i.subtotal, 0)

  // Nếu order đang ở served/preparing → đổi lại pending vì có món mới
  const newStatus = ['served', 'preparing', 'sent_to_kitchen'].includes(order.status)
    ? 'pending'
    : order.status

  await supabase
    .from('orders')
    .update({ total_price: newTotal, status: newStatus })
    .eq('id', orderIdInt)

  // Nếu waiter bấm "Thêm & Báo bếp luôn"
  if (sendToKitchen) {
    // Dùng đúng insertedItems vừa tạo — không query lại tránh lấy nhầm món cũ
    const addedItems = insertedItems

    const foodItems = (addedItems ?? []).filter((i: any) =>
      !BAR_CATEGORIES.includes(i.products?.categories?.name ?? '')
    )
    const barItems = (addedItems ?? []).filter((i: any) =>
      BAR_CATEGORIES.includes(i.products?.categories?.name ?? '')
    )

    const tableNumber = (order as any).tables?.table_number ?? '?'
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

    // Snapshot chỉ gồm món mới thêm
    const itemsSnapshot = (addedItems ?? []).map((i: any) => ({
      name:     i.products?.name ?? '?',
      quantity: i.quantity,
      notes:    i.notes ?? '',
      category: i.products?.categories?.name ?? '',
    }))

    // Tạo kitchen_ticket
    const { data: ticket } = await supabase
      .from('kitchen_tickets')
      .insert({
        order_id:       orderIdInt,
        table_id:       order.table_id,
        sent_by:        user!.userId,
        items_snapshot: itemsSnapshot,
        note:           '⚡ Món thêm',
        status:         'sent',
      })
      .select()
      .single()

    // Tạo print_queue
    const printJobs: any[] = []

    if (foodItems.length > 0) {
      printJobs.push({
        ticket_id:    ticket?.id ?? null,
        order_id:     orderIdInt,
        printer_type: 'kitchen',
        content:      buildAddItemsReceipt(tableNumber, foodItems, timeStr),
        content_json: { tableNumber, items: foodItems },
        status:       'pending',
        priority:     1,
        created_by:   user!.userId,
      })
    }

    if (barItems.length > 0) {
      printJobs.push({
        ticket_id:    ticket?.id ?? null,
        order_id:     orderIdInt,
        printer_type: 'bar',
        content:      buildAddItemsReceipt(tableNumber, barItems, timeStr, 'BAR'),
        content_json: { tableNumber, items: barItems },
        status:       'pending',
        priority:     1,
        created_by:   user!.userId,
      })

      // Tem từng ly mới thêm
      for (const item of barItems as any[]) {
        for (let i = 0; i < item.quantity; i++) {
          printJobs.push({
            ticket_id:    ticket?.id ?? null,
            order_id:     orderIdInt,
            printer_type: 'label',
            content:      `Bàn: ${tableNumber}\n${item.products?.name}\n${item.notes ?? ''}\nLy ${i+1}/${item.quantity}\n${timeStr}`,
            content_json: { tableNumber, productName: item.products?.name, notes: item.notes, cup: i+1, total: item.quantity },
            status:       'pending',
            priority:     0,
            created_by:   user!.userId,
          })
        }
      }
    }

    if (printJobs.length > 0) {
      await supabase.from('print_queue').insert(printJobs)
    }

    // Cập nhật order status → sent_to_kitchen
    await supabase.from('orders')
      .update({ status: 'sent_to_kitchen' })
      .eq('id', orderIdInt)
  }

  return ApiResponse.success({
    message:  sendToKitchen ? 'Đã thêm món và báo bếp!' : 'Đã thêm món vào đơn hàng',
    newTotal,
    itemsAdded: newItems.length,
  })
}

function buildAddItemsReceipt(tableNumber: string, items: any[], timeStr: string, type = 'BEP'): string {
  return [
    '================================',
    `    *** MON THEM - ${type} ***`,
    '================================',
    `Ban: ${tableNumber}        ${timeStr}`,
    '--------------------------------',
    ...items.map((i: any) =>
      `${i.quantity}x ${i.products?.name ?? '?'}` +
      (i.notes ? `\n   >> ${i.notes}` : '')
    ),
    '================================',
    '',
  ].join('\n')
}