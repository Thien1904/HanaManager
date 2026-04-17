// src/app/(dashboard)/admin/menu/getDeletedProduct
import MenuManager from '@/components/admin/MenuManager'
import ProductIsDeleted from '@/components/admin/ProductIsDeleted'

export const metadata = { title: 'Các món đã xóa' }

export default function MenuPage() {
  return <ProductIsDeleted />
}
