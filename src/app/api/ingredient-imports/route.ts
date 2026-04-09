//src/app/api/ingredient-imports/route.ts
// Quản lý phiếu nhập nguyên liệu (theo lô nhiều món)
// Dùng trong trang admin/c để tạo phiếu nhập hàng mới

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ApiResponse, requireRole, assert } from '@/utils/api'

/**
 * POST: Tạo phiếu nhập hàng (Theo lô nhiều món)
 * Body: { supplier_id, note?, items: [{ package_id, quantity_imported, unit_price }] }
 */
export async function POST(request: NextRequest) {
  const { error } = requireRole(request, ['admin', 'chef'])
  if (error) return error

  try {
    const { supplier_id, items } = await request.json()
    const supabase = createAdminClient()

    // 1. TẠO VỎ ĐƠN HÀNG TRỰC TIẾP TẠI ĐÂY
    const { data: order, error: errOrder } = await supabase
      .from('import_orders')
      .insert([{ 
        supplier_id: Number(supplier_id),
        total_amount: items.reduce((sum: number, i: any) => sum + (i.quantity_imported * i.unit_price), 0)
      }])
      .select()
      .single()

    if (errOrder) throw errOrder

    // 2. CHUẨN BỊ DỮ LIỆU ĐỂ INSERT VÀO ingredient_imports
    const payload = items.map((item: any) => ({
      import_order_id: order.id,
      package_id: item.package_id,
      ingredient_id: item.ingredient_id,
      quantity_imported: item.quantity_imported,
      unit_price: item.unit_price,
      conversion_factor: item.conversion_factor // Lấy từ cart truyền lên
    }))

    const { error: errItems } = await supabase
      .from('ingredient_imports')
      .insert(payload)

    if (errItems) throw errItems

    return ApiResponse.success({ message: 'Nhập kho thành công!' }, 201)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}