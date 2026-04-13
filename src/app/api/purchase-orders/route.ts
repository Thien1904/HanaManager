// src/app/api/purchase-orders/route.ts
// Quản lý đơn nhập nguyên liệu — CRUD bảng purchase_orders + purchase_order_items
// Khi xác nhận đơn (status = received) → tự động cộng vào stock_quantity

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, assert } from '@/utils/api'
import { ApiResponse } from '@/utils/api-response' // Chuẩn hóa response API
/**
 * GET /api/purchase-orders — Lấy danh sách đơn nhập hàng
 * Query: ?status=pending|received|cancelled (optional)
 */
export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const supabase = createAdminClient()
    let query = supabase
      .from('purchase_orders')
      .select(
        `
        id, total_amount, status, created_at,
        suppliers ( id, name, phone ),
        users ( id, full_name ),
        purchase_order_items (
          id, quantity, unit_price,
          ingredients ( id, name, unit )
        )
      `,
      )
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error: dbError } = await query
    if (dbError) throw dbError
    return ApiResponse.success(data)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * POST /api/purchase-orders — Tạo đơn nhập hàng mới (status = pending)
 * Body: { supplier_id, items: [{ ingredient_id, quantity, unit_price }] }
 */
export async function POST(request: NextRequest) {
  const { user, error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { supplier_id, items } = await request.json()

    assert(supplier_id, 'Chọn nhà cung cấp')
    assert(items?.length > 0, 'Thêm ít nhất 1 nguyên liệu')

    // Validate từng item
    for (const item of items) {
      assert(item.ingredient_id, 'Thiếu ingredient_id')
      assert(item.quantity > 0, 'Số lượng phải lớn hơn 0')
      assert(item.unit_price >= 0, 'Đơn giá không được âm')
    }

    // Tính tổng tiền
    const totalAmount = items.reduce((sum: number, i: any) => sum + i.quantity * i.unit_price, 0)

    const supabase = createAdminClient()

    // Tạo đơn nhập
    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .insert({
        supplier_id: Number(supplier_id),
        user_id: user!.userId,
        total_amount: totalAmount,
        status: 'pending',
      })
      .select('id')
      .single()

    if (orderError) throw orderError

    // Tạo các dòng chi tiết
    const { error: itemsError } = await supabase.from('purchase_order_items').insert(
      items.map((i: any) => ({
        purchase_order_id: order.id,
        ingredient_id: Number(i.ingredient_id),
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    )

    if (itemsError) throw itemsError

    return ApiResponse.success({ id: order.id }, 201)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * PUT /api/purchase-orders — Cập nhật trạng thái đơn nhập
 * Body: { id, status: 'received' | 'cancelled' }
 * Khi status = received → cộng số lượng vào stock_quantity của từng nguyên liệu
 */
export async function PUT(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { id, status } = await request.json()

    assert(id, 'Thiếu id')
    assert(status, 'Thiếu status')
    assert(
      ['completed', 'cancelled'].includes(status),
      'Status không hợp lệ — chỉ chấp nhận completed hoặc cancelled',
    )

    const supabase = createAdminClient()

    // Kiểm tra đơn hiện tại
    const { data: order } = await supabase
      .from('purchase_orders')
      .select('id, status, purchase_order_items(ingredient_id, quantity)')
      .eq('id', Number(id))
      .single()

    assert(order, 'Không tìm thấy đơn nhập')
    assert(order.status === 'pending', 'Chỉ có thể cập nhật đơn đang chờ')

    // Cập nhật status đơn
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({ status })
      .eq('id', Number(id))

    if (updateError) throw updateError

    // Nếu received → cộng tồn kho
    if (status === 'completed') {
      await addIngredientStock(supabase, order.purchase_order_items ?? [])
    }

    return ApiResponse.success({ id: Number(id), status })
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * DELETE /api/purchase-orders — Xóa đơn nhập (chỉ xóa được đơn pending)
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { id } = await request.json()
    assert(id, 'Thiếu id')

    const supabase = createAdminClient()

    const { data: order } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('id', Number(id))
      .single()

    assert(order?.status === 'pending', 'Chỉ có thể xóa đơn đang chờ xử lý')

    // Xóa items trước (FK constraint)
    await supabase.from('purchase_order_items').delete().eq('purchase_order_id', Number(id))
    await supabase.from('purchase_orders').delete().eq('id', Number(id))

    return ApiResponse.success({ id: Number(id) })
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * addIngredientStock — cộng số lượng vào stock khi đơn được xác nhận received
 */
async function addIngredientStock(supabase: any, items: any[]) {
  if (!items.length) return

  // Lấy tồn kho hiện tại
  const ingredientIds = items.map((i: any) => i.ingredient_id)
  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('id, stock_quantity')
    .in('id', ingredientIds)

  if (!ingredients?.length) return

  await Promise.all(
    ingredients.map((ing: any) => {
      const item = items.find((i: any) => i.ingredient_id === ing.id)
      const addQty = item?.quantity ?? 0
      return supabase
        .from('ingredients')
        .update({
          stock_quantity: ing.stock_quantity + addQty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ing.id)
    }),
  )
}
