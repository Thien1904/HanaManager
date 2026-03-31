// src/app/(dashboard)/admin/inventory/page.tsx
// Trang nhập nguyên liệu — route: /admin/inventory

import PurchaseOrderManager from '@/components/admin/PurchaseOrderManager'

export const metadata = { title: 'Nhập nguyên liệu' }

export default function InventoryPage() {
  return <PurchaseOrderManager />
}