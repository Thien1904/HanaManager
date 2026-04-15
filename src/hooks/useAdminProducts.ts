// src/hooks/useAdminProducts.ts
'use client'
import { useState, useEffect, useCallback } from 'react'
import type { Product } from '@/types/product'

export interface Category {
  id: number
  name: string
}

export function useAdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [prodRes, catRes] = await Promise.all([
        window.fetch('/api/products?all=true'),
        window.fetch('/api/categories'),
      ])
      const [prodJson, catJson] = await Promise.all([prodRes.json(), catRes.json()])
      if (!prodRes.ok) throw new Error(prodJson.error ?? 'Không thể tải món ăn')
      if (!catRes.ok) throw new Error(catJson.error ?? 'Không thể tải danh mục')
      setProducts(prodJson.data)
      setCategories(catJson.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { products, categories, loading, error, refresh: load }
}
