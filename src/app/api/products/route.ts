// src/app/api/products/route.ts
// Quản lý món ăn: CRUD bảng products
// Bao gồm cấu hình in: print_kitchen, print_bar, print_label
// Trả về kèm variants (size + giá) cho từng món

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, assert } from '@/utils/api'
import { requireAnyPermission, requirePermission } from '@/utils/api-auth'
import { getUserFromRequest } from '@/utils/api-auth'
import { ApiResponse } from '@/utils/api-response'
import { ProductService } from '@/services/product.service'

/**
 * GET /api/products — Lấy danh sách món ăn kèm variants
 * ?all=true → lấy cả món ẩn (admin)
 * ?category_id=1 → filter theo danh mục
 */

export async function GET(request: NextRequest) {
  //const { error } = requireRole(request, ['admin', 'waiter', 'chef'])
  const { error } = requirePermission(request, 'menu.read')
  const user = getUserFromRequest(request)

  //console.log('User Role:', user?.role)
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('category_id')
    const includeUnavailable = searchParams.get('all') === 'true'
    const supabase = createAdminClient()
    const productService = new ProductService(supabase)
    const products = await productService.getProducts({ categoryId, includeUnavailable })
    return ApiResponse.success(products)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

// Helper để format link ảnh từ storage Nếu đã là link tuyệt đối thì giữ nguyên, nếu là path thì thêm prefix STORAGE_URL
const STORAGE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') + '/storage/v1/object/public/products/'

/**
 * POST /api/products — Thêm món mới
 */
export async function POST(request: NextRequest) {
  const { error } = requirePermission(request, 'menu.create')

  if (error) return error

  try {
    const body = await request.json()
    const supabase = createAdminClient()
    const productService = new ProductService(supabase)
    const newProduct = await productService.createProduct(body)
    return ApiResponse.success(newProduct)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * PUT /api/products — Cập nhật món
 */
export async function PUT(request: NextRequest) {
  const { user, error } = requireAnyPermission(request, ['menu.update', 'menu.edit'])
  if (error) return error

  try {
    const body = await request.json()
    const { id } = body
    if (!id) return ApiResponse.error('Thiếu ID sản phẩm', 400)
    const supabase = createAdminClient()
    const productService = new ProductService(supabase)
    const updatedProduct = await productService.updateProduct(Number(id), body)
    console.log('RESULT BEFORE RETURN:', updatedProduct)
    return ApiResponse.success(updatedProduct)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * DELETE /api/products — Soft delete món
 */
/**
export async function DELETE(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { id } = await request.json()
    assert(id, 'Thiếu id')

    const supabase = createAdminClient()

    const { data: product } = await supabase
      .from('products')
      .select('image_url')
      .eq('id', Number(id))
      .single()

    if (product?.image_url) {
      //path saved image in Supabase storage, stored as "products/filename.jpg"
      const path = product.image_url.split('/storage/v1/object/public/products/')[1]
      if (path) await supabase.storage.from('products').remove([path])
    }

    const { error: dbError } = await supabase
      .from('products')
      .update({ is_deleted: true, is_available: false, image_url: null })
      .eq('id', Number(id))

    if (dbError) throw dbError
    return ApiResponse.success({ id: Number(id) })
  } catch (err) {
    return ApiResponse.handle(err)
  }
}
 */
export async function DELETE(request: NextRequest) {
  const { error } = requirePermission(request, 'menu.delete')
  if (error) return error

  try {
    const { id } = await request.json()
    assert(id, 'Thiếu id')
    const supabase = createAdminClient()
    const productService = new ProductService(supabase)
    await productService.deleteProduct(Number(id))
    return ApiResponse.success({ id: Number(id) })
  } catch (err) {
    return ApiResponse.handle(err)
  }
}
// Hàm load product đã xóa (is_deleted = true) để quản lý nếu cần
export async function getDeletedProducts() {
  const supabase = createAdminClient()
  const productService = new ProductService(supabase)
  const deletedProducts = await productService.getDeletedProducts()
  return ApiResponse.success(deletedProducts)
}
