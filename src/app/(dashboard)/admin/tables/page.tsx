// src/app/(dashboard)/admin/tables/page.tsx
// Trang quản lý bàn ăn — route: /admin/tables

import TableManager from '@/components/admin/TableManager'

export const metadata = { title: 'Quản lý bàn ăn' }

export default function TablesPage() {
  return <TableManager />
}