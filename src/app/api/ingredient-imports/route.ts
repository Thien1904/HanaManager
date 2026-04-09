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
    // 1. LẤY ĐÚNG DỮ LIỆU: lấy 'items' và 'note' từ request.json()
    const { supplier_id, items, note } = await request.json()

    // 2. KIỂM TRA (ASSERT)
    assert(supplier_id, 'Thiếu nhà cung cấp (supplier_id)')
    assert(Array.isArray(items) && items.length > 0, 'Danh sách nhập hàng không được trống')

    const supabase = createAdminClient()

    // 3. GỌI RPC: 'p_items' nhận nguyên cái mảng 'items'
    const { data, error: dbError } = await supabase.rpc('import_ingredient_bill', {
      p_supplier_id: Number(supplier_id),
      p_note: note || '', // Có note thì dùng, không thì để trống
      p_items: items      // Mảng này chứa các object có package_id, quantity_imported, unit_price
    });

    if (dbError) throw dbError

    // Trả về thành công
    return ApiResponse.success({ message: 'Nhập kho thành công!', data }, 201)

  } catch (err) {
    return ApiResponse.handle(err)
  }
}