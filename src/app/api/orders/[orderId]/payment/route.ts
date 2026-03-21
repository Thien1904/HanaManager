// src/app/api/orders/[orderId]/payment/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ApiResponse, requireRole } from '@/utils/api'

// POST /api/orders/[orderId]/payment — Thanh toán
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
  const {
    paymentMethod = 'cash',   // cash | transfer | card
    discountType  = 'none',   // none | percent | amount
    discountValue = 0,        // % hoặc số tiền
    amountReceived = 0,       // Số tiền khách đưa (chỉ cần cho tiền mặt)
    note = '',
  } = body

  const supabase = createAdminClient()

  // Lấy order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, total_price, table_id, tables(table_number)')
    .eq('id', orderIdInt)
    .single()

  if (orderError || !order) return ApiResponse.notFound('Đơn hàng')

  if (order.status === 'paid') return ApiResponse.error('Đơn hàng đã được thanh toán')
  if (order.status === 'cancelled') return ApiResponse.error('Đơn hàng đã bị hủy')

  // Tính tiền giảm giá
  let discountAmount = 0
  if (discountType === 'percent') {
    discountAmount = Math.round(order.total_price * discountValue / 100)
  } else if (discountType === 'amount') {
    discountAmount = Math.min(discountValue, order.total_price) // không giảm quá tổng tiền
  }

  const finalAmount  = order.total_price - discountAmount
  const changeAmount = paymentMethod === 'cash'
    ? Math.max(0, amountReceived - finalAmount)
    : 0

  // Validate tiền mặt
  if (paymentMethod === 'cash' && amountReceived < finalAmount) {
    return ApiResponse.error(`Tiền nhận (${amountReceived.toLocaleString()}đ) < Tổng cần thanh toán (${finalAmount.toLocaleString()}đ)`)
  }

  // Cập nhật order → paid
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status:          'paid',
      payment_status:  'paid',
      payment_method:  paymentMethod,
      discount_amount: discountAmount,
      note:            note || null,
    })
    .eq('id', orderIdInt)

  if (updateError) return ApiResponse.error('Không thể cập nhật thanh toán')

  // Bàn về available
  await supabase
    .from('tables')
    .update({ status: 'available' })
    .eq('id', order.table_id)

  // Tạo print_queue in bill
  const tableNumber = (order as any).tables?.table_number ?? '?'
  const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  // Lấy order_items để in bill đầy đủ
  const { data: items } = await supabase
    .from('order_items')
    .select('quantity, subtotal, products(name)')
    .eq('order_id', orderIdInt)

  await supabase.from('print_queue').insert({
    order_id:     orderIdInt,
    printer_type: 'cashier',
    content:      buildBillReceipt({
      tableNumber, timeStr, items: items ?? [],
      totalPrice: order.total_price, discountAmount,
      finalAmount, paymentMethod, amountReceived, changeAmount,
    }),
    content_json: {
      type: 'bill', tableNumber, totalPrice: order.total_price,
      discountAmount, finalAmount, paymentMethod, amountReceived, changeAmount,
    },
    status:     'pending',
    priority:   1,
    created_by: user!.userId,
  })

  return ApiResponse.success({
    message:       'Thanh toán thành công!',
    finalAmount,
    discountAmount,
    changeAmount,
    paymentMethod,
    tableNumber,
  })
}

function buildBillReceipt({
  tableNumber, timeStr, items, totalPrice,
  discountAmount, finalAmount, paymentMethod,
  amountReceived, changeAmount
}: any): string {
  const METHOD: Record<string, string> = {
    cash:     'Tien mat',
    transfer: 'Chuyen khoan',
    card:     'The',
  }
  return [
    '================================',
    '         HOA DON THANH TOAN',
    '================================',
    `Ban: ${tableNumber}        ${timeStr}`,
    '--------------------------------',
    ...(items ?? []).map((i: any) =>
      `${i.quantity}x ${i.products?.name ?? '?'}`
        .padEnd(22) + `${i.subtotal.toLocaleString('vi-VN')}d`
    ),
    '--------------------------------',
    `Tong:`.padEnd(22) + `${totalPrice.toLocaleString('vi-VN')}d`,
    discountAmount > 0
      ? `Giam gia:`.padEnd(22) + `-${discountAmount.toLocaleString('vi-VN')}d`
      : '',
    `Thanh toan:`.padEnd(22) + `${finalAmount.toLocaleString('vi-VN')}d`,
    '--------------------------------',
    `PT: ${METHOD[paymentMethod] ?? paymentMethod}`,
    paymentMethod === 'cash'
      ? `Nhan:`.padEnd(22) + `${amountReceived.toLocaleString('vi-VN')}d`
      : '',
    paymentMethod === 'cash'
      ? `Tra lai:`.padEnd(22) + `${changeAmount.toLocaleString('vi-VN')}d`
      : '',
    '================================',
    '       Cam on quy khach!',
    '       Hen gap lai!',
    '================================',
    '',
  ].filter(l => l !== '').join('\n')
}