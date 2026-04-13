// src/hooks/useProducts.ts
'use client'
import { useState, useEffect } from 'react'

// Kiểu 1 variant (size) của món
export interface ProductVariant {
  id: number
  name: string // "S", "M", "L", "Nhỏ", "Vừa", "Lớn"
  price: number
  is_default: boolean
  is_active: boolean
  sort_order: number
}

export interface Product {
  id: number
  name: string
  description: string | null
  price: number // giá mặc định — dùng khi không có variant
  image_url: string | null
  is_available: boolean
  categories: { id: number; name: string } | null
  variants: ProductVariant[] // rỗng = không có size
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await window.fetch('/api/products')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        setProducts(json.data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadProducts()
  }, [])

  // Nhóm món theo category
  const grouped = products.reduce(
    (acc, product) => {
      const cat = product.categories?.name ?? 'Khác'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(product)
      return acc
    },
    {} as Record<string, Product[]>,
  )

  return { products, grouped, loading, error }
}
