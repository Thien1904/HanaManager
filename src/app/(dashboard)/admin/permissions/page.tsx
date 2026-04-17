// src/app/(dashboard)/admin/permissions/page.tsx
// Trang phân quyền nhân viên — route: /admin/permissions

import PermissionManager from '@/components/admin/permissions/index'

export const metadata = { title: 'Phân quyền nhân viên' }

export default function PermissionsPage() {
  return <PermissionManager />
}
