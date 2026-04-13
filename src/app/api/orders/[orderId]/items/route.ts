// src/app/api/orders/[orderId]/items/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/utils/api'
import { ApiResponse } from '@/utils/api-response' // Chuẩn hóa response API
import { requirePermission } from '@/utils/api-auth'
const BAR_CATEGORIES = ['Đồ uống', 'Đồ uống có cồn']

// POST /api/orders/[orderId]/items — Thêm món vào order đang có
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { user, error } = await requirePermission(request, 'orders.update')
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
  // Đổi priceMap lookup — thêm variant support
  const productIds = [...new Set(items.map((i: any) => i.productId))]
  const variantIds = items.map((i: any) => i.variantId).filter(Boolean)

  // Lấy giá thật từ DB — không tin giá từ client
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, price')
    .in('id', productIds)

  if (prodError || !products) return ApiResponse.error('Không thể xác minh giá món')
  let variantPriceMap: Record<number, number> = {}
  if (variantIds.length > 0) {
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, price')
      .in('id', variantIds)
    variantPriceMap = Object.fromEntries((variants ?? []).map((v) => [v.id, v.price]))
  }
  const priceMap = Object.fromEntries((products ?? []).map((p) => [p.id, p.price]))
  async function getItemInfo(productId: number, variantId?: number) {
    if (variantId) {
      const { data: variant } = await supabase
        .from('product_variants')
        .select('price, name')
        .eq('id', variantId)
        .single()

      return {
        // Nếu không tìm thấy variant, mặc định là 0đ để tránh lỗi NaN
        price: variant?.price ?? 0,
        // Trả về tên Variant (ví dụ: "Size L")
        name: variant?.name ?? null,
      }
    } else {
      const { data: product } = await supabase
        .from('products')
        .select('price') // Chỉ cần lấy price, không cần lấy name ở đây
        .eq('id', productId)
        .single()

      return {
        price: product?.price ?? 0,
        // Không có variant thì để null, để tránh ghi đè tên món vào cột variant_name
        name: null,
      }
    }
  }
  const getItemPrice = (item: any) =>
    item.variantId
      ? (variantPriceMap[item.variantId] ?? priceMap[item.productId] ?? 0)
      : (priceMap[item.productId] ?? 0)

  //

  // Kiểm tra tất cả productId đều hợp lệ
  for (const item of items) {
    if (!priceMap[item.productId]) {
      return ApiResponse.error(`Món ID ${item.productId} không tồn tại`)
    }
  }

  // INSERT order_items mới
  // Dùng Promise.all để chạy song song việc lấy giá/tên cho tất cả món trong giỏ
  const newItems = await Promise.all(
    items.map(async (item: any) => {
      const info = await getItemInfo(item.productId, item.variantId)

      return {
        order_id: orderIdInt,
        product_id: item.productId,
        variant_id: item.variantId ?? null,
        // Lấy name từ info (nếu là variant thì có tên, nếu không thì null)
        variant_name: info.name,
        quantity: item.quantity,
        // Tính tiền chuẩn từ giá Backend tra được
        subtotal: info.price * item.quantity,
        notes: item.notes ?? '',
      }
    }),
  )

  // --- BƯỚC 3: INSERT VÀO DATABASE ---

  const insertedItems = []

  for (const item of newItems) {
    // 1. Tìm xem món này (cùng Size) đã có trong Order chưa
    const { data: existing } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', item.order_id)
      .eq('product_id', item.product_id)
      .eq('variant_id', item.variant_id)
      .maybeSingle()

    if (existing) {
      // 2. Nếu có rồi -> Cộng dồn số lượng và tính lại tiền
      const newQty = existing.quantity + item.quantity
      const { data: updated, error: upError } = await supabase
        .from('order_items')
        .update({
          quantity: newQty,
          subtotal: newQty * (item.subtotal / item.quantity), // Lấy đơn giá chuẩn
        })
        .eq('id', existing.id)
        .select(`*, products (id, name, print_kitchen, print_bar, print_label, categories (name))`)
        .single()

      if (updated) insertedItems.push(updated)
    } else {
      // 3. Nếu chưa có -> Thêm mới bình thường
      const { data: inserted } = await supabase
        .from('order_items')
        .insert(item)
        .select(`*, products (id, name, print_kitchen, print_bar, print_label, categories (name))`)
        .single()

      if (inserted) insertedItems.push(inserted)
    }
  }

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

    // select thêm print_kitchen, print_bar, print_label
    const kitchenItems = addedItems.filter((i: any) => i.products?.print_kitchen)
    const barItems = addedItems.filter((i: any) => i.products?.print_bar)
    const labelItems = addedItems.filter((i: any) => i.products?.print_label)

    const tableNumber = (order as any).tables?.table_number ?? '?'
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

    // Snapshot chỉ gồm món mới thêm
    const itemsSnapshot = (addedItems ?? []).map((i: any) => ({
      order_item_id: i.id, // ← thêm để kitchen filter đúng
      name: i.products?.name ?? '?',
      quantity: i.quantity,
      notes: i.notes ?? '',
      category: i.products?.categories?.name ?? '',
      variant_name: i.variant_name ?? null, // ← thêm
    }))

    // Tạo kitchen_ticket
    const { data: ticket } = await supabase
      .from('kitchen_tickets')
      .insert({
        order_id: orderIdInt,
        table_id: order.table_id,
        sent_by: user!.id,
        items_snapshot: itemsSnapshot,
        note: '⚡ Món thêm',
        status: 'sent',
      })
      .select()
      .single()

    // Tạo print_queue
    const printJobs: any[] = []

    if (kitchenItems.length > 0) {
      printJobs.push({
        ticket_id: ticket?.id ?? null,
        order_id: orderIdInt,
        printer_type: 'kitchen',
        content: buildAddItemsReceipt(tableNumber, kitchenItems, timeStr),
        content_json: { tableNumber, items: kitchenItems },
        status: 'pending',
        priority: 1,
        created_by: user!.id,
      })
    }

    if (barItems.length > 0) {
      printJobs.push({
        ticket_id: ticket?.id ?? null,
        order_id: orderIdInt,
        printer_type: 'bar',
        content: buildAddItemsReceipt(tableNumber, barItems, timeStr, 'BAR'),
        content_json: { tableNumber, items: barItems },
        status: 'pending',
        priority: 1,
        created_by: user!.id,
      })

      // Tem từng ly mới thêm
      for (const item of barItems as any[]) {
        for (let i = 0; i < item.quantity; i++) {
          printJobs.push({
            ticket_id: ticket?.id ?? null,
            order_id: orderIdInt,
            printer_type: 'label',
            content: `Bàn: ${tableNumber}\n${item.products?.name}\n${item.notes ?? ''}\nLy ${i + 1}/${item.quantity}\n${timeStr}`,
            content_json: {
              tableNumber,
              productName: item.products?.name,
              notes: item.notes,
              cup: i + 1,
              total: item.quantity,
            },
            status: 'pending',
            priority: 0,
            created_by: user!.id,
          })
        }
      }
    }

    if (printJobs.length > 0) {
      await supabase.from('print_queue').insert(printJobs)
    }

    // Cập nhật order status → sent_to_kitchen
    await supabase.from('orders').update({ status: 'sent_to_kitchen' }).eq('id', orderIdInt)
  }

  return ApiResponse.success({
    message: sendToKitchen ? 'Đã thêm món và báo bếp!' : 'Đã thêm món vào đơn hàng',
    newTotal,
    itemsAdded: newItems.length,
  })
}

function buildAddItemsReceipt(
  tableNumber: string,
  items: any[],
  timeStr: string,
  type = 'BEP',
): string {
  return [
    '================================',
    `     *** MON THEM - ${type} ***`,
    '================================',
    `Ban: ${tableNumber}        ${timeStr}`,
    '--------------------------------',
    ...items.map((i: any) => {
      // Thêm hiển thị Size (Variant) vào dòng in
      const variantSuffix = i.variant_name ? ` (${i.variant_name})` : ''
      return (
        `${i.quantity}x ${i.products?.name ?? '?'}${variantSuffix}` +
        (i.notes ? `\n   >> ${i.notes}` : '')
      )
    }),
    '================================',
    '',
  ].join('\n')
}
