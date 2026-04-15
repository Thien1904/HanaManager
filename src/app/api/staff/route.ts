// ============================================================
// FILE: src/app/api/staff/route.ts
// NGÔN NGỮ: TypeScript — Next.js App Router API Route
// MỤC ĐÍCH: Xử lý CRUD nhân viên (users + employee_profiles)
//
// LUỒNG CHẠY:
//   1. Request từ client (StaffManager.tsx / StaffFormModal.tsx)
//   2. Middleware (src/middleware.ts) xác thực JWT, phân quyền, đính permissions vào header
//   3. requireRole() đọc header → kiểm tra có phải admin không
//   4. Nếu đúng role → thực hiện query Supabase
//   5. Trả về JSON theo format ApiResponse { success, data } hoặc { success, error }
//
// TODO LIST KHI CẦN MỞ RỘNG:
//   [ ] Thêm pagination khi danh sách nhân viên lớn
//   [ ] Gửi email thông báo khi tạo tài khoản mới
//   [ ] Log lịch sử thay đổi thông tin nhân viên
// ============================================================

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/utils/api-auth'
import { ApiResponse } from '@/utils/api-response' // Chuẩn hóa response API
// import requireRole
import { requireRole } from '@/utils/api'

// createAdminClient: tạo Supabase client dùng SERVICE_ROLE_KEY
// → bypass RLS, dùng trong API routes server-side để có toàn quyền đọc/ghi
// requireRole: đọc header x-user-role từ middleware.ts → kiểm tra quyền truy cập

import bcrypt from 'bcryptjs'
// bcryptjs: hash mật khẩu trước khi lưu vào database
// KHÔNG BAO GIỜ lưu plain text password

// ============================================================
// GET /api/staff
// Lấy toàn bộ danh sách nhân viên kèm hồ sơ và loại nhân viên
// Chỉ admin mới được gọi
// ============================================================
export async function GET(request: NextRequest) {
  // Bước 1: Kiểm tra quyền — chỉ admin
  const { error: authError } = requireRole(request, ['admin'])
  if (authError) return authError

  const supabase = createAdminClient()

  // Bước 2: Lấy danh sách users
  const { data: users, error: dbError } = await supabase
    .from('users')
    .select('id, username, full_name, phone, role, is_active, created_at')
    .order('created_at', { ascending: false })

  if (dbError) {
    console.error('[staff:GET] users error:', dbError)
    return ApiResponse.error('Không thể tải danh sách nhân viên', 500)
  }

  // Bước 3: Lấy employee_profiles riêng (tránh lỗi nested select)
  // employee_types join để lấy tên loại NV và mức lương mặc định
  const { data: profiles } = await supabase.from('employee_profiles').select(`
      id, user_id, hire_date, id_card,
      bank_account, bank_name, address,
      emergency_contact, is_active, note,
      employee_types ( id, name, default_hourly_rate )
    `)

  // Bước 4: Merge users + profiles theo user_id
  const data = users.map((u) => ({
    ...u,
    employee_profiles: profiles?.find((p) => p.user_id === u.id) ?? null,
  }))

  return ApiResponse.success(data)
}

// ============================================================
// POST /api/staff
// Tạo tài khoản nhân viên mới
// Gồm 2 bước: tạo user → tạo employee_profile
// ============================================================
export async function POST(request: NextRequest) {
  // Bước 1: Kiểm tra quyền
  const { error: authError } = requireRole(request, ['admin'])
  if (authError) return authError
  /**Dữ liệu đầu vào kỳ vọng:
   
   * {
   *   username: string,
   *   password: string,
   *   full_name: string,
   *   phone: string,
   *   role: string,
   *   // Thông tin hồ sơ nhân viên
   *   employee_type_id: number,
   *   hire_date: string,
   *   id_card: string,
   *   bank_account: string,
   *   bank_name: string,
   *   address: string,
   *   emergency_contact: string,
   *   note: string
   * }
 
   */
  const body = await request.json()
  const {
    username,
    password,
    full_name,
    phone,
    role,
    // Thông tin hồ sơ nhân viên
    employee_type_id,
    hire_date,
    id_card,
    bank_account,
    bank_name,
    address,
    emergency_contact,
    note,
  } = body

  // Bước 2: Validate dữ liệu đầu vào
  if (!username?.trim()) return ApiResponse.error('Username không được trống')
  if (!password || password.length < 6) return ApiResponse.error('Mật khẩu tối thiểu 6 ký tự')
  if (!full_name?.trim()) return ApiResponse.error('Họ tên không được trống')
  if (!role) return ApiResponse.error('Chọn vai trò')

  const supabase = createAdminClient()

  // Bước 3: Kiểm tra username đã tồn tại chưa
  const { count } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('username', username.trim())

  if (count && count > 0) return ApiResponse.error('Username đã tồn tại')

  // Bước 4: Hash mật khẩu — salt rounds = 10 (cân bằng bảo mật và tốc độ)
  const password_hash = await bcrypt.hash(password, 10)

  // Bước 5: Tạo bản ghi trong bảng users
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      username: username.trim(),
      password_hash,
      full_name: full_name.trim(),
      phone: phone?.trim() ?? null,
      role,
      is_active: true,
    })
    .select('id, username, full_name, phone, role, is_active, created_at')
    .single()

  if (userError) {
    console.error('[staff:POST] user error:', userError)
    return ApiResponse.error('Không thể tạo tài khoản', 500)
  }

  // Bước 6: Tạo employee_profile liên kết với user vừa tạo
  // Dùng user.id làm foreign key
  const { error: profileError } = await supabase.from('employee_profiles').insert({
    user_id: user.id,
    employee_type_id: employee_type_id || null,
    hire_date: hire_date || null,
    id_card: id_card?.trim() || null,
    bank_account: bank_account?.trim() || null,
    bank_name: bank_name?.trim() || null,
    address: address?.trim() || null,
    emergency_contact: emergency_contact?.trim() || null,
    note: note?.trim() || null,
    is_active: true,
  })

  // Profile lỗi không block — user vẫn được tạo, profile có thể sửa sau
  if (profileError) console.error('[staff:POST] profile error:', profileError)

  return ApiResponse.success(user, 201)
}

