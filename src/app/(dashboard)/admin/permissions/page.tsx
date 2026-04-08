// src/app/(dashboard)/admin/permissions/page.tsx
// Trang phân quyền nhân viên — route: /admin/permissions

import PermissionManager from '@/components/admin/PermissionManager'

export const metadata = { title: 'Phân quyền nhân viên' }

export default function PermissionsPage() {
  return <PermissionManager />
}
