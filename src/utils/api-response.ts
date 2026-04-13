// src/utils/api-response.ts
// Định nghĩa ApiResponse và ValidationError để dùng trong toàn bộ API routes
// Tách riêng file này để tránh circular dependency với api.ts (vì api.ts cần import NextResponse)
import { NextResponse } from 'next/server'
export class ValidationError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ValidationError'
    this.status = status
  }
}
export const ApiResponse = {
  // Trả về response thành công với data
  success: <T>(data: T, status = 200) => NextResponse.json({ success: true, data }, { status }),

  // Trả về response lỗi với message
  error: (message: string, status = 400) =>
    NextResponse.json({ success: false, error: message }, { status }),
  // 400 - Dữ liệu không hợp lệ (Lỗi phía Client gửi lên)
  badRequest: (message: string = 'Dữ liệu không hợp lệ') =>
    NextResponse.json({ success: false, error: message }, { status: 400 }),
  // 401 — chưa đăng nhập
  unauthorized: () =>
    NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 401 }),

  // 403 — không đủ quyền, có thể truyền message chi tiết lý do hoặc không truyền gì để dùng message mặc định
  forbidden: (message = 'Bạn không có quyền truy cập 1') =>
    NextResponse.json({ success: false, error: message }, { status: 403 }),

  // 404 — không tìm thấy
  notFound: (resource = 'Dữ liệu') =>
    NextResponse.json({ success: false, error: `${resource} không tồn tại` }, { status: 404 }),

  /**
   * handle — xử lý lỗi trong catch block
   * ValidationError  → 400 với message từ assert()
   * Lỗi Supabase     → xử lý theo error code
   * Lỗi khác         → 500
   */
  handle(err: unknown) {
    if (err instanceof ValidationError)
      return NextResponse.json({ success: false, error: err.message }, { status: err.status })

    if (err && typeof err === 'object' && 'code' in err) {
      const e = err as { code: string; message?: string }
      switch (e.code) {
        case '23505':
          return ApiResponse.error('Dữ liệu đã tồn tại')
        case 'PGRST116':
          return ApiResponse.notFound()
      }
    }

    console.error('🔥 API Error:', err)
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống không xác định'
    return ApiResponse.error(message, 500)
  },
}
