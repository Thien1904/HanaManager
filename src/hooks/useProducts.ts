// src/hooks/useProducts.ts
'use client'
import { useState, useEffect } from 'react'

export interface Product {
  id: number
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_available: boolean
  categories: { id: number; name: string } | null
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    async function loadProducts() {
      try {
        const res  = await window.fetch('/api/products')
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

  // Nhóm món theo category — dùng reduce để gom lại
  // Kết quả: { "Món chính": [...], "Đồ uống": [...] }
  const grouped = products.reduce((acc, product) => {
    const cat = product.categories?.name ?? 'Khác'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(product)
    return acc
  }, {} as Record<string, Product[]>)

  return { products, grouped, loading, error }
}