// ============================================================
// PUT /api/staff
// Cập nhật thông tin nhân viên
// Cho phép đổi: tên, SĐT, role, is_active, mật khẩu, hồ sơ
// username KHÔNG cho đổi (dùng làm định danh đăng nhập)
// ============================================================
export async function PUT(request: NextRequest) {
  // 🔥 1. Check permission (CHỈ 1 LẦN, ở đầu)
  const { user: currentUser, error } = await requirePermission(request, 'staff.update')
  if (error) return error

  // 🔥 2. Parse body
  const body = await request.json()
  const {
    id,
    password,
    permissions, // 👈 lấy luôn ra đây
    employee_type_id,
    hire_date,
    id_card,
    bank_account,
    bank_name,
    address,
    emergency_contact,
    note,
    ...userUpdates
  } = body

  if (!id) return ApiResponse.error('Thiếu id')

  const supabase = createAdminClient()

  // 🔥 3. Filter field được phép update
  const allowedUserFields = ['full_name', 'phone', 'role', 'is_active']
  const safeUserUpdates = Object.fromEntries(
    Object.entries(userUpdates).filter(([k]) => allowedUserFields.includes(k)),
  )

  // 🔥 4. Hash password nếu có
  if (password) {
    if (password.length < 6) return ApiResponse.error('Mật khẩu tối thiểu 6 ký tự')
    safeUserUpdates.password_hash = await bcrypt.hash(password, 10)
  }

  // 🔥 5. Update users
  if (Object.keys(safeUserUpdates).length > 0) {
    const { error: userError } = await supabase
      .from('users')
      .update(safeUserUpdates)
      .eq('id', Number(id))

    if (userError) {
      console.error('[staff:PUT] user error:', userError)
      return ApiResponse.error('Không thể cập nhật tài khoản', 500)
    }
  }

  // 🔥 6. Upsert employee_profile
  const { error: profileError } = await supabase.from('employee_profiles').upsert(
    {
      user_id: Number(id),
      employee_type_id: employee_type_id || null,
      hire_date: hire_date || null,
      id_card: id_card?.trim() || null,
      bank_account: bank_account?.trim() || null,
      bank_name: bank_name?.trim() || null,
      address: address?.trim() || null,
      emergency_contact: emergency_contact?.trim() || null,
      note: note?.trim() || null,
    },
    { onConflict: 'user_id' },
  )

  if (profileError) {
    console.error('[staff:PUT] profile error:', profileError)
  }

  // 🔥 7. Xử lý permissions
  if (permissions) {
    // ❗ chỉ admin mới được sửa quyền
    if (currentUser.role !== 'admin') {
      return ApiResponse.forbidden()
    }

    // 1. Xóa quyền cũ
    await supabase.from('user_permissions').delete().eq('user_id', Number(id))

    // 2. Lấy id permission từ code
    const { data: perms } = await supabase
      .from('permissions')
      .select('id, code')
      .in('code', permissions)
    console.log({ perms })
    // 3. Insert lại
    if (perms?.length) {
      await supabase.from('user_permissions').insert(
        perms.map((p) => ({
          user_id: Number(id),
          permission_id: p.id,
        })),
      )
    }
  }

  // 🔥 8. Return
  return ApiResponse.success({ id: Number(id) })
}
// ============================================================
// DELETE /api/staff
// Vô hiệu hóa tài khoản (soft delete — đặt is_active = false)
// KHÔNG xóa thật vì dữ liệu lịch sử (attendance, payroll) vẫn cần
// Admin không thể tự vô hiệu hóa tài khoản của chính mình
// ============================================================
export async function DELETE(request: NextRequest) {
  // Bước 1: Kiểm tra quyền + lấy thông tin người đang đăng nhập
  const { error: authError, user: currentUser } = requireRole(request, ['admin'])
  if (authError) return authError

  const { id } = await request.json()
  if (!id) return ApiResponse.error('Thiếu id')

  // Bước 2: Ngăn admin tự khóa tài khoản mình
  if (currentUser!.userId === Number(id))
    return ApiResponse.error('Không thể tự vô hiệu hóa tài khoản của mình')

  const supabase = createAdminClient()

  // Bước 3: Soft delete — chỉ đặt is_active = false
  const { error: dbError } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('id', Number(id))

  if (dbError) {
    console.error('[staff:DELETE] error:', dbError)
    return ApiResponse.error('Không thể vô hiệu hóa tài khoản', 500)
  }

  return ApiResponse.success({ id: Number(id) })
}
