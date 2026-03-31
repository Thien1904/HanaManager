// src/app/api/printer-settings/route.ts
// Quản lý cài đặt máy in — CRUD bảng printer_settings
// Mỗi record = 1 máy in với loại kết nối (ip hoặc usb) và loại phiếu in

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ApiResponse, requireRole, assert } from '@/utils/api'

/**
 * GET /api/printer-settings — Lấy danh sách máy in đã cài đặt
 * Cho phép: admin
 */
export async function GET(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('printer_settings')
      .select('*')
      .order('printer_type')

    if (dbError) throw dbError
    return ApiResponse.success(data)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * POST /api/printer-settings — Thêm máy in mới
 * Body: { name, printer_type, connect_type, ip_address?, port?, usb_name?, paper_width? }
 */
export async function POST(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const body = await request.json()
    const { name, printer_type, connect_type, ip_address, port, usb_name, paper_width } = body

    assert(name?.trim(),     'Tên máy in không được trống')
    assert(printer_type,     'Chọn loại phiếu in')
    assert(connect_type,     'Chọn loại kết nối')
    assert(
      ['kitchen', 'bar', 'tem_ly', 'cashier'].includes(printer_type),
      'Loại phiếu không hợp lệ'
    )
    assert(
      ['ip', 'usb'].includes(connect_type),
      'Loại kết nối không hợp lệ'
    )
    if (connect_type === 'ip') {
      assert(ip_address?.trim(), 'Nhập địa chỉ IP máy in')
    }
    if (connect_type === 'usb') {
      assert(usb_name?.trim(), 'Nhập tên máy in USB')
    }

    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('printer_settings')
      .insert({
        name:         name.trim(),
        printer_type,
        connect_type,
        ip_address:   ip_address?.trim() ?? null,
        port:         port ?? 9100,
        usb_name:     usb_name?.trim() ?? null,
        paper_width:  paper_width ?? 80,
        is_active:    true,
      })
      .select()
      .single()

    if (dbError) throw dbError
    return ApiResponse.success(data, 201)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * PUT /api/printer-settings — Cập nhật máy in
 * Body: { id, ...fields }
 */
export async function PUT(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const body = await request.json()
    const { id, ...updates } = body

    assert(id, 'Thiếu id')

    const allowed = ['name', 'printer_type', 'connect_type', 'ip_address', 'port', 'usb_name', 'paper_width', 'is_active']
    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    )

    const supabase = createAdminClient()
    const { data, error: dbError } = await supabase
      .from('printer_settings')
      .update(safeUpdates)
      .eq('id', Number(id))
      .select()
      .single()

    if (dbError) throw dbError
    return ApiResponse.success(data)
  } catch (err) {
    return ApiResponse.handle(err)
  }
}

/**
 * DELETE /api/printer-settings — Xóa máy in
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  const { error } = requireRole(request, ['admin'])
  if (error) return error

  try {
    const { id } = await request.json()
    assert(id, 'Thiếu id')

    const supabase = createAdminClient()
    const { error: dbError } = await supabase
      .from('printer_settings')
      .delete()
      .eq('id', Number(id))

    if (dbError) throw dbError
    return ApiResponse.success({ id: Number(id) })
  } catch (err) {
    return ApiResponse.handle(err)
  }
}