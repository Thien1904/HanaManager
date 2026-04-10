// types/product.ts
export interface ProductVariant {
  id: number
  name: string
  price: number
  isDefault: boolean
  isActive: boolean
  sortOrder: number
}

export interface Product {
  id: number
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  isAvailable: boolean
  categoryId: number | null
  printKitchen: boolean
  printBar: boolean
  printLabel: boolean
  category?: { id: number; name: string }
  variants: ProductVariant[]
}
