// src/hooks/useProducts.ts
'use client'

import { useState, useEffect } from 'react'

// Variant
export interface ProductVariant {
  id: number
  name: string
  price: number
  is_default: boolean
  is_active: boolean
  sort_order: number
}

// Product (camelCase – dùng toàn FE)
export interface Product {
  id: number
  name: string
  description: string | null
  price: number

  imageUrl: string | null
  isAvailable: boolean

  category: { id: number; name: string } | null

  variants: ProductVariant[]

  printKitchen: boolean
  printBar: boolean
  printLabel: boolean
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch('/api/products')
        const json = await res.json()

        if (!res.ok) throw new Error(json.error)

        setProducts(json.data) // ✅ API đã chuẩn hóa
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [])

  // Group theo category
  const grouped = products.reduce(
    (acc, product) => {
      const cat = product.category?.name ?? 'Khác'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(product)
      return acc
    },
    {} as Record<string, Product[]>,
  )

  return { products, grouped, loading, error }
}
