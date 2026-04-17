// src/components/admin/permissions/types.ts

/**
 * Interface khớp chính xác với cấu trúc bảng public.permissions trong DB
 * Dùng khi nhận dữ liệu trực tiếp từ các câu truy vấn SQL
 */
export interface DbPermission {
  id: number
  code: string
  name: string
  group_name: string
  created_at: string | Date
}

/**
 * Interface dùng cho Frontend (camelCase) */
export interface Permission {
  id: number
  code: string
  name: string
  groupName: string // Chuyển từ group_name sang camelCase
  createdAt?: string | Date
}

/**
 * Interface cho StaffUser
 */
export interface StaffUser {
  id: number
  username: string
  fullName: string
  role: 'admin' | 'waiter' | 'chef' | string
  isActive: boolean
}

/**
 * Dữ liệu trả về từ API phân quyền (thường bao gồm danh sách quyền và quyền của user)
 */
export interface UserPermissionsData {
  permissions: Permission[]
  userPermissionIds: number[]
}
