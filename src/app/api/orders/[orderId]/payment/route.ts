// src/app/api/orders/[orderId]/payment/route.ts
// Xử lý thanh toán đơn hàng
// Sau khi paid: cập nhật order, trả bàn về available, in bill, trừ tồn kho nguyên liệu

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/utils/api'
import { ApiResponse } from '@/utils/api-response' // Chuẩn hóa response API

// POST /api/orders/[orderId]/payment — Thanh toán
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { user, error } = requireRole(request, ['admin', 'waiter'])
  if (error) return error

  const { orderId } = await params
  const orderIdInt = parseInt(orderId)
  if (isNaN(orderIdInt)) return ApiResponse.error('orderId không hợp lệ')

  const body = await request.json()
  const {
    paymentMethod = 'cash',
    discountType = 'none',
    discountValue = 0,
    amountReceived = 0,
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
    discountAmount = Math.round((order.total_price * discountValue) / 100)
  } else if (discountType === 'amount') {
    discountAmount = Math.min(discountValue, order.total_price)
  }

  const finalAmount = order.total_price - discountAmount
  const changeAmount = paymentMethod === 'cash' ? Math.max(0, amountReceived - finalAmount) : 0

  if (paymentMethod === 'cash' && amountReceived < finalAmount) {
    return ApiResponse.error(
      `Tiền nhận (${amountReceived.toLocaleString()}đ) < Tổng cần thanh toán (${finalAmount.toLocaleString()}đ)`,
    )
  }

  // Cập nhật order → paid
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'paid',
      payment_status: 'paid',
      payment_method: paymentMethod,
      discount_amount: discountAmount,
      note: note || null,
    })
    .eq('id', orderIdInt)

  if (updateError) return ApiResponse.error('Không thể cập nhật thanh toán')

  // Bàn về available
  await supabase.from('tables').update({ status: 'available' }).eq('id', order.table_id)

  // Lấy order_items để in bill và trừ tồn kho
  const { data: items } = await supabase
    .from('order_items')
    .select('quantity, subtotal, product_id, products(name)')
    .eq('order_id', orderIdInt)

  // ── Trừ tồn kho nguyên liệu ──────────────────────────────────────────────
  // Logic: lấy recipes của từng món → tính quantity_needed × số lượng bán
  // Nguyên liệu có thể âm — cảnh báo nhưng không chặn (bếp có thể thay thế)
  await deductIngredientStock(supabase, items ?? [])

  // In bill
  const tableNumber = (order as any).tables?.table_number ?? '?'
  const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  console.log('[payment] inserting print_queue job...')

  await supabase.from('print_queue').insert({
    order_id: orderIdInt,
    printer_type: 'cashier',
    content: buildBillReceipt({
      tableNumber,
      timeStr,
      items: items ?? [],
      totalPrice: order.total_price,
      discountAmount,
      finalAmount,
      paymentMethod,
      amountReceived,
      changeAmount,
    }),
    content_json: {
      type: 'bill',
      tableNumber,
      totalPrice: order.total_price,
      discountAmount,
      finalAmount,
      paymentMethod,
      amountReceived,
      changeAmount,
    },
    status: 'pending',
    priority: 1,
    created_by: user!.userId,
  })

  return ApiResponse.success({
    message: 'Thanh toán thành công!',
    finalAmount,
    discountAmount,
    changeAmount,
    paymentMethod,
    tableNumber,
  })
}

/**
 * deductIngredientStock — trừ tồn kho nguyên liệu sau khi thanh toán
 * Lấy công thức (recipes) của từng món → tính tổng nguyên liệu cần → UPDATE stock
 * Cho phép âm — không throw error để không ảnh hưởng flow thanh toán
 */
async function deductIngredientStock(supabase: any, items: any[]) {
  if (!items.length) return

  try {
    // Lấy toàn bộ recipes của các món trong order
    const productIds = [...new Set(items.map((i) => i.product_id))]
    const { data: recipes } = await supabase
      .from('recipes')
      .select('product_id, ingredient_id, quantity_needed')
      .in('product_id', productIds)

    if (!recipes?.length) return

    // Tính tổng nguyên liệu cần trừ: Map<ingredient_id, total_quantity>
    const deductMap = new Map<number, number>()

    for (const item of items) {
      const itemRecipes = recipes.filter((r: any) => r.product_id === item.product_id)
      for (const recipe of itemRecipes) {
        const current = deductMap.get(recipe.ingredient_id) ?? 0
        // Số lượng cần trừ = định lượng / 1 phần × số lượng bán
        deductMap.set(recipe.ingredient_id, current + recipe.quantity_needed * item.quantity)
      }
    }

    if (!deductMap.size) return

    // Lấy tồn kho hiện tại của các nguyên liệu cần trừ
    const ingredientIds = [...deductMap.keys()]
    const { data: ingredients } = await supabase
      .from('ingredients')
      .select('id, stock_quantity')
      .in('id', ingredientIds)

    if (!ingredients?.length) return

    // UPDATE từng nguyên liệu — cho phép âm
    await Promise.all(
      ingredients.map((ing: any) => {
        const deduct = deductMap.get(ing.id) ?? 0
        const newQty = ing.stock_quantity - deduct
        return supabase
          .from('ingredients')
          .update({
            stock_quantity: newQty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ing.id)
      }),
    )
  } catch (err) {
    // Log lỗi nhưng không throw — không để trừ kho fail ảnh hưởng thanh toán
    console.error('[payment] deductIngredientStock error:', err)
  }
}

function buildBillReceipt({
  tableNumber,
  timeStr,
  items,
  totalPrice,
  discountAmount,
  finalAmount,
  paymentMethod,
  amountReceived,
  changeAmount,
}: any): string {
  const METHOD: Record<string, string> = {
    cash: 'Tien mat',
    transfer: 'Chuyen khoan',
    card: 'The',
  }
  return [
    '================================',
    '         HOA DON THANH TOAN',
    '================================',
    `Ban: ${tableNumber}        ${timeStr}`,
    '--------------------------------',
    ...(items ?? []).map(
      (i: any) =>
        `${i.quantity}x ${i.products?.name ?? '?'}`.padEnd(22) +
        `${i.subtotal.toLocaleString('vi-VN')}d`,
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
  ]
    .filter((l) => l !== '')
    .join('\n')
}
