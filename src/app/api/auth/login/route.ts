// src/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/server'
import { signToken, setSessionCookie } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    console.log('👉 1. Username nhận được:', username)

    if (!username || !password) {
      return NextResponse.json({ error: 'Vui lòng nhập đầy đủ thông tin' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Tìm user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password_hash, full_name, role, is_active')
      .eq('username', username.trim().toLowerCase())
      .single()

    console.log('👉 2. Query user:', { user: user?.username, error: error?.message })

    if (error || !user) {
      console.log('👉 3. Không tìm thấy user')
      return NextResponse.json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' }, { status: 401 })
    }

    if (!user.is_active) {
      console.log('👉 4. User bị khóa')
      return NextResponse.json({ error: 'Tài khoản đã bị vô hiệu hóa' }, { status: 401 })
    }

    // So sánh mật khẩu
    const isValid = await bcrypt.compare(password, user.password_hash)
    console.log('👉 5. Mật khẩu đúng không:', isValid)

    if (!isValid) {
      return NextResponse.json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' }, { status: 401 })
    }

    const token = await signToken({
      userId:   user.id,
      username: user.username,
      fullName: user.full_name,
      role:     user.role,
    })
    console.log('👉 6. Tạo token thành công')

    await setSessionCookie(token)

    // Xác định trang chuyển hướng dựa trên role
    return NextResponse.json({
  success:  true,
  redirect: getHomeByRole(user.role),
})

  } catch (err) {
    console.error('👉 LỖI SERVER:', err)
    return NextResponse.json({ error: 'Lỗi server, thử lại sau' }, { status: 500 })
  }
}
function getHomeByRole(role: string): string {
  switch (role) {
   case 'admin': return '/admin/reports'
    case 'waiter': return '/waiter/tables'
    case 'chef':   return '/chef/kitchen'
    default:       return '/login'
  }
}