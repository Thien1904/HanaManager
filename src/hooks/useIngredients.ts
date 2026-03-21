//src/hooks/useIngredients.ts
// Hook fetch danh sách nguyên liệu cho trang admin/ingredients
// Cung cấp: ingredients, loading, error, refresh
'use client'
import { useState, useEffect,useCallback } from 'react'
// Kiểu dữ liệu nguyên liệu khớp với bảng ingredients trong schema
export interface Ingredient {
    id: number
    name: string
    unit: string
    stock_quantity: number
    min_stock_level: number
    updated_at: string
}

export function useIngredients() {
    // ingredients lưu danh sách nguyên liệu
    const [ingredients, setIngredients] = useState<Ingredient[]>([])
    // loading để hiển thị spinner khi đang fetch
    const [loading, setLoading] = useState(true)
    // error lưu lỗi fetch nếu có, null nếu không lỗi
    const [error, setError] = useState<string | null>(null)
    // refreshFlag để trigger useEffect khi cần làm mới dữ liệu
    const [refreshFlag, setRefreshFlag] = useState(false)
    /**
   * load — fetch danh sách nguyên liệu từ API
   * Dùng useCallback để tránh re-render vô hạn khi đặt trong useEffect
   */
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.fetch('/api/ingredients')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Không thể tải danh sách nguyên liệu')
      setIngredients(json.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])


     useEffect(() => { load() }, [load])

    return { ingredients, loading, error, refresh:load }
}


