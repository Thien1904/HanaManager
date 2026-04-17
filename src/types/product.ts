// types/product.ts
export interface ProductVariant {
  id: number
  name: string
  price: number
  isDefault: boolean
  isActive: boolean
  sortOrder: number
}

// camelCase
export interface Product {
  id: number
  name: string
  description: string | null
  price: number

  imageUrl: string | null
  isAvailable: boolean
  isDeleted: boolean
  category: { id: number; name: string } | null

  printKitchen: boolean
  printBar: boolean
  printLabel: boolean

  variants: ProductVariant[]
}